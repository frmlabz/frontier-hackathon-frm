import { create } from "zustand";
import type { Activity, App, ChatItem, KnowledgePage, Person } from "../server/db";
import type { BusEvent } from "../server/bus";

export type { Activity, App, ChatItem, KnowledgePage, Person };
export type Connector = { provider: string; account: string; connectedAt: number };

type State = {
  loaded: boolean;
  mock: boolean;
  model: string;
  online: boolean;
  knowledge: KnowledgePage[];
  apps: App[];
  people: Person[];
  connectors: Connector[];
  activity: Activity[];
  chat: ChatItem[];
  /** Text of the CEO reply currently streaming in. */
  live: string;
  /** React key shared by the live bubble and the chat item that replaces it (keeps the reveal smooth). */
  liveKey: number;
  itemKeys: Record<number, string>;
  busy: boolean;
  unread: boolean;
  path: string;
  /** Things that just appeared/changed: key → timestamp, for fade-in / highlight animations. */
  fresh: Record<string, number>;
};

export const useStore = create<State>(() => ({
  loaded: false,
  mock: false,
  model: "",
  online: true,
  knowledge: [],
  apps: [],
  people: [],
  connectors: [],
  activity: [],
  chat: [],
  live: "",
  liveKey: 1,
  itemKeys: {},
  busy: false,
  unread: false,
  path: location.pathname,
  fresh: {},
}));

const set = useStore.setState;
const get = useStore.getState;

export const isFresh = (key: string, ms = 4000) => {
  const t = get().fresh[key];
  return !!t && Date.now() - t < ms;
};
const markFresh = (keys: string[]) => {
  const now = Date.now();
  set((s) => ({ fresh: { ...s.fresh, ...Object.fromEntries(keys.map((k) => [k, now])) } }));
};

// ---------- navigation ----------
export function navigate(path: string) {
  if (path === location.pathname) return;
  history.pushState(null, "", path);
  set({ path, ...(path === "/" ? { unread: false } : {}) });
  document.querySelector("[data-scroll-root]")?.scrollTo({ top: 0 });
}
window.addEventListener("popstate", () => set({ path: location.pathname, ...(location.pathname === "/" ? { unread: false } : {}) }));

// ---------- data ----------
let firstLoad = true;
let refreshSeq = 0;
let appliedSeq = 0;
export async function refresh() {
  const seq = ++refreshSeq;
  const r = await fetch("/api/state").catch(() => null);
  if (!r?.ok) return;
  const s = await r.json();
  if (seq < appliedSeq) return; // a newer snapshot was already applied
  appliedSeq = seq;
  const prev = get();
  if (!firstLoad) {
    const newKeys = [
      ...s.knowledge.filter((k: KnowledgePage) => !prev.knowledge.some((p) => p.slug === k.slug)).map((k: KnowledgePage) => `k:${k.slug}`),
      ...s.apps.filter((a: App) => !prev.apps.some((p) => p.slug === a.slug)).map((a: App) => `a:${a.slug}`),
      ...s.people.filter((a: Person) => !prev.people.some((p) => p.id === a.id)).map((a: Person) => `p:${a.id}`),
    ];
    if (newKeys.length) markFresh(newKeys);
  }
  firstLoad = false;
  set({
    loaded: true,
    mock: s.mock,
    model: s.model,
    knowledge: s.knowledge,
    apps: s.apps,
    people: s.people,
    connectors: s.connectors,
    activity: s.activity,
    ...(prev.loaded ? {} : { busy: !!s.busy }),
    // Chat history only on first load; afterwards the socket is the source of truth (avoids clobbering the live bubble).
    ...(prev.loaded ? {} : { chat: s.chat }),
  });
}

/** Re-sync chat after a (re)connect (missed events). */
let chatEvents = 0;
async function resyncChat() {
  const seen = chatEvents;
  const r = await fetch("/api/state").catch(() => null);
  if (!r?.ok) return;
  const s = await r.json();
  if (seen === chatEvents) return set({ chat: s.chat, live: "", busy: !!s.busy });
  // Events arrived meanwhile: the socket is newer than the snapshot, so only add what we missed.
  set((cur) => ({ chat: [...s.chat, ...cur.chat.filter((c) => !s.chat.some((x: ChatItem) => x.id === c.id))] }));
}

/** Forward record changes into matching app iframes. */
/** Tell app iframes a collection changed. app "*" / collection "*" = everything (used after a reconnect). */
export function forwardRecords(app: string, collection: string) {
  document.querySelectorAll<HTMLIFrameElement>(app === "*" ? "iframe[data-app]" : `iframe[data-app="${CSS.escape(app)}"]`).forEach((f) => {
    f.contentWindow?.postMessage({ type: "bos:records", collection }, location.origin);
  });
}

export function handle(ev: BusEvent) {
  if (ev.type.startsWith("chat.") || ev.type === "ceo.busy") chatEvents++;
  switch (ev.type) {
    case "chat.delta":
      set((s) => ({ live: s.live + ev.text }));
      break;
    case "chat.item": {
      const item = ev.item as ChatItem;
      set((s) => {
        if (s.chat.some((c) => c.id === item.id)) return {};
        const patch: Partial<State> = { chat: [...s.chat, item] };
        if (item.kind === "ceo") {
          patch.itemKeys = { ...s.itemKeys, [item.id]: `live-${s.liveKey}` };
          patch.liveKey = s.liveKey + 1;
          patch.live = "";
        }
        if (item.kind !== "user" && s.path !== "/") patch.unread = true;
        return patch;
      });
      break;
    }
    case "chat.itemUpdated":
      set((s) => ({ chat: s.chat.map((c) => (c.id === ev.item.id ? (ev.item as ChatItem) : c)) }));
      break;
    case "ceo.busy":
      set({ busy: ev.busy });
      break;
    case "app.status": {
      const known = get().apps.some((a) => a.slug === ev.slug);
      if (!known) return void refresh();
      set((s) => ({
        apps: s.apps.map((a) => (a.slug === ev.slug ? { ...a, status: ev.status, step: ev.step, version: ev.version, error: ev.error ?? null } : a)),
      }));
      break;
    }
    case "records.changed":
      forwardRecords(ev.app, ev.collection);
      break;
    case "activity.add":
      set((s) => ({ activity: [{ id: ev.id, personId: ev.personId, text: ev.text, createdAt: ev.createdAt }, ...s.activity] }));
      break;
    case "knowledge.changed":
      markFresh([`k:${ev.slug}`, `kc:${ev.slug}`]);
      void refresh();
      break;
    case "state.changed":
      void refresh();
      break;
  }
}

// ---------- actions ----------
export async function sendChat(text: string) {
  const t = text.trim();
  if (!t) return false;
  const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: t }) });
  return r.ok;
}

export async function connectGmail() {
  const r = await fetch("/api/connectors/gmail/connect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ account: "marko@markosbistro.com" }) });
  return r.ok;
}

/** Stretch A: save an edited spec; the server regenerates the app if a block that drives it changed. */
export async function saveSpec(slug: string, markdown: string): Promise<{ ok: boolean; message: string }> {
  const r = await fetch(`/api/apps/${slug}/spec`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ markdown }) }).catch(() => null);
  const j = await r?.json().catch(() => null);
  if (r?.ok) await refresh();
  return { ok: !!r?.ok, message: j?.message ?? "Couldn't save the spec." };
}

export { resyncChat };
