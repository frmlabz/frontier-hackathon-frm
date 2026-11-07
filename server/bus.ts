// Server → shell real-time events over one WebSocket topic. Types are shared with web/store.ts.
import type { Server } from "bun";

export type BusEvent =
  | { type: "chat.delta"; text: string }
  | { type: "chat.item"; item: { id: number; kind: string; payload: any; createdAt: number } }
  | { type: "chat.itemUpdated"; item: { id: number; kind: string; payload: any; createdAt: number } }
  | { type: "ceo.busy"; busy: boolean }
  | { type: "app.status"; slug: string; status: string; step: string; version: number; error?: string | null }
  | { type: "records.changed"; app: string; collection: string }
  | { type: "activity.add"; personId: string; text: string; id: number; createdAt: number }
  | { type: "knowledge.changed"; slug: string }
  | { type: "state.changed" };

let server: Server<any> | null = null;
export const setServer = (s: Server<any>) => (server = s);
export const TOPIC = "bos";

export function publish(ev: BusEvent) {
  server?.publish(TOPIC, JSON.stringify(ev));
}
