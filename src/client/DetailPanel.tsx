import React from "react";
import { NatsMessage } from "./types";

interface Props {
  message: NatsMessage | null;
}

function prettyJson(s: string): string | null {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return null;
  }
}

function formatTime(ts: number): string {
  return new Date(ts).toISOString().replace("T", " ").replace("Z", "");
}

export function DetailPanel({ message }: Props) {
  if (!message) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#45475a", fontSize: 13 }}>
        Select a message
      </div>
    );
  }

  const isBinary = message.encoding === "base64";
  const pretty = !isBinary ? prettyJson(message.payload) : null;
  const headerEntries = Object.entries(message.headers);
  const payloadDisplay = isBinary ? message.payload : (pretty ?? message.payload);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 16, fontSize: 13, color: "#cdd6f4", display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <Field label="Subject" value={message.subject} mono />
        {message.replyTo && <Field label="Reply-To" value={message.replyTo} mono />}
        <Field label="Time" value={formatTime(message.timestamp)} />
        <Field label="Size" value={`${message.size} bytes`} />
      </div>

      {headerEntries.length > 0 && (
        <section>
          <SectionTitle>Headers</SectionTitle>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <tbody>
              {headerEntries.map(([k, v]) => (
                <tr key={k}>
                  <td style={{ padding: "2px 8px 2px 0", color: "#89b4fa", whiteSpace: "nowrap", verticalAlign: "top" }}>{k}</td>
                  <td style={{ padding: "2px 0", wordBreak: "break-all" }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section style={{ flex: 1 }}>
        <SectionTitle>
          Payload
          {isBinary && (
            <span style={{ marginLeft: 6, padding: "1px 6px", fontSize: 10, borderRadius: 3, background: "#313244", color: "#f38ba8", border: "1px solid #45475a" }}>
              binary · base64
            </span>
          )}
          {!isBinary && pretty && (
            <span style={{ marginLeft: 6, padding: "1px 6px", fontSize: 10, borderRadius: 3, background: "#313244", color: "#a6e3a1", border: "1px solid #45475a" }}>
              JSON
            </span>
          )}
          <button
            onClick={() => navigator.clipboard.writeText(message.payload)}
            style={{ marginLeft: "auto", padding: "1px 8px", fontSize: 11, borderRadius: 4, border: "1px solid #45475a", background: "#313244", color: "#cdd6f4", cursor: "pointer" }}
          >
            Copy
          </button>
        </SectionTitle>
        <pre style={{ margin: 0, padding: 10, borderRadius: 4, background: "#11111b", overflowX: "auto", fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          {payloadDisplay || <span style={{ color: "#45475a" }}>(empty)</span>}
        </pre>
      </section>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 4, fontSize: 13 }}>
      <span style={{ color: "#6c7086", minWidth: 70 }}>{label}</span>
      <span style={{ fontFamily: mono ? "monospace" : "inherit", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", fontSize: 11, color: "#6c7086", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
      {children}
    </div>
  );
}
