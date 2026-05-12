import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { NatsProxy } from "./natsProxy";
import path from "path";

export function createHttpServer(staticDir: string, defaultServer?: string) {
  const app = express();
  app.use(express.static(staticDir));
  // SPA fallback
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });

  const server = createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    if (req.url === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws: WebSocket) => {
    const proxy = new NatsProxy(ws);

    if (defaultServer) {
      proxy.connectToServer(defaultServer);
    }

    ws.on("message", (raw) => {
      let msg: { type: string; [key: string]: unknown };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      switch (msg.type) {
        case "connect":
          proxy.connectToServer(msg.url as string);
          break;
        case "publish":
          proxy.publish(
            msg.subject as string,
            msg.payload as string,
            msg.headers as Record<string, string> | undefined
          );
          break;
        case "disconnect":
          proxy.disconnect();
          break;
      }
    });

    ws.on("close", () => {
      proxy.disconnect();
    });
  });

  return server;
}
