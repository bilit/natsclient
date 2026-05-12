import {
  connect,
  NatsConnection,
  Subscription,
  StringCodec,
  NatsError,
  MsgHdrs,
} from "nats";
import { WebSocket } from "ws";
import { randomUUID } from "crypto";

const sc = StringCodec();

function headersToRecord(hdrs: MsgHdrs | undefined): Record<string, string> {
  if (!hdrs) return {};
  const result: Record<string, string> = {};
  for (const key of hdrs.keys()) {
    result[key] = hdrs.get(key) ?? "";
  }
  return result;
}

function send(ws: WebSocket, data: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

export class NatsProxy {
  private nc: NatsConnection | null = null;
  private discoverySub: Subscription | null = null;
  private userSubs = new Map<string, Subscription>();
  private seenSubjects = new Set<string>();
  private ws: WebSocket;

  constructor(ws: WebSocket) {
    this.ws = ws;
  }

  async connectToServer(url: string) {
    await this.disconnect();
    this.seenSubjects.clear();

    try {
      this.nc = await connect({ servers: url });
      send(this.ws, { type: "connected", serverInfo: this.nc.info });
      this.startDiscovery();
      this.watchClosed();
    } catch (err) {
      send(this.ws, {
        type: "error",
        message: `Failed to connect to ${url}: ${(err as Error).message}`,
      });
    }
  }

  private watchClosed() {
    (async () => {
      if (!this.nc) return;
      for await (const s of this.nc.status()) {
        if (s.type === "disconnect" || s.type === "error") {
          send(this.ws, { type: "error", message: `NATS: ${s.type}` });
        }
      }
    })().catch(() => {});
  }

  private startDiscovery() {
    if (!this.nc) return;
    this.discoverySub = this.nc.subscribe(">", {
      callback: (err, msg) => {
        if (err) return;

        const subject = msg.subject;
        const payloadBytes = msg.data;
        const bufData = Buffer.from(payloadBytes);
        const asUtf8 = bufData.toString("utf8");
        const isText = Buffer.from(asUtf8, "utf8").equals(bufData);
        const payload = isText ? asUtf8 : bufData.toString("base64");
        const encoding = isText ? "text" : "base64";

        if (!this.seenSubjects.has(subject)) {
          this.seenSubjects.add(subject);
          send(this.ws, { type: "subjects", subjects: [subject] });
        }

        send(this.ws, {
          type: "message",
          id: randomUUID(),
          subject,
          replyTo: msg.reply ?? null,
          payload,
          encoding,
          headers: headersToRecord(msg.headers),
          timestamp: Date.now(),
          size: payloadBytes.length,
        });
      },
    });
  }

  async publish(subject: string, payload: string, headers?: Record<string, string>) {
    if (!this.nc) {
      send(this.ws, { type: "error", message: "Not connected" });
      return;
    }
    try {
      const opts: { headers?: MsgHdrs } = {};
      if (headers && Object.keys(headers).length > 0) {
        const { headers: createHeaders } = await import("nats");
        const h = createHeaders();
        for (const [k, v] of Object.entries(headers)) {
          h.append(k, v);
        }
        opts.headers = h;
      }
      this.nc.publish(subject, sc.encode(payload), opts);
      send(this.ws, { type: "published", subject });
    } catch (err) {
      send(this.ws, {
        type: "error",
        message: `Publish failed: ${(err as Error).message}`,
      });
    }
  }

  async disconnect() {
    this.discoverySub?.unsubscribe();
    this.discoverySub = null;
    for (const sub of this.userSubs.values()) sub.unsubscribe();
    this.userSubs.clear();
    if (this.nc) {
      await this.nc.drain().catch(() => {});
      this.nc = null;
    }
  }
}
