import React, { useState } from "react";
import { ServerTab } from "./types";

interface Props {
  tab: ServerTab;
  onToggle: (subject: string, checked: boolean) => void;
  onAddCustom: (subject: string) => void;
}

export function SubjectPanel({ tab, onToggle, onAddCustom }: Props) {
  const [custom, setCustom] = useState("");

  function submitCustom(e: React.FormEvent) {
    e.preventDefault();
    const s = custom.trim();
    if (s) {
      onAddCustom(s);
      setCustom("");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", width: 200, minWidth: 160, background: "#181825", borderRight: "1px solid #313244", overflow: "hidden" }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #313244", fontSize: 11, color: "#6c7086", textTransform: "uppercase", letterSpacing: 1 }}>
        Subjects
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {tab.subjects.length === 0 && (
          <div style={{ padding: "8px 12px", fontSize: 12, color: "#45475a" }}>
            Waiting for messages…
          </div>
        )}
        {tab.subjects.map((subject) => (
          <label
            key={subject}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 12px", cursor: "pointer", fontSize: 13, color: "#cdd6f4" }}
          >
            <input
              type="checkbox"
              checked={tab.checkedSubjects.has(subject)}
              onChange={(e) => onToggle(subject, e.target.checked)}
              style={{ accentColor: "#89b4fa" }}
            />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={subject}>
              {subject}
            </span>
          </label>
        ))}
      </div>
      <form onSubmit={submitCustom} style={{ padding: "8px", borderTop: "1px solid #313244", display: "flex", gap: 4 }}>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="foo.* or >"
          style={{ flex: 1, fontSize: 12, padding: "3px 6px", borderRadius: 4, border: "1px solid #45475a", background: "#1e1e2e", color: "#cdd6f4", minWidth: 0 }}
        />
        <button type="submit" style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid #45475a", background: "#313244", color: "#cdd6f4", cursor: "pointer", fontSize: 12 }}>
          +
        </button>
      </form>
    </div>
  );
}
