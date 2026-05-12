import React, { useRef, useEffect, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import { ColDef, GridReadyEvent, GridApi } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { NatsMessage } from "./types";

interface Props {
  messages: NatsMessage[];
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
  },
  {
    headerName: "Time",
    field: "timestamp",
    valueFormatter: (p) => formatTime(p.value as number),
    width: 105,
    resizable: true,
  },
  {
    headerName: "Subject",
    field: "subject",
    flex: 1,
    resizable: true,
  },
  {
    headerName: "Reply-To",
    field: "replyTo",
    width: 110,
    resizable: true,
    valueFormatter: (p) => p.value ?? "",
  },
  {
    headerName: "Size",
    field: "size",
    width: 70,
    resizable: true,
    valueFormatter: (p) => `${p.value}B`,
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
  },
];

export function MessageGrid({ messages, onSelect, selectedId }: Props) {
  const gridApi = useRef<GridApi<NatsMessage> | null>(null);

  const onGridReady = useCallback((e: GridReadyEvent<NatsMessage>) => {
    gridApi.current = e.api;
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (gridApi.current) {
      const lastRow = messages.length - 1;
      if (lastRow >= 0) {
        gridApi.current.ensureIndexVisible(lastRow, "bottom");
      }
    }
  }, [messages.length]);

  return (
    <div className="ag-theme-alpine-dark" style={{ flex: 1, height: "100%", overflow: "hidden" }}>
      <AgGridReact<NatsMessage>
        rowData={messages}
        columnDefs={columnDefs}
        rowSelection="single"
        getRowId={(p) => p.data.id}
        onGridReady={onGridReady}
        onRowClicked={(e) => e.data && onSelect(e.data)}
        rowStyle={{ cursor: "pointer" }}
        suppressCellFocus
        animateRows={false}
      />
    </div>
  );
}
