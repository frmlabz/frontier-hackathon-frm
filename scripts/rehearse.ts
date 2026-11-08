// Drives the §12 demo script against a running server over HTTP and checks the outcome of each step.
// Usage: bun scripts/rehearse.ts [baseUrl] [--step5] [--step6] [--gmail-first] [--jump]  (step 6 implies 5)
//   --gmail-first  connect Gmail from the Connectors page before the hire (the employee should start at once)
//   --jump         the jump-ahead scenario instead: "Just build me an inventory app" → research first, app after the report
// Start from a fresh DB (bun run reset). Works for mock and real models; real runs take a few minutes.
const BASE = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3000";
const STEP6 = process.argv.includes("--step6");
const STEP5 = STEP6 || process.argv.includes("--step5");
const GMAIL_FIRST = process.argv.includes("--gmail-first");
const JUMP = process.argv.includes("--jump");
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
const ceoTexts = (s: any) => s.chat.filter((c: any) => c.kind === "ceo").map((c: any) => String(c.payload.text));
const reportCards = (s: any) => s.chat.filter((c: any) => c.kind === "report_card").length;

/** Waits for the running report to finish and for the CEO reply its [event] starts (which may already have landed). */
async function awaitReport() {
  const r = await until("report finishes", (x) => x.reports.length && x.reports.every((r: any) => r.status !== "researching") && x.reports.at(-1), 400);
  log(`  report ${r.status}: ${r.report?.title ?? r.error}`);
  const s = await until("CEO replies to the report", (x) => !x.busy && x.chat.some((c: any) => c.kind === "ceo" && c.createdAt >= r.updatedAt) && x, 400);
  log("ceo:", ceoTexts(s).at(-1).replace(/\s+/g, " ").slice(0, 260));
  return s;
}

const MSG_INTRO = "I run a small Mediterranean bistro. Ana is my head chef, Luka is sous-chef, Jovan and Mila are line cooks, Sara, Nikola and Tea wait tables, and Petar manages the place.";
const MSG_STOCK = "Adriatic Fresh Produce for veg, Kalamata Imports for olive oil and feta, Novak Butchers for meat, Mlin for flour. Right now we have 4 kg tomatoes (need 10), 2 kg feta (need 5), 6 L olive oil (need 10), 3 kg lemons (need 4), 2 bunches of basil (need 5), 1.5 kg garlic (need 1), 4 kg Kalamata olives (need 2), 5 kg chicken thighs (need 8), 3 kg lamb shoulder (need 4), 18 kg flour (need 10), 3 kg arborio rice (need 5) and 4 kg sea salt (need 2).";
/** An app proposal or an offer to set something up, during discovery. */
const PROPOSES = /\b(app|set (it|this|that|one) up|build)\b/i;

// ---- 1. empty hub
let s = await state();
log(`model ${s.model}${s.mock ? " (mock)" : ""}`);
check(s.chat.length === 0 && s.apps.length === 0, "fresh DB: empty chat, no apps");

if (JUMP) {
  // ---- jump-ahead: a direct request for the app goes through research first; the request itself is the yes
  await say(MSG_INTRO);
  s = await say("Just build me an inventory app.");
  check(s.reports.length === 1 && reportCards(s) === 1, `research_roi called, one report card (${s.reports.length})`);
  check(!inv(s), "no app before the report");
  s = await awaitReport();
  if (!inv(s)) {
    check(/supplier|stock|how much/i.test(ceoTexts(s).at(-1)), "after the report the CEO asks for setup details, not a second yes");
    s = await say(MSG_STOCK);
  }
} else {
  // ---- 2. discovery: business, pain, sizing → research (no app, hire or proposal)
  await say(MSG_INTRO);
  await say("The hardest part is inventory management and intake. We track stock in a paper notebook that nobody keeps up to date, so we run out of tomatoes and feta mid-service. Deliveries come in all week, the invoices arrive by email, and someone has to copy them into the notebook by hand.");
  s = await say("Petar spends about 5 hours a week copying invoices, and we run out of something two or three times a week. We do around 120 covers a day and spend about €9,000 a month on food.");
  check(s.knowledge.length >= 2, `knowledge pages created (${s.knowledge.map((k: any) => k.title).join(", ")})`);
  check(!inv(s) && !s.people.some((p: any) => p.kind === "ai"), "no app or AI person after messages 1–3");
  const proposals = ceoTexts(s).filter((t: string) => PROPOSES.test(t));
  check(!proposals.length, `no app proposal during discovery${proposals.length ? `: "${proposals[0].slice(0, 120)}"` : ""}`);
  check(reportCards(s) === 1 && s.reports.length === 1, `exactly one report card (${reportCards(s)})`);
  s = await awaitReport();
  const rec = ceoTexts(s).at(-1);
  check(/inventor/i.test(rec) && rec.trim().endsWith("?"), "the CEO recommends Inventory as a question");
  check(!inv(s), "nothing built on the report alone");

  // ---- 3. inventory app (§12: the choice holds while the CEO gathers stock; no second yes)
  s = await say("Yes, let's start with that.");
  check(!inv(s) && /supplier|stock/i.test(ceoTexts(s).at(-1)) && ceoTexts(s).at(-1).includes("?"), "the CEO asks about suppliers and stock");
  if (!inv(s)) s = await say(MSG_STOCK);
}
const app = inv(s);
check(app, `inventory app created without a second yes (${app?.name})`);
if (JUMP) check(app && app.createdAt >= (s.reports[0]?.updatedAt ?? Infinity), "the app was created after the report finished");
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

if (JUMP) {
  log(failures ? `FAILED: ${failures} check(s)` : "ALL CHECKS PASSED");
  process.exit(failures ? 1 : 0);
}

// ---- 4. hire + gmail + run
const appNow = inv(await state());
const coll = await mainColl(appNow);
const before = coll ? await (await fetch(`${BASE}/api/apps/${appNow.slug}/${coll}`)).json() : [];
const connectGmail = () => post("/api/connectors/gmail/connect", { account: "marko@markosbistro.com" });
if (GMAIL_FIRST) {
  log("connecting Gmail from the Connectors page");
  const n = ceoTexts(await state()).length;
  await connectGmail();
  await Bun.sleep(1500);
  const x = await state();
  check(!x.busy && ceoTexts(x).length === n, "connecting from the page adds no CEO turn");
}
s = await say("I need someone to pull supplier invoices from Gmail and update stock.");
const hire = s.people.find((p: any) => p.kind === "ai");
check(hire, `AI employee hired (${hire?.name})`);
if (GMAIL_FIRST) {
  check(!s.chat.some((c: any) => c.kind === "connector_card"), "Gmail already connected: no connector card");
} else {
  check(s.chat.some((c: any) => c.kind === "connector_card"), "connector card shown");
  log("clicking Connect Gmail");
  await connectGmail();
}
await until("employee starts", (x) => x.people.some((p: any) => p.kind === "ai" && (p.status === "working" || x.activity.some((a: any) => a.personId === p.id))), 120).catch(() => null);
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
{
  // A repeat connect is a no-op: no second event line and no CEO turn (the pending task was consumed once).
  const x0 = await state();
  const events = (x: any) => x.chat.filter((c: any) => c.kind === "event" && /Gmail connected/.test(c.payload.text)).length;
  await connectGmail();
  await Bun.sleep(1500);
  const x1 = await state();
  check(events(x1) === events(x0) && events(x1) === 1 && ceoTexts(x1).length === ceoTexts(x0).length && !x1.busy, "repeat connect: no duplicate event, no CEO turn");
  check(x1.activity.filter((a: any) => a.personId === hire?.id && /^Started:/.test(a.text)).length === 1, "the employee ran once");
}

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
