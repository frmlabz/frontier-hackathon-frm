// Platform services. Each interface has one prototype implementation in server/platform.ts;
// docs/architecture.md lists the product implementation each one is replaced by.
import type { KnowledgePage, Principal, Rec, WorkspaceProfile } from "./domain";

/** App data. Prototype: one SQLite table. Product: a store per workspace, schema derived from the spec. */
export interface RecordStore {
  list(app: string, collection: string): Rec[];
  get(app: string, collection: string, id: string): Rec | null;
  insert(app: string, collection: string, data: Record<string, unknown>, id?: string): Rec;
  update(app: string, collection: string, id: string, patch: Record<string, unknown>): Rec | null;
  remove(app: string, collection: string, id: string): void;
  count(app: string, collection: string): number;
}

/**
 * Turns generated source into a browser bundle. Prototype: in-process Bun.build over a version
 * directory. Product: the same call executed in a `build` sandbox (contracts/sandbox.ts) with no network.
 */
export interface BuildRunner {
  /** `dir` holds App.tsx; on success `dir/app.js` exists. Errors are fed back to the model verbatim. */
  bundle(dir: string): Promise<{ ok: true } | { ok: false; error: string }>;
}

/** Mail as an employee sees it. Prototype: the seeded inbox. Product: Gmail/IMAP through the token broker. */
export type MailSummary = { id: string; from: string; subject: string; date: string; snippet: string };
export type MailMessage = { id: string; from: string; subject: string; date: string; body: string };
export interface MailConnector {
  search(query: string, max?: number): MailSummary[] | Promise<MailSummary[]>;
  read(id: string): MailMessage | null | Promise<MailMessage | null>;
}

export interface KnowledgeStore {
  list(): KnowledgePage[];
  get(slug: string): KnowledgePage | null;
  upsert(page: { slug: string; emoji: string; title: string; markdown: string }): { page: KnowledgePage; created: boolean };
}

/** Resolves the caller. Prototype: always the owner. Product: sessions, passkeys, per-app roles. */
export interface Identity {
  workspace(): WorkspaceProfile;
  principal(req?: Request): Principal;
}

/** Usage and failure signals. Prototype: logs/usage.jsonl + console. Product: OTLP spans and events. */
export type UsageRecord = { kind: string; model: string; speed?: string; usage: Record<string, unknown>; cost: number | null };
export type Signal =
  | { type: "app.error"; app: string; version: number; message: string }
  | { type: "app.checks"; app: string; version: number; passed: number; failed: string[] }
  | { type: "build.failed"; app: string; attempt: number; error: string };
export interface Telemetry {
  usage(rec: UsageRecord): void;
  signal(s: Signal): void;
}

export interface Platform {
  records: RecordStore;
  builds: BuildRunner;
  mail: MailConnector;
  knowledge: KnowledgeStore;
  identity: Identity;
  telemetry: Telemetry;
}
