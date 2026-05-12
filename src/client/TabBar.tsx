import React, { useState } from "react";
import { ServerTab } from "./types";

interface Props {
  tabs: ServerTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: (url: string) => void;
}

export function TabBar({ tabs, activeId, onSelect, onClose, onAdd }: Props) {
  const [adding, setAdding] = useState(false);
  const [inputUrl, setInputUrl] = useState("nats://localhost:4222");

  function submitNew(e: React.FormEvent) {
    e.preventDefault();
    const url = inputUrl.trim();
    if (url) {
      onAdd(url);
      setInputUrl("nats://localhost:4222");
    }
    setAdding(false);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", background: "#1e1e2e", borderBottom: "1px solid #313244", padding: "4px 8px", gap: 4 }}>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 4,
            cursor: "pointer",
            background: tab.id === activeId ? "#313244" : "transparent",
            color: tab.id === activeId ? "#cdd6f4" : "#6c7086",
            fontSize: 13,
            userSelect: "none",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: tab.connected ? "#a6e3a1" : "#f38ba8",
              flexShrink: 0,
            }}
          />
          <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {tab.url.replace(/^nats:\/\//, "")}
          </span>
          <span
            onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
            style={{ marginLeft: 2, opacity: 0.5, lineHeight: 1 }}
            title="Close"
          >
            ×
          </span>
        </div>
      ))}

      {adding ? (
        <form onSubmit={submitNew} style={{ display: "flex", gap: 4 }}>
          <input
            autoFocus
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="nats://host:4222"
            style={{ fontSize: 13, padding: "2px 8px", borderRadius: 4, border: "1px solid #45475a", background: "#1e1e2e", color: "#cdd6f4", width: 200 }}
          />
          <button type="submit" style={btnStyle}>Connect</button>
          <button type="button" onClick={() => setAdding(false)} style={btnStyle}>Cancel</button>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} style={{ ...btnStyle, fontSize: 18, lineHeight: 1, padding: "0 8px" }} title="Add server">+</button>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "3px 10px",
  borderRadius: 4,
  border: "1px solid #45475a",
  background: "#313244",
  color: "#cdd6f4",
  cursor: "pointer",
  fontSize: 13,
};
