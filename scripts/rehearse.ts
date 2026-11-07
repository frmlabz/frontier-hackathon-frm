// Drives the §12 demo script against a running server over HTTP and checks the outcome of each step.
// Usage: bun scripts/rehearse.ts [baseUrl] [--step5] [--step6]  (step 6 implies 5)
// Start from a fresh DB (bun run reset). Works for mock and real models; real runs take a few minutes.
const BASE = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3000";
const STEP6 = process.argv.includes("--step6");
const STEP5 = STEP6 || process.argv.includes("--step5");
const t0 = Date.now();
/** The app's main collection: the one with the most rows (an app may also keep e.g. a suppliers list). */
async function mainColl(app: any): Promise<string | undefined> {
  let best: string | undefined, n = -1;
  for (const c of app?.schema ?? []) {
    const rows = await (await fetch(`${BASE}/api/apps/${app.slug}/${c.name}`)).json();
    if (rows.length > n) [best, n] = [c.name, rows.length];
  }
  return best;
}
const log = (...a: any[]) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s]`, ...a);

const state = async () => (await fetch(`${BASE}/api/state`)).json() as Promise<any>;
const post = (path: string, body: any) => fetch(`${BASE}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function until<T>(what: string, fn: (s: any) => T | undefined | false, timeoutS = 300): Promise<T> {
  const end = Date.now() + timeoutS * 1000;
  while (Date.now() < end) {
    const s = await state();
    const v = fn(s);
    if (v) return v;
    await Bun.sleep(700);
  }
  throw new Error(`timeout waiting for: ${what}`);
}

let failures = 0;
function check(ok: unknown, msg: string) {
  if (ok) log("  ✓", msg);
  else {
    failures++;
    log("  ✗", msg);
  }
}

async function say(text: string) {
  const before = (await state()).chat.length;
  log("you:", text);
  await post("/api/chat", { text });
  await until("CEO starts", (s) => s.busy || s.chat.length > before + 1, 30);
  await until("CEO idle", (s) => !s.busy, 400);
  const s = await state();
  for (const c of s.chat.slice(before + 1)) {
    if (c.kind === "ceo") log("ceo:", c.payload.text.replace(/\s+/g, " ").slice(0, 220));
    else log(`[${c.kind}]`, JSON.stringify(c.payload).slice(0, 140));
  }
  return s;
}

const inv = (s: any) => s.apps.find((a: any) => /inventor|stock/i.test(a.name));

// ---- 1. empty hub
let s = await state();
log(`model ${s.model}${s.mock ? " (mock)" : ""}`);
check(s.chat.length === 0 && s.apps.length === 0, "fresh DB: empty chat, no apps");

// ---- 2. company context → knowledge pages
await say("I run a small Mediterranean bistro with 8 people.");
await say("Suppliers: Adriatic Fresh Produce for veg, Kalamata Imports for olive oil and feta, Novak Butchers for meat, Mlin for flour. They all send invoices by email.");
s = await say("Biggest pain is stock. We track it in a paper notebook, nobody updates it, and we keep running out of tomatoes and feta. We use tomatoes, feta, olive oil, flour, lemons, chicken, lamb, basil.");
check(s.knowledge.length >= 2, `knowledge pages created (${s.knowledge.map((k: any) => k.title).join(", ")})`);

// ---- 3. inventory app (§12: the CEO proposes it and waits for a yes)
check(!inv(s), "CEO proposed the app and waited for a yes");
if (!inv(s)) s = await say("Yes, build that.");
if (!inv(s)) s = await say("Yes please, build the Inventory app now.");
const app = inv(s);
check(app, `inventory app created (${app?.name})`);
if (app) {
  const done = await until("inventory built", (x) => {
    const a = x.apps.find((y: any) => y.slug === app.slug);
    return a && (a.status === "ready" || a.status === "failed") && a;
  }, 600);
  check(done.status === "ready" && done.version >= 1, `inventory ready v${done.version} ${done.error ?? ""}`);
  const html = await fetch(`${BASE}/apps/${app.slug}/`);
  check(html.ok, "iframe html served");
  const coll = await mainColl(done);
  const recs = coll ? await (await fetch(`${BASE}/api/apps/${app.slug}/${coll}`)).json() : [];
  check(recs.length >= 3, `seeded ${recs.length} records in ${coll}`);
}

// ---- 4. hire + gmail + run
s = await say("I need someone to pull supplier invoices from Gmail and update stock.");
const hire = s.people.find((p: any) => p.kind === "ai");
check(hire, `AI employee hired (${hire?.name})`);
check(s.chat.some((c: any) => c.kind === "connector_card"), "connector card shown");
if (!s.chat.some((c: any) => c.kind === "connector_card") && hire) s = await say("Yes, go ahead and connect Gmail for them.");
const appNow = inv(s);
const coll = await mainColl(appNow);
const before = coll ? await (await fetch(`${BASE}/api/apps/${appNow.slug}/${coll}`)).json() : [];
log("clicking Connect Gmail");
await post("/api/connectors/gmail/connect", { account: "marko@markosbistro.com" });
await until("employee starts", (x) => x.people.some((p: any) => p.kind === "ai" && p.status === "working"), 120).catch(() => null);
await until("employee finishes", (x) => !x.people.some((p: any) => p.status === "working") && !x.busy, 600);
s = await state();
const acts = s.activity.filter((a: any) => a.personId === hire?.id);
check(acts.length >= 3, `activity feed has ${acts.length} lines`);
const after = coll ? await (await fetch(`${BASE}/api/apps/${appNow.slug}/${coll}`)).json() : [];
const changed = after.filter((r: any) => {
  const b = before.find((x: any) => x.id === r.id);
  return !b || JSON.stringify(b) !== JSON.stringify(r);
});
check(changed.length >= 3, `inventory changed: ${changed.length} rows (${after.length} total)`);
const qtyKey = Object.keys(after[0] ?? {}).find((k) => /quantit|stock|qty|on_hand/i.test(k));
const tom = after.filter((r: any) => /tomato/i.test(JSON.stringify(r)));
check(tom.length <= 1, `no duplicate tomato rows (${tom.length})`);
if (qtyKey) log("  tomatoes:", tom.map((r: any) => `${r[qtyKey]}`).join(","));
for (const a of acts.slice().reverse()) log("   ·", a.text.slice(0, 140));

// ---- 5. update app (P1)
if (STEP5 && appNow) {
  const v = (await state()).apps.find((a: any) => a.slug === appNow.slug).version;
  await say("Add a reorder note column to Inventory.");
  const done = await until("rebuild", (x) => {
    const a = x.apps.find((y: any) => y.slug === appNow.slug);
    return a && a.version > v && a.status === "ready" ? a : a?.status === "ready" && a.error ? a : undefined;
  }, 600);
  check(done.version > v, `rebuilt to v${done.version} ${done.error ?? ""}`);
  const kept = await (await fetch(`${BASE}/api/apps/${appNow.slug}/${coll}`)).json();
  check(kept.length >= after.length, `data preserved (${kept.length} rows)`);
}

// ---- 6. photo import (Stretch B): the CEO adds it to the spec, then the app's ai.extract reads the fixture invoice
if (STEP6 && appNow) {
  const v = (await state()).apps.find((a: any) => a.slug === appNow.slug).version;
  await say("Some suppliers hand me paper invoices. I'd like to drop a photo of one into Inventory and have the stock update.");
  const done = await until("photo rebuild", (x) => {
    const a = x.apps.find((y: any) => y.slug === appNow.slug);
    return a && a.version > v && a.status === "ready" ? a : a?.status === "ready" && a.error ? a : undefined;
  }, 600);
  check(done.version > v && /photo|image|picture/i.test(done.spec ?? ""), `rebuilt to v${done.version} with a photo block in the spec`);
  const file = Buffer.from(await Bun.file(new URL("../fixtures/invoice/invoice-photo.png", import.meta.url)).arrayBuffer()).toString("base64");
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/ai/extract`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ file, mediaType: "image/png", app: appNow.slug, instructions: 'A supplier invoice. Return {"supplier": string, "invoiceNumber": string, "lines": [{"name": string, "quantity": number, "unit": string}]}' }),
  });
  const x: any = await r.json();
  log("  extract:", JSON.stringify(x).slice(0, 300), `(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  const tomLine = (x.lines ?? []).find((l: any) => /tomato/i.test(l.name));
  check(r.ok && x.lines?.length === 4, "extract read 4 lines");
  check(tomLine?.name === "Tomatoes" && tomLine?.quantity === 8, "tomatoes matched to the existing record (8 kg)");
}

log(failures ? `FAILED: ${failures} check(s)` : "ALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
