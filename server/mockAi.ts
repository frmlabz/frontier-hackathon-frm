// BOS_MOCK=1: scripted CEO / builder / employee for free UX work. Everything else is the real code path.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getKnowledge, isConnected, listApps, listPeople, listRecords, listReports, kv, type App, type Person } from "./db";
import type { BuildOutput } from "./builder";
import type { Job } from "./ceo";
import { addSpecBlock } from "./spec";
import { strongestFinding, validateReport, type ResearchRequest, type Submission, type Validated } from "./report";
import reportFixture from "../fixtures/research/report.json";
import demoRequest from "../fixtures/research/request.json";

const ROOT = resolve(import.meta.dir, "..");
const sleep = (ms: number) => Bun.sleep(ms);

// ---------- builder ----------
export async function mockGenerate(app: App, onWriting: () => void): Promise<BuildOutput> {
  await sleep(1800);
  onWriting();
  await sleep(2600);
  const key = existsSync(`${ROOT}/fixtures/apps/${app.slug}/App.tsx`) ? app.slug : /inventor|stock/i.test(app.name) ? "inventory" : "generic";
  // The photo-import variant once the spec asks for it (Stretch B).
  const variant = key === "inventory" && /photo/i.test(app.spec ?? "") ? "App.photo.tsx" : "App.tsx";
  let code = readFileSync(`${ROOT}/fixtures/apps/${key}/${variant}`, "utf8");
  const meta = JSON.parse(readFileSync(`${ROOT}/fixtures/apps/${key}/meta.json`, "utf8"));
  if (key === "generic") code = code.replace('emoji="📋" title="Tracker"', `emoji=${JSON.stringify(app.emoji)} title=${JSON.stringify(app.name)}`);
  return { code, collections: meta.collections, seed: meta.seed };
}

// ---------- CEO ----------
type Ctx = { say: (text: string) => Promise<void>; tool: (name: string, input: any) => { text: string; isError?: boolean } };
const has = (re: RegExp, s: string) => re.test(s.toLowerCase());

const PROFILE = `**Marko's Bistro** is a small Mediterranean bistro run by Marko.

## At a glance
- **Cuisine:** Mediterranean
- **Team:** 8 people (see Team)`;

const SUPPLIERS = `| Supplier | What they deliver |
|---|---|
| Adriatic Fresh Produce | Vegetables |
| Kalamata Imports | Olive oil, feta |
| Novak Butchers | Meat |
| Mlin | Flour |

Deliveries come in through the week; invoices arrive by email.`;

const PAIN = `## 🔥 Inventory management and intake
- Stock is tracked in a paper notebook that nobody keeps up to date
- Tomatoes and feta run out mid-service
- Deliveries come in all week; invoices arrive by email and are copied into the notebook by hand`;

const NUMBERS = `

## By the numbers
| What | Marko's number |
|---|---|
| Copying invoices (Petar) | about 5 h/week |
| Running out of something | 2–3 times/week |
| Covers | about 120/day |
| Food spend | about €9,000/month |`;

const YES = /^(yes|yeah|yep|sure|ok|okay|do it|go ahead|sounds good|let'?s)\b/;

/** Scripted CEO, in demo order. Stage lives in kv mock:stage (chosen → await-stock) so later messages aren't keyword-swallowed. */
export async function mockCeoTurn(job: Job, { say, tool }: Ctx) {
  const t = job.text;
  await sleep(1200 + Math.random() * 400); // "Thinking" long enough to read as a real turn
  const apps = listApps();
  const inventory = apps.find((a) => /inventor/i.test(a.name));
  const assistant = listPeople().find((p) => p.kind === "ai");
  const stage = kv.get("mock:stage");
  const reports = listReports();

  // 1. Events.
  if (job.kind === "event") {
    if (has(/report ready/, t)) {
      const r = reports.findLast((x) => x.report);
      const rec = r?.report?.opportunities.find((o) => o.id === r.report!.recommendedOpportunityId)?.title ?? "Inventory";
      if (stage === "chosen") {
        kv.set("mock:stage", "await-stock");
        return say(`The report is in, and it backs starting with **${rec}**. Who are your suppliers, and how much of each ingredient do you have now against the minimum you need?`);
      }
      const top = r?.report ? strongestFinding(r.report) : null;
      if (r?.status === "thin" || !top) return say(`There's not much solid public data on this, so I won't pitch numbers. Want to start with **${rec}** anyway?`);
      const kind = top.kind === "study" ? "A study" : top.kind === "survey" ? "An industry survey" : top.kind === "news" ? "A news report" : "A vendor";
      return say(`${kind} found: ${top.finding.claim.replace(/\.$/, "")}. That's an average, not a promise for you. Want to start with **${rec}**?`);
    }
    if (has(/research failed/, t)) {
      kv.delete("mock:stage"); // a "yes" to going ahead is the choice
      return say("I couldn't finish the research this time. Want me to go ahead with **Inventory** without it?");
    }
    if (has(/connected .*pending task/, t)) {
      if (!assistant) return say("Gmail is connected.");
      const r = tool("run_employee", { person_id: assistant.id, task: t.replace(/^.*Pending task: /s, "") });
      if (r.isError) return say(`Gmail is connected, but **${assistant.name}** couldn't start yet.`);
      return say(`Gmail is connected. **${assistant.name}** is going through your supplier emails now — keep Inventory open and you'll see the stock change.`);
    }
    return;
  }

  // 2. App edits, photo import, hire.
  if (inventory && has(/photo|picture|paper invoice|scan/, t)) {
    const block = "Marko drops a photo of a paper invoice or delivery note. The app reads the lines, shows them for review (each matched to an existing :Ingredient: or marked new), and on confirm adds the delivered quantities to stock and adds new items.";
    tool("edit_app_spec", { slug: inventory.slug, markdown: addSpecBlock(inventory.spec, "invoice-photo-import", block), summary: "Import paper invoices from a photo" });
    return say("Good idea — I'm adding **Import invoice photo** to Inventory. Snap the invoice, drop it in, check the lines and the stock updates. Your data stays as it is.");
  }
  if (inventory && has(/column|add .*field|change|update the|rename/, t)) {
    const id = t.toLowerCase().replace(/^(please )?(add|change|update|rename)( an?| the)? /, "").replace(/ (column|field).*$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "change";
    tool("edit_app_spec", { slug: inventory.slug, markdown: addSpecBlock(inventory.spec, id, t), summary: t.replace(/\.$/, "") });
    return say("On it — I'm updating **Inventory**. Your data stays exactly as it is.");
  }
  if (inventory && has(/hire|assistant|need someone|employee|pull .*invoice/, t) && !assistant) {
    const r = tool("hire_employee", {
      name: "Purchasing Assistant", role: "Reads supplier invoices and keeps stock up to date", emoji: "🛒", color: "#2a9d99",
      instructions: `Search Gmail for supplier invoices. For each invoice, add the delivered quantities to the matching ingredient in the ${inventory.slug} app (collection "ingredients"), matching by name. Add missing ingredients. Skip anything that isn't an invoice.`,
      connectors: ["gmail"],
    });
    if (r.isError) return say("I couldn't hire them just yet.");
    const id = r.text.match(/person_id: (\S+)/)?.[1] ?? "purchasing-assistant";
    const task = `Run ${id}: import all unprocessed supplier invoices into Inventory.`;
    if (isConnected("gmail")) {
      const run = tool("run_employee", { person_id: id, task });
      if (!run.isError) return say("I've hired a **Purchasing Assistant** 🛒 and Gmail is already connected, so they're going through your supplier emails now.");
    }
    tool("request_connector", { provider: "gmail", reason: "So the Purchasing Assistant can read supplier invoices and update stock.", pending_task: task });
    return say("I've hired a **Purchasing Assistant** 🛒 to read supplier invoices and update stock. Connect Gmail and I'll put them to work right away.");
  }

  // 3. A choice after the report: ask for the setup details.
  if (!inventory && reports.some((r) => r.status !== "researching") && !stage && (has(YES, t.trim()) || has(/start with/, t))) {
    kv.set("mock:stage", "await-stock");
    return say("Great. To set up **Inventory**, who are your suppliers, and how much of each ingredient do you have now against the minimum you need?");
  }

  // 4. Stock numbers once he has chosen: build.
  if (!inventory && stage === "await-stock" && /\d/.test(t)) {
    if (has(/supplier|produce|butcher|imports/, t)) tool("upsert_knowledge_page", { slug: "suppliers", emoji: "🚚", title: "Suppliers", markdown: SUPPLIERS });
    const r = tool("build_app", { name: "Inventory", emoji: "🥫", description: "Live stock levels for every ingredient, with low-stock warnings.", spec: MOCK_SPEC });
    if (r.isError) return say("I couldn't start setting up Inventory just yet.");
    kv.delete("mock:stage");
    return say("Setting up **Inventory** now with your 12 ingredients, what you have of each and the minimum you need.");
  }

  // 5. Sizing numbers: Pain Points table, then research.
  if (!reports.length && getKnowledge("pain-points") && has(/hours?|€|covers|a week|a month/, t)) {
    tool("upsert_knowledge_page", { slug: "pain-points", emoji: "🔥", title: "Pain Points", markdown: PAIN + NUMBERS });
    tool("research_roi", demoRequest);
    return say("Thanks, that's what I needed. I'm looking at what similar places found when they fixed this; it takes about a minute.");
  }

  // 6. Jump-ahead: he asked for the app directly. That's his yes; research first anyway.
  if (!inventory && !reports.length && has(/\b(build|set up|make)\b/, t) && has(/inventor|stock/, t)) {
    kv.set("mock:stage", "chosen");
    tool("research_roi", { business: getKnowledge("company-profile") ? "small Mediterranean bistro" : "small business", location: null, pains: [t], inputs: [] });
    return say("Sure. First, a short look at what this could be worth for a place like yours.");
  }

  // 7. Pain: record it and ask one sizing question.
  if (has(/stock|notebook|inventory|intake|track|run out|ran out|mess/, t) && !inventory && !getKnowledge("pain-points")) {
    tool("upsert_knowledge_page", { slug: "pain-points", emoji: "🔥", title: "Pain Points", markdown: PAIN });
    return say("That notebook is costing you: things run out mid-service and every invoice gets copied in by hand. Roughly how many hours a week go into copying invoices, and how often do you run out of something?");
  }

  // 8. Intro.
  if (has(/restaurant|bistro|run a|cafe|kitchen|people/, t) && !getKnowledge("company-profile")) {
    tool("upsert_knowledge_page", { slug: "company-profile", emoji: "🏢", title: "Company Profile", markdown: PROFILE });
    if (has(/ana|chef/, t)) {
      tool("add_team_members", { members: MOCK_TEAM });
      return say("Lovely, a Mediterranean bistro, and I've added Ana, Luka and the rest of the team. How does a normal day run, and what's the hardest part?");
    }
    return say("Lovely — a Mediterranean bistro. Who works with you? Names and what they do is enough.");
  }
  if (has(/^(hi|hello|hey)/, t)) return say("Hi Marko! Tell me about the business — what do you run, and who's on the team?");
  if (reports.some((r) => r.report) && has(/numbers|worth|report/, t)) return say("The report is on the card above and under Knowledge in the sidebar. Want to start with **Inventory**?");
  return say("Noted. What else should I know — or is there something you'd like me to take off your plate?");
}

const MOCK_TEAM = [
  { name: "Ana", role: "Head chef", emoji: "👩‍🍳" }, { name: "Luka", role: "Sous-chef", emoji: "🧑‍🍳" },
  { name: "Jovan", role: "Line cook", emoji: "🍳" }, { name: "Mila", role: "Line cook", emoji: "🥘" },
  { name: "Sara", role: "Waits tables", emoji: "🍽️" }, { name: "Nikola", role: "Waits tables", emoji: "🍷" },
  { name: "Tea", role: "Waits tables", emoji: "☕" }, { name: "Petar", role: "Manager", emoji: "📋" },
];

const MOCK_SPEC = `## Definitions
- :Ingredient: — something the kitchen stocks; has name, category, quantity, unit, minimum and supplier.

## Functional specs
### list-ingredients
Marko sees every :Ingredient: in a table with a search box and a category filter.

### low-stock-alert
An :Ingredient: at or below its minimum shows a red "Low" badge and is counted in a "Low stock" stat.

### add-ingredient
Marko can add an :Ingredient: from an "Add item" form.

## Starter data
- Tomatoes: 4 kg, minimum 10 kg, from Adriatic Fresh Produce
- Lemons: 3 kg, minimum 4 kg, from Adriatic Fresh Produce
- Fresh basil: 2 bunch, minimum 5 bunch, from Adriatic Fresh Produce
- Garlic: 1.5 kg, minimum 1 kg, from Adriatic Fresh Produce
- Olive oil: 6 L, minimum 10 L, from Kalamata Imports
- Feta: 2 kg, minimum 5 kg, from Kalamata Imports
- Kalamata olives: 4 kg, minimum 2 kg, from Kalamata Imports
- Chicken thighs: 5 kg, minimum 8 kg, from Novak Butchers
- Lamb shoulder: 3 kg, minimum 4 kg, from Novak Butchers
- Flour type 400: 18 kg, minimum 10 kg, from Mlin Flour & Grains
- Arborio rice: 3 kg, minimum 5 kg, from Mlin Flour & Grains
- Sea salt: 4 kg, minimum 2 kg, from Mlin Flour & Grains

## Acceptance
- low-stock-alert: Tomatoes shows "Low".
- list-ingredients: Olive oil is listed.`;

// ---------- employee ----------
const INVOICE_LINES: Record<string, { name: string; qty: number; unit: string; category: string; supplier: string }[]> = {
  msg_7f3a01: [
    { name: "Tomatoes", qty: 12, unit: "kg", category: "Produce", supplier: "Adriatic Fresh Produce" },
    { name: "Lemons", qty: 6, unit: "kg", category: "Produce", supplier: "Adriatic Fresh Produce" },
    { name: "Fresh basil", qty: 10, unit: "bunch", category: "Herbs & spices", supplier: "Adriatic Fresh Produce" },
    { name: "Garlic", qty: 2, unit: "kg", category: "Produce", supplier: "Adriatic Fresh Produce" },
    { name: "Red onions", qty: 5, unit: "kg", category: "Produce", supplier: "Adriatic Fresh Produce" },
  ],
  msg_7f3a03: [
    { name: "Olive oil", qty: 20, unit: "L", category: "Oils & condiments", supplier: "Kalamata Imports" },
    { name: "Feta", qty: 8, unit: "kg", category: "Dairy", supplier: "Kalamata Imports" },
    { name: "Kalamata olives", qty: 3, unit: "kg", category: "Oils & condiments", supplier: "Kalamata Imports" },
  ],
  msg_7f3a05: [
    { name: "Chicken thighs", qty: 15, unit: "kg", category: "Meat", supplier: "Novak Butchers" },
    { name: "Lamb shoulder", qty: 6, unit: "kg", category: "Meat", supplier: "Novak Butchers" },
    { name: "Beef mince", qty: 4, unit: "kg", category: "Meat", supplier: "Novak Butchers" },
  ],
  msg_7f3a07: [
    { name: "Flour type 400", qty: 25, unit: "kg", category: "Dry goods", supplier: "Mlin Flour & Grains" },
    { name: "Arborio rice", qty: 10, unit: "kg", category: "Dry goods", supplier: "Mlin Flour & Grains" },
    { name: "Dried oregano", qty: 0.5, unit: "kg", category: "Herbs & spices", supplier: "Mlin Flour & Grains" },
    { name: "Sea salt", qty: 3, unit: "kg", category: "Herbs & spices", supplier: "Mlin Flour & Grains" },
  ],
};

export async function mockEmployeeRun(p: Person, tool: (name: string, input: any) => any): Promise<string> {
  const app = listApps().find((a) => /inventor/i.test(a.name));
  await sleep(900);
  const results: any = tool("gmail_search", { query: "invoice delivery", max: 10 });
  if (results?.error) return "Gmail was disconnected, so I stopped before reading any invoices.";
  const applied: string[] = [];
  let invoices = 0;
  for (const r of results) {
    await sleep(1100);
    const msg = tool("gmail_read", { id: r.id });
    if (msg?.error) return `Gmail was disconnected, so I stopped after ${invoices} invoice${invoices === 1 ? "" : "s"}.`;
    const lines = INVOICE_LINES[r.id];
    if (!lines || !app) {
      await sleep(500);
      tool("log", { text: `Skipped “${msg.subject}” — not a supplier invoice` });
      tool("mark_processed", { message_id: r.id });
      continue;
    }
    invoices++;
    const current = listRecords(app.slug, "ingredients");
    for (const l of lines) {
      await sleep(650);
      const ex = current.find((c: any) => String(c.name).toLowerCase() === l.name.toLowerCase());
      if (ex) tool("upsert_records", { app: app.slug, collection: "ingredients", records: [{ id: ex.id, quantity: Number(ex.quantity ?? 0) + l.qty }] });
      else tool("upsert_records", { app: app.slug, collection: "ingredients", records: [{ name: l.name, category: l.category, quantity: l.qty, unit: l.unit, supplier: l.supplier }] });
      if (applied.length < 3) applied.push(`+${l.qty} ${l.unit} ${l.name.toLowerCase()}`);
    }
    tool("mark_processed", { message_id: r.id });
  }
  const total = Object.entries(INVOICE_LINES).filter(([id]) => results.some((r: any) => r.id === id)).reduce((n, [, l]) => n + l.length, 0);
  if (!invoices) return "No new supplier invoices in Gmail — stock is up to date.";
  return `Imported ${invoices} supplier invoices: ${applied.join(", ")}${total > applied.length ? ` and ${total - applied.length} more items` : ""}.`;
}

// ---------- research ----------
const RESEARCH_LINES: [string, number][] = [
  ["Searching: restaurant kitchen food waste reduction study return on investment", 9],
  ["Reading champions123.org", 10],
  ["Searching: foodservice food waste share of purchases", 17],
  ["Reading info.leanpath.com", 18],
  ["Searching: manual vs automated invoice processing per FTE benchmark", 24],
];

/** Streams fake progress for ~6 s, then runs the hand-checked fixture through the real validation with the request's inputs. */
export async function mockResearch(request: ResearchRequest, onProgress: (p: { lines: string[]; sources: number }) => void): Promise<Validated> {
  const lines: string[] = [];
  for (const [line, sources] of RESEARCH_LINES) {
    await sleep(1800);
    lines.push(line);
    onProgress({ lines: lines.slice(-4), sources });
  }
  await sleep(800);
  return validateReport(reportFixture as Submission, request, null);
}
