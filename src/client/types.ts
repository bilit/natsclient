export interface NatsMessage {
  id: string;
  subject: string;
  replyTo: string | null;
  payload: string;
  encoding: "text" | "base64";
  headers: Record<string, string>;
  timestamp: number;
  size: number;
}

export type ServerToClient =
  | { type: "connected"; serverInfo: Record<string, unknown> }
  | { type: "message"; id: string; subject: string; replyTo: string | null; payload: string; encoding: "text" | "base64"; headers: Record<string, string>; timestamp: number; size: number }
  | { type: "subjects"; subjects: string[] }
  | { type: "published"; subject: string }
  | { type: "error"; message: string };

export type ClientToServer =
  | { type: "connect"; url: string }
  | { type: "publish"; subject: string; payload: string; headers?: Record<string, string> }
  | { type: "disconnect" };

export interface ServerTab {
  id: string;
  url: string;
  connected: boolean;
  messages: NatsMessage[];
  subjects: string[];
  checkedSubjects: Set<string>;
}
