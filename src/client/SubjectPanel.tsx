import React, { useState, useRef, useCallback } from "react";
import { ServerTab } from "./types";

interface Props {
  tab: ServerTab;
  onToggle: (subject: string, checked: boolean) => void;
  onAddCustom: (subject: string) => void;
}

const MIN_WIDTH = 120;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 200;
const COLLAPSED_WIDTH = 28;

export function SubjectPanel({ tab, onToggle, onAddCustom }: Props) {
  const [custom, setCustom] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: width };

    function onMouseMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      const delta = ev.clientX - dragRef.current.startX;
      setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, dragRef.current.startWidth + delta)));
    }

    function onMouseUp() {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [width]);

  function submitCustom(e: React.FormEvent) {
    e.preventDefault();
    const s = custom.trim();
    if (s) {
      onAddCustom(s);
      setCustom("");
    }
  }

  if (collapsed) {
    return (
      <div style={{ width: COLLAPSED_WIDTH, background: "#181825", borderRight: "1px solid #313244", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 6, flexShrink: 0 }}>
        <button
          onClick={() => setCollapsed(false)}
          title="Expand subjects panel"
          style={{ background: "none", border: "none", color: "#6c7086", cursor: "pointer", fontSize: 16, padding: "2px 4px", lineHeight: 1 }}
        >
          ›
        </button>
        <div style={{ marginTop: 8, writingMode: "vertical-rl", fontSize: 10, color: "#45475a", textTransform: "uppercase", letterSpacing: 1, userSelect: "none" }}>
          Subjects
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "row", flexShrink: 0, position: "relative" }}>
      <div style={{ display: "flex", flexDirection: "column", width, background: "#181825", borderRight: "1px solid #313244", overflow: "hidden" }}>
        <div style={{ padding: "8px 12px", borderBottom: "1px solid #313244", fontSize: 11, color: "#6c7086", textTransform: "uppercase", letterSpacing: 1, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span>Subjects</span>
          <button
            onClick={() => setCollapsed(true)}
            title="Collapse subjects panel"
            style={{ background: "none", border: "none", color: "#6c7086", cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1 }}
          >
            ‹
          </button>
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
                style={{ accentColor: "#89b4fa", flexShrink: 0 }}
              />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={subject}>
                {subject}
              </span>
            </label>
          ))}
        </div>

        <form onSubmit={submitCustom} style={{ padding: "8px", borderTop: "1px solid #313244", display: "flex", gap: 4, flexShrink: 0 }}>
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="foo.* or >"
            style={{ flex: 1, fontSize: 12, padding: "3px 6px", borderRadius: 4, border: "1px solid #45475a", background: "#1e1e2e", color: "#cdd6f4", minWidth: 0, outline: "none" }}
          />
          <button type="submit" style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid #45475a", background: "#313244", color: "#cdd6f4", cursor: "pointer", fontSize: 12 }}>
            +
          </button>
        </form>
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={onDragStart}
        style={{
          position: "absolute",
          right: -3,
          top: 0,
          bottom: 0,
          width: 6,
          cursor: "col-resize",
          zIndex: 10,
        }}
      />
    </div>
  );
}
