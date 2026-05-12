import React, { useRef, useEffect, useCallback, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { ColDef, GridReadyEvent, GridApi } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { NatsMessage } from "./types";

// Stable empty array — never reassigned, so AgGridReact never sees a changed
// rowData prop and never re-initialises its row model on a parent re-render.
const EMPTY_ROWS: NatsMessage[] = [];

interface Props {
  messages: NatsMessage[];
  tabId: string;
  onSelect: (msg: NatsMessage) => void;
  selectedId: string | null;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return (
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0") +
    ":" +
    String(d.getSeconds()).padStart(2, "0") +
    "." +
    String(d.getMilliseconds()).padStart(3, "0")
  );
}

const columnDefs: ColDef<NatsMessage>[] = [
  {
    headerName: "#",
    valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
    width: 55,
    pinned: "left",
    sortable: false,
    resizable: false,
    filter: false,
  },
  {
    headerName: "Time",
    field: "timestamp",
    valueFormatter: (p) => formatTime(p.value as number),
    getQuickFilterText: (p) => formatTime(p.value as number),
    width: 105,
    resizable: true,
    filter: "agNumberColumnFilter",
  },
  {
    headerName: "Subject",
    field: "subject",
    flex: 1,
    resizable: true,
    filter: "agTextColumnFilter",
  },
  {
    headerName: "Reply-To",
    field: "replyTo",
    width: 110,
    resizable: true,
    valueFormatter: (p) => p.value ?? "",
    filter: "agTextColumnFilter",
  },
  {
    headerName: "Size",
    field: "size",
    width: 70,
    resizable: true,
    valueFormatter: (p) => `${p.value}B`,
    getQuickFilterText: (p) => `${p.value}B`,
    filter: "agNumberColumnFilter",
  },
  {
    headerName: "Preview",
    field: "payload",
    flex: 2,
    resizable: true,
    valueFormatter: (p) => {
      const s = (p.value as string) ?? "";
      return s.length > 120 ? s.slice(0, 120) + "…" : s;
    },
    filter: "agTextColumnFilter",
  },
];

export function MessageGrid({ messages, tabId, onSelect, selectedId }: Props) {
  const gridApi = useRef<GridApi<NatsMessage> | null>(null);
  const [quickFilter, setQuickFilter] = useState("");

  // Tracks what the grid was last told about
  const gridStateRef = useRef({ tabId: "", messageCount: 0, lastItem: null as NatsMessage | null });

  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const tabIdRef = useRef(tabId);
  tabIdRef.current = tabId;

  const onGridReady = useCallback((e: GridReadyEvent<NatsMessage>) => {
    gridApi.current = e.api;
    const msgs = messagesRef.current;
    e.api.setGridOption("rowData", msgs);
    gridStateRef.current = {
      tabId: tabIdRef.current,
      messageCount: msgs.length,
      lastItem: msgs[msgs.length - 1] ?? null,
    };
  }, []);

  useEffect(() => {
    const api = gridApi.current;
    if (!api) return;

    const state = gridStateRef.current;
    const currLen = messages.length;

    // Tab switched — full reset
    if (state.tabId !== tabId) {
      api.setGridOption("rowData", messages);
      gridStateRef.current = { tabId, messageCount: currLen, lastItem: messages[currLen - 1] ?? null };
      return;
    }

    const prevLen = state.messageCount;

    if (currLen === prevLen) return;

    if (currLen === 0) {
      api.setGridOption("rowData", []);
    } else if (currLen > prevLen) {
      // Only use applyTransaction when the array grew by pure appends:
      // check that the item previously at the tail is still at the same position.
      const isPureAppend = prevLen === 0 || messages[prevLen - 1] === state.lastItem;
      if (isPureAppend) {
        api.applyTransaction({ add: messages.slice(prevLen) });
      } else {
        // Subject was re-checked — existing filtered items reappeared
        api.setGridOption("rowData", messages);
      }
    } else {
      // Array shrank (subject unchecked or clear) — full reset
      api.setGridOption("rowData", messages);
    }

    gridStateRef.current = { tabId, messageCount: currLen, lastItem: messages[currLen - 1] ?? null };
  }, [messages, tabId]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "4px 8px", borderBottom: "1px solid #313244", background: "#1e1e2e", flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Quick filter…"
          value={quickFilter}
          onChange={(e) => {
            setQuickFilter(e.target.value);
            gridApi.current?.setGridOption("quickFilterText", e.target.value);
          }}
          style={{
            width: "100%",
            padding: "3px 8px",
            background: "#313244",
            border: "1px solid #45475a",
            borderRadius: 4,
            color: "#cdd6f4",
            fontSize: 12,
            outline: "none",
          }}
        />
      </div>
      <div className="ag-theme-alpine-dark" style={{ flex: 1, overflow: "hidden" }}>
        <AgGridReact<NatsMessage>
          columnDefs={columnDefs}
          rowData={EMPTY_ROWS}
          rowSelection="single"
          getRowId={(p) => p.data.id}
          onGridReady={onGridReady}
          onRowClicked={(e) => e.data && onSelect(e.data)}
          rowStyle={{ cursor: "pointer" }}
          suppressCellFocus
          animateRows={false}
        />
      </div>
    </div>
  );
}
