import React, { useState, useEffect } from "react";
import { NatsMessage } from "./types";
import { decodePayload, DecodeResult, formatLabel } from "./decodePayload";

interface Props {
  message: NatsMessage | null;
}

function formatTime(ts: number): string {
  return new Date(ts).toISOString().replace("T", " ").replace("Z", "");
}

export function DetailPanel({ message }: Props) {
  const [decoded, setDecoded] = useState<DecodeResult | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    setDecoded(null);
    setShowRaw(false);
    if (!message) return;
    let cancelled = false;
    decodePayload(message.payload, message.encoding).then((r) => {
      if (!cancelled) setDecoded(r);
    });
    return () => { cancelled = true; };
  }, [message]);

  if (!message) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#45475a", fontSize: 13 }}>
        Select a message
      </div>
    );
  }

  const hasDecoded = decoded !== null;
  const display = showRaw || !hasDecoded ? message.payload : decoded.display;
  const steps = decoded?.steps ?? (message.encoding === "base64" ? ["base64"] : []);
  const headerEntries = Object.entries(message.headers);

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
          {/* Decode-chain badges — dimmed when viewing raw */}
          {steps.length > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 3, marginLeft: 6, opacity: showRaw ? 0.4 : 1 }}>
              {steps.map((s, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span style={{ color: "#45475a", fontSize: 10 }}>→</span>}
                  <span style={{
                    padding: "1px 5px",
                    fontSize: 10,
                    borderRadius: 3,
                    border: "1px solid #45475a",
                    background: "#313244",
                    color: s === "json" ? "#a6e3a1" : s === "hex" ? "#f38ba8" : "#89dceb",
                  }}>
                    {formatLabel(s)}
                  </span>
                </React.Fragment>
              ))}
            </span>
          )}
          {/* Toggle between decoded and raw view */}
          {hasDecoded && (
            <button
              onClick={() => setShowRaw((r) => !r)}
              style={{ marginLeft: 6, padding: "1px 8px", fontSize: 11, borderRadius: 4, border: "1px solid #45475a", background: showRaw ? "#45475a" : "#313244", color: "#cdd6f4", cursor: "pointer" }}
            >
              {showRaw ? "decoded" : "raw"}
            </button>
          )}
          <button
            onClick={() => navigator.clipboard.writeText(display)}
            style={{ marginLeft: "auto", padding: "1px 8px", fontSize: 11, borderRadius: 4, border: "1px solid #45475a", background: "#313244", color: "#cdd6f4", cursor: "pointer" }}
          >
            Copy
          </button>
        </SectionTitle>
        <pre style={{ margin: 0, padding: 10, borderRadius: 4, background: "#11111b", overflowX: "auto", fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          {display || <span style={{ color: "#45475a" }}>(empty)</span>}
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
