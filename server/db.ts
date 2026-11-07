import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { seedEmails, seedHumans } from "./seed";

// Mock mode gets its own data dir so scripted runs never leak into the real demo DB.
export const MOCK = process.env.BOS_MOCK === "1";
export const DATA_DIR = process.env.BOS_DATA_DIR ?? (MOCK ? "data/mock" : "data");

mkdirSync(`${DATA_DIR}/apps`, { recursive: true });
export const db = new Database(`${DATA_DIR}/bos.sqlite`, { create: true });
db.exec("PRAGMA journal_mode = WAL;");

db.exec(`
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY, role TEXT, content_json TEXT);
CREATE TABLE IF NOT EXISTS chat_items(id INTEGER PRIMARY KEY, kind TEXT, payload_json TEXT, created_at INTEGER);
CREATE TABLE IF NOT EXISTS knowledge_pages(slug TEXT PRIMARY KEY, emoji TEXT, title TEXT, markdown TEXT, position INTEGER, updated_at INTEGER);
CREATE TABLE IF NOT EXISTS apps(slug TEXT PRIMARY KEY, name TEXT, emoji TEXT, description TEXT,
  requirements TEXT, schema_json TEXT, status TEXT, version INTEGER, step TEXT, error TEXT, created_at INTEGER);
CREATE TABLE IF NOT EXISTS records(app TEXT, collection TEXT, id TEXT, data_json TEXT, created_at INTEGER, updated_at INTEGER,
  PRIMARY KEY(app, collection, id));
CREATE TABLE IF NOT EXISTS people(id TEXT PRIMARY KEY, kind TEXT, name TEXT, role TEXT, emoji TEXT, color TEXT,
  instructions TEXT, connectors_json TEXT, status TEXT, created_at INTEGER);
CREATE TABLE IF NOT EXISTS activity(id INTEGER PRIMARY KEY, person_id TEXT, text TEXT, created_at INTEGER);
CREATE TABLE IF NOT EXISTS connectors(provider TEXT PRIMARY KEY, account TEXT, connected_at INTEGER);
CREATE TABLE IF NOT EXISTS emails(id TEXT PRIMARY KEY, from_name TEXT, from_addr TEXT, subject TEXT, body TEXT, received_at INTEGER);
CREATE TABLE IF NOT EXISTS processed_emails(message_id TEXT PRIMARY KEY, person_id TEXT);
CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY, value TEXT);
`);

// ---------- types ----------
export type ChatItem = { id: number; kind: string; payload: any; createdAt: number };
export type Field = { name: string; type: "text" | "number" | "date" | "boolean"; unit?: string | null };
export type Collection = { name: string; fields: Field[] };
export type App = {
  slug: string; name: string; emoji: string; description: string; requirements: string;
  schema: Collection[] | null; status: string; version: number; step: string; error: string | null; createdAt: number;
};
export type Person = {
  id: string; kind: "human" | "ai"; name: string; role: string; emoji: string; color: string;
  instructions: string; connectors: string[]; status: string; createdAt: number;
};
export type KnowledgePage = { slug: string; emoji: string; title: string; markdown: string; position: number; updatedAt: number };
export type Rec = { id: string; createdAt: number; updatedAt: number; [k: string]: any };

const now = () => Date.now();
export const slugify = (s: string, fallback: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || fallback;

// ---------- seed ----------
if ((db.query("SELECT COUNT(*) c FROM people").get() as any).c === 0) {
  const ins = db.query("INSERT INTO people VALUES (?,?,?,?,?,?,?,?,?,?)");
  seedHumans.forEach((h, i) => ins.run(h.id, "human", h.name, h.role, h.emoji, h.color, "", "[]", "idle", now() + i));
}
if ((db.query("SELECT COUNT(*) c FROM emails").get() as any).c === 0) {
  const ins = db.query("INSERT INTO emails VALUES (?,?,?,?,?,?)");
  for (const e of seedEmails) ins.run(e.id, e.fromName, e.fromAddr, e.subject, e.body, e.receivedAt);
}

// ---------- kv ----------
export const kv = {
  get: (k: string) => (db.query("SELECT value FROM kv WHERE key=?").get(k) as any)?.value as string | undefined,
  set: (k: string, v: string) => db.query("INSERT OR REPLACE INTO kv VALUES (?,?)").run(k, v),
};

// ---------- messages (exact Anthropic history, append-only) ----------
export function appendMessage(role: "user" | "assistant", content: any[]) {
  // A turn that failed mid-way can leave a trailing user message with no reply. Nothing references it yet,
  // so the next user content joins it instead of creating two user messages in a row.
  const last = db.query("SELECT id, role, content_json FROM messages ORDER BY id DESC LIMIT 1").get() as any;
  if (last && last.role === "user" && role === "user") {
    db.query("UPDATE messages SET content_json=? WHERE id=?").run(JSON.stringify([...JSON.parse(last.content_json), ...content]), last.id);
    return;
  }
  db.query("INSERT INTO messages(role, content_json) VALUES (?,?)").run(role, JSON.stringify(content));
}
export function getMessages(): { role: "user" | "assistant"; content: any }[] {
  return (db.query("SELECT role, content_json FROM messages ORDER BY id").all() as any[]).map((r) => ({
    role: r.role,
    content: JSON.parse(r.content_json),
  }));
}

// ---------- chat items ----------
const toItem = (r: any): ChatItem => ({ id: r.id, kind: r.kind, payload: JSON.parse(r.payload_json), createdAt: r.created_at });
export function insertChatItem(kind: string, payload: any): ChatItem {
  const r = db.query("INSERT INTO chat_items(kind, payload_json, created_at) VALUES (?,?,?) RETURNING *").get(kind, JSON.stringify(payload), now());
  return toItem(r);
}
export function patchChatItem(id: number, payload: any): ChatItem {
  db.query("UPDATE chat_items SET payload_json=? WHERE id=?").run(JSON.stringify(payload), id);
  return toItem(db.query("SELECT * FROM chat_items WHERE id=?").get(id));
}
export const listChatItems = () => (db.query("SELECT * FROM chat_items ORDER BY id").all() as any[]).map(toItem);

// ---------- knowledge ----------
const toPage = (r: any): KnowledgePage => ({
  slug: r.slug, emoji: r.emoji, title: r.title, markdown: r.markdown, position: r.position, updatedAt: r.updated_at,
});
export const listKnowledge = () => (db.query("SELECT * FROM knowledge_pages ORDER BY position").all() as any[]).map(toPage);
export const getKnowledge = (slug: string) => {
  const r = db.query("SELECT * FROM knowledge_pages WHERE slug=?").get(slug);
  return r ? toPage(r) : null;
};
export function upsertKnowledge(p: { slug: string; emoji: string; title: string; markdown: string }) {
  const slug = slugify(p.slug || p.title, "page");
  const cur = getKnowledge(slug);
  if (cur) {
    db.query("UPDATE knowledge_pages SET emoji=?, title=?, markdown=?, updated_at=? WHERE slug=?").run(p.emoji, p.title, p.markdown, now(), slug);
  } else {
    const pos = ((db.query("SELECT MAX(position) m FROM knowledge_pages").get() as any).m ?? -1) + 1;
    db.query("INSERT INTO knowledge_pages VALUES (?,?,?,?,?,?)").run(slug, p.emoji, p.title, p.markdown, pos, now());
  }
  return { page: getKnowledge(slug)!, created: !cur };
}

// ---------- apps ----------
const toApp = (r: any): App => ({
  slug: r.slug, name: r.name, emoji: r.emoji, description: r.description, requirements: r.requirements,
  schema: r.schema_json ? JSON.parse(r.schema_json) : null, status: r.status, version: r.version, step: r.step,
  error: r.error, createdAt: r.created_at,
});
export const listApps = () => (db.query("SELECT * FROM apps ORDER BY created_at").all() as any[]).map(toApp);
export const getApp = (slug: string) => {
  const r = db.query("SELECT * FROM apps WHERE slug=?").get(slug);
  return r ? toApp(r) : null;
};
export function createApp(a: { name: string; emoji: string; description: string; requirements: string }): App {
  const base = slugify(a.name, "app");
  let slug = base;
  for (let i = 2; getApp(slug); i++) slug = `${base}-${i}`;
  db.query("INSERT INTO apps VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(
    slug, a.name, a.emoji, a.description, a.requirements, null, "generating", 0, "Designing your app", null, now(),
  );
  return getApp(slug)!;
}
export function patchApp(slug: string, p: Partial<Pick<App, "status" | "step" | "error" | "version" | "schema" | "requirements">>) {
  const cur = getApp(slug)!;
  const n = { ...cur, ...p };
  db.query("UPDATE apps SET status=?, step=?, error=?, version=?, schema_json=?, requirements=? WHERE slug=?").run(
    n.status, n.step, n.error, n.version, n.schema ? JSON.stringify(n.schema) : null, n.requirements, slug,
  );
  return getApp(slug)!;
}

// ---------- records ----------
const toRec = (r: any): Rec => ({ ...JSON.parse(r.data_json), id: r.id, createdAt: r.created_at, updatedAt: r.updated_at });
export const listRecords = (app: string, coll: string) =>
  (db.query("SELECT * FROM records WHERE app=? AND collection=? ORDER BY created_at, rowid").all(app, coll) as any[]).map(toRec);
export const getRecord = (app: string, coll: string, id: string) => {
  const r = db.query("SELECT * FROM records WHERE app=? AND collection=? AND id=?").get(app, coll, id);
  return r ? toRec(r) : null;
};
function clean(data: any) {
  const { id, createdAt, updatedAt, ...rest } = data ?? {};
  return rest;
}
export function insertRecord(app: string, coll: string, data: any, id?: string): Rec {
  const rid = id || data?.id || crypto.randomUUID();
  const t = now();
  db.query("INSERT INTO records VALUES (?,?,?,?,?,?)").run(app, coll, String(rid), JSON.stringify(clean(data)), t, t);
  return getRecord(app, coll, String(rid))!;
}
export function updateRecord(app: string, coll: string, id: string, patch: any): Rec | null {
  const cur = getRecord(app, coll, id);
  if (!cur) return null;
  const merged = { ...clean(cur), ...clean(patch) };
  db.query("UPDATE records SET data_json=?, updated_at=? WHERE app=? AND collection=? AND id=?").run(JSON.stringify(merged), now(), app, coll, id);
  return getRecord(app, coll, id);
}
export const deleteRecord = (app: string, coll: string, id: string) =>
  db.query("DELETE FROM records WHERE app=? AND collection=? AND id=?").run(app, coll, id);
export const countRecords = (app: string, coll: string) =>
  (db.query("SELECT COUNT(*) c FROM records WHERE app=? AND collection=?").get(app, coll) as any).c as number;

// ---------- people ----------
const toPerson = (r: any): Person => ({
  id: r.id, kind: r.kind, name: r.name, role: r.role, emoji: r.emoji, color: r.color, instructions: r.instructions,
  connectors: JSON.parse(r.connectors_json || "[]"), status: r.status, createdAt: r.created_at,
});
export const listPeople = () => (db.query("SELECT * FROM people ORDER BY kind ASC, created_at").all() as any[]).map(toPerson);
export const getPerson = (id: string) => {
  const r = db.query("SELECT * FROM people WHERE id=?").get(id);
  return r ? toPerson(r) : null;
};
export function createAiPerson(p: { name: string; role: string; emoji: string; color: string; instructions: string; connectors: string[] }) {
  const base = slugify(p.name, "employee");
  let id = base;
  for (let i = 2; getPerson(id); i++) id = `${base}-${i}`;
  db.query("INSERT INTO people VALUES (?,?,?,?,?,?,?,?,?,?)").run(
    id, "ai", p.name, p.role, p.emoji, p.color, p.instructions, JSON.stringify(p.connectors), "idle", now(),
  );
  return getPerson(id)!;
}
export const setPersonStatus = (id: string, status: string) => db.query("UPDATE people SET status=? WHERE id=?").run(status, id);

// ---------- activity ----------
export type Activity = { id: number; personId: string; text: string; createdAt: number };
export function addActivity(personId: string, text: string): Activity {
  const r = db.query("INSERT INTO activity(person_id, text, created_at) VALUES (?,?,?) RETURNING *").get(personId, text, now()) as any;
  return { id: r.id, personId: r.person_id, text: r.text, createdAt: r.created_at };
}
export const listActivity = () =>
  (db.query("SELECT * FROM activity ORDER BY id DESC LIMIT 500").all() as any[]).map((r) => ({
    id: r.id, personId: r.person_id, text: r.text, createdAt: r.created_at,
  })) as Activity[];

// ---------- connectors ----------
export const listConnectors = () =>
  (db.query("SELECT * FROM connectors").all() as any[]).map((r) => ({ provider: r.provider, account: r.account, connectedAt: r.connected_at }));
export const isConnected = (provider: string) => !!db.query("SELECT 1 FROM connectors WHERE provider=?").get(provider);
export const connect = (provider: string, account: string) =>
  db.query("INSERT OR REPLACE INTO connectors VALUES (?,?,?)").run(provider, account, now());

// ---------- mock inbox ----------
export type Email = { id: string; fromName: string; fromAddr: string; subject: string; body: string; receivedAt: number };
const toEmail = (r: any): Email => ({ id: r.id, fromName: r.from_name, fromAddr: r.from_addr, subject: r.subject, body: r.body, receivedAt: r.received_at });
export const listEmails = () => (db.query("SELECT * FROM emails ORDER BY received_at DESC").all() as any[]).map(toEmail);
export const getEmail = (id: string) => {
  const r = db.query("SELECT * FROM emails WHERE id=?").get(id);
  return r ? toEmail(r) : null;
};
export const isProcessed = (id: string) => !!db.query("SELECT 1 FROM processed_emails WHERE message_id=?").get(id);
export const markProcessed = (id: string, personId: string) =>
  db.query("INSERT OR IGNORE INTO processed_emails VALUES (?,?)").run(id, personId);

export function snapshot() {
  return {
    mock: MOCK,
    knowledge: listKnowledge(),
    apps: listApps(),
    people: listPeople(),
    connectors: listConnectors(),
    activity: listActivity(),
    chat: listChatItems(),
  };
}
