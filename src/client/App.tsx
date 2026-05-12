import React, { useState, useEffect, useRef, useCallback } from "react";
import { TabBar } from "./TabBar";
import { SubjectPanel } from "./SubjectPanel";
import { MessageGrid } from "./MessageGrid";
import { DetailPanel } from "./DetailPanel";
import { NatsMessage, ServerTab, ServerToClient } from "./types";
import { randomId } from "./util";

function makeTab(url: string): ServerTab {
  return {
    id: randomId(),
    url,
    connected: false,
    messages: [],
    subjects: [],
    checkedSubjects: new Set(),
  };
}

// One WS per tab — keyed by tab id
const wsSessions = new Map<string, WebSocket>();

function openWs(tabId: string, url: string, onMsg: (tabId: string, evt: ServerToClient) => void, onClose: (tabId: string) => void) {
  const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
  wsSessions.set(tabId, ws);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "connect", url }));
  };

  ws.onmessage = (e) => {
    try {
      onMsg(tabId, JSON.parse(e.data) as ServerToClient);
    } catch {}
  };

  ws.onclose = () => {
    wsSessions.delete(tabId);
    onClose(tabId);
  };
}

function closeWs(tabId: string) {
  const ws = wsSessions.get(tabId);
  if (ws) {
    ws.send(JSON.stringify({ type: "disconnect" }));
    ws.close();
    wsSessions.delete(tabId);
  }
}

export function App() {
  const [tabs, setTabs] = useState<ServerTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedMsg, setSelectedMsg] = useState<NatsMessage | null>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const buffered = useRef<Map<string, NatsMessage[]>>(new Map());

  const updateTab = useCallback((tabId: string, updater: (t: ServerTab) => ServerTab) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? updater(t) : t)));
  }, []);

  const handleWsMsg = useCallback((tabId: string, evt: ServerToClient) => {
    if (evt.type === "connected") {
      updateTab(tabId, (t) => ({ ...t, connected: true }));
    } else if (evt.type === "message") {
      const msg: NatsMessage = {
        id: evt.id,
        subject: evt.subject,
        replyTo: evt.replyTo,
        payload: evt.payload,
        headers: evt.headers,
        timestamp: evt.timestamp,
        size: evt.size,
      };
      if (pausedRef.current) {
        const buf = buffered.current.get(tabId) ?? [];
        buf.push(msg);
        buffered.current.set(tabId, buf);
      } else {
        updateTab(tabId, (t) => ({ ...t, messages: [...t.messages, msg] }));
      }
    } else if (evt.type === "subjects") {
      updateTab(tabId, (t) => {
        const newSubjects = evt.subjects.filter((s) => !t.subjects.includes(s));
        if (newSubjects.length === 0) return t;
        const updated = { ...t, subjects: [...t.subjects, ...newSubjects] };
        // Auto-check new subjects
        newSubjects.forEach((s) => updated.checkedSubjects.add(s));
        updated.checkedSubjects = new Set(updated.checkedSubjects);
        return updated;
      });
    } else if (evt.type === "error") {
      updateTab(tabId, (t) => ({ ...t, connected: false }));
    }
  }, [updateTab]);

  const handleWsClose = useCallback((tabId: string) => {
    updateTab(tabId, (t) => ({ ...t, connected: false }));
  }, [updateTab]);

  function addTab(url: string) {
    const tab = makeTab(url);
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
    setSelectedMsg(null);
    openWs(tab.id, url, handleWsMsg, handleWsClose);
  }

  function removeTab(tabId: string) {
    closeWs(tabId);
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== tabId);
      if (activeId === tabId) {
        setActiveId(next[next.length - 1]?.id ?? null);
        setSelectedMsg(null);
      }
      return next;
    });
  }

  function selectTab(tabId: string) {
    setActiveId(tabId);
    setSelectedMsg(null);
  }

  function toggleSubject(tabId: string, subject: string, checked: boolean) {
    updateTab(tabId, (t) => {
      const s = new Set(t.checkedSubjects);
      checked ? s.add(subject) : s.delete(subject);
      return { ...t, checkedSubjects: s };
    });
  }

  function addCustomSubject(tabId: string, subject: string) {
    updateTab(tabId, (t) => {
      if (t.subjects.includes(subject)) return t;
      const s = new Set(t.checkedSubjects);
      s.add(subject);
      return { ...t, subjects: [...t.subjects, subject], checkedSubjects: s };
    });
  }

  function clearMessages() {
    if (!activeId) return;
    updateTab(activeId, (t) => ({ ...t, messages: [] }));
    setSelectedMsg(null);
    buffered.current.delete(activeId);
  }

  function togglePause() {
    if (paused && activeId) {
      // Flush buffered messages
      const buf = buffered.current.get(activeId) ?? [];
      if (buf.length > 0) {
        updateTab(activeId, (t) => ({ ...t, messages: [...t.messages, ...buf] }));
        buffered.current.delete(activeId);
      }
    }
    setPaused((p) => !p);
  }

  const activeTab = tabs.find((t) => t.id === activeId) ?? null;

  // Start with one empty tab on mount
  useEffect(() => {
    if (tabs.length === 0) addTab("nats://localhost:4222");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#1e1e2e", color: "#cdd6f4", fontFamily: "system-ui, sans-serif" }}>
      <TabBar tabs={tabs} activeId={activeId} onSelect={selectTab} onClose={removeTab} onAdd={addTab} />

      {activeTab ? (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <SubjectPanel
            tab={activeTab}
            onToggle={(s, checked) => toggleSubject(activeTab.id, s, checked)}
            onAddCustom={(s) => addCustomSubject(activeTab.id, s)}
          />

          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderBottom: "1px solid #313244", fontSize: 12, color: "#6c7086" }}>
              <span>{activeTab.messages.length} messages</span>
              <div style={{ flex: 1 }} />
              <button onClick={clearMessages} style={actionBtn}>Clear</button>
              <button onClick={togglePause} style={{ ...actionBtn, color: paused ? "#a6e3a1" : "#cdd6f4" }}>
                {paused ? "Resume" : "Pause"}
              </button>
            </div>
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <MessageGrid
                messages={activeTab.messages}
                checkedSubjects={activeTab.checkedSubjects}
                tabId={activeTab.id}
                onSelect={setSelectedMsg}
                selectedId={selectedMsg?.id ?? null}
              />
              <div style={{ width: 340, minWidth: 240, borderLeft: "1px solid #313244", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <DetailPanel message={selectedMsg} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#45475a" }}>
          Click + to add a NATS server
        </div>
      )}
    </div>
  );
}

const actionBtn: React.CSSProperties = {
  padding: "2px 10px",
  borderRadius: 4,
  border: "1px solid #45475a",
  background: "#313244",
  color: "#cdd6f4",
  cursor: "pointer",
  fontSize: 12,
};
