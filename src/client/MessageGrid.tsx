import React, { useRef, useEffect, useCallback, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { ColDef, GridReadyEvent, GridApi, IRowNode } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { NatsMessage } from "./types";

interface Props {
  messages: NatsMessage[];
  checkedSubjects: Set<string>;
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

export function MessageGrid({ messages, checkedSubjects, tabId, onSelect, selectedId }: Props) {
  const gridApi = useRef<GridApi<NatsMessage> | null>(null);
  const [quickFilter, setQuickFilter] = useState("");

  // Refs so callbacks always read latest values without needing to be recreated
  const checkedSubjectsRef = useRef(checkedSubjects);
  checkedSubjectsRef.current = checkedSubjects;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const tabIdRef = useRef(tabId);
  tabIdRef.current = tabId;

  // Tracks what state the grid has been told about
  const gridStateRef = useRef({ tabId: "", messageCount: 0 });

  const onGridReady = useCallback((e: GridReadyEvent<NatsMessage>) => {
    gridApi.current = e.api;
    const msgs = messagesRef.current;
    e.api.setGridOption("rowData", msgs);
    gridStateRef.current = { tabId: tabIdRef.current, messageCount: msgs.length };
  }, []);

  // Incremental updates via applyTransaction; full reset only on tab switch or clear
  useEffect(() => {
    const api = gridApi.current;
    if (!api) return;

    const state = gridStateRef.current;
    const currLen = messages.length;

    if (state.tabId !== tabId) {
      api.setGridOption("rowData", messages);
      gridStateRef.current = { tabId, messageCount: currLen };
      return;
    }

    const prevLen = state.messageCount;

    if (currLen === 0 && prevLen > 0) {
      api.setGridOption("rowData", []);
    } else if (currLen > prevLen) {
      api.applyTransaction({ add: messages.slice(prevLen) });
      const lastVisible = api.getDisplayedRowCount() - 1;
      if (lastVisible >= 0) api.ensureIndexVisible(lastVisible, "bottom");
    } else if (currLen < prevLen && currLen > 0) {
      // Shouldn't happen in normal usage; reset defensively
      api.setGridOption("rowData", messages);
    }

    gridStateRef.current = { ...state, messageCount: currLen };
  }, [messages, tabId]);

  // Re-evaluate external filter when subject checkboxes change
  useEffect(() => {
    gridApi.current?.onFilterChanged();
  }, [checkedSubjects]);

  const isExternalFilterPresent = useCallback(() => true, []);

  const doesExternalFilterPass = useCallback((node: IRowNode<NatsMessage>) => {
    if (!node.data) return true;
    return checkedSubjectsRef.current.has(node.data.subject);
  }, []);

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
          rowData={[]}
          rowSelection="single"
          getRowId={(p) => p.data.id}
          onGridReady={onGridReady}
          onRowClicked={(e) => e.data && onSelect(e.data)}
          rowStyle={{ cursor: "pointer" }}
          suppressCellFocus
          animateRows={false}
          isExternalFilterPresent={isExternalFilterPresent}
          doesExternalFilterPass={doesExternalFilterPass}
        />
      </div>
    </div>
  );
}
