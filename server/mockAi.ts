// BOS_MOCK=1: scripted CEO / builder / employee for free UX work. Everything else is the real code path.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getKnowledge, listApps, listPeople, listRecords, kv, type App, type Person } from "./db";
import type { BuildOutput } from "./builder";
import type { Job } from "./ceo";
import { addSpecBlock } from "./spec";

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
type Ctx = { say: (text: string) => Promise<void>; tool: (name: string, input: any) => { text: string } };
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

export async function mockCeoTurn(job: Job, { say, tool }: Ctx) {
  const t = job.text;
  await sleep(500);
  const apps = listApps();
  const inventory = apps.find((a) => /inventor/i.test(a.name));
  const assistant = listPeople().find((p) => p.kind === "ai");

  if (job.kind === "event" && has(/gmail connected/, t)) {
    if (assistant) tool("run_employee", { person_id: assistant.id, task: kv.get("pending:gmail") || "Import supplier invoices from Gmail into Inventory." });
    return say(`Gmail is connected. **${assistant?.name ?? "Your assistant"}** is going through your supplier emails now — keep Inventory open and you'll see the stock change.`);
  }
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
      instructions: `Search Gmail for supplier invoices. For each invoice, add the delivered quantities to the matching ingredient in the ${inventory?.slug ?? "inventory"} app (collection "ingredients"), matching by name. Add missing ingredients. Skip anything that isn't an invoice.`,
      connectors: ["gmail"],
    });
    const id = r.text.match(/person_id: (\S+)/)?.[1] ?? "purchasing-assistant";
    tool("request_connector", { provider: "gmail", reason: "So the Purchasing Assistant can read supplier invoices and update stock.", pending_task: `Run ${id}: import all unprocessed supplier invoices into Inventory.` });
    return say("I've hired a **Purchasing Assistant** 🛒 to read supplier invoices and update stock. Connect Gmail and I'll put them to work right away.");
  }
  if (!inventory && getKnowledge("suppliers") && has(/^(yes|yeah|yep|sure|ok|okay|do it|go|please|sounds good|let'?s)/, t.trim())) {
    tool("build_app", {
      name: "Inventory", emoji: "🥫", description: "Live stock levels for every ingredient, with low-stock warnings.",
      spec: MOCK_SPEC,
    });
    return say("Setting up **Inventory** now. I'm starting it with the ingredients and suppliers you mentioned.");
  }
  if (has(/stock|notebook|inventory|intake|track|run out|ran out|mess/, t) && !inventory && !getKnowledge("pain-points")) {
    tool("upsert_knowledge_page", { slug: "pain-points", emoji: "🔥", title: "Pain Points", markdown: PAIN });
    return say("That notebook is costing you: things run out mid-service and every invoice gets copied in by hand. Who are your suppliers, and what does each one deliver?");
  }
  if (has(/supplier|produce|butcher|imports|deliver/, t) && !getKnowledge("suppliers")) {
    tool("upsert_knowledge_page", { slug: "suppliers", emoji: "🚚", title: "Suppliers", markdown: SUPPLIERS });
    return say("Thanks, that's everything I need. I'd set up an **Inventory** app with your 12 ingredients, how much you have of each, and a red **Low** flag when something drops to its minimum. Want me to set it up?");
  }
  if (has(/restaurant|bistro|run a|cafe|kitchen|people/, t) && !getKnowledge("company-profile")) {
    tool("upsert_knowledge_page", { slug: "company-profile", emoji: "🏢", title: "Company Profile", markdown: PROFILE });
    if (has(/ana|chef/, t)) {
      tool("add_team_members", { members: MOCK_TEAM });
      return say("Lovely, a Mediterranean bistro, and I've added Ana, Luka and the rest of the team. How does a normal day run, and what's the hardest part?");
    }
    return say("Lovely — a Mediterranean bistro. Who works with you? Names and what they do is enough.");
  }
  if (has(/^(hi|hello|hey)/, t)) return say("Hi Marko! Tell me about the business — what do you run, and who's on the team?");
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
  const results: any[] = tool("gmail_search", { query: "invoice delivery", max: 10 });
  const applied: string[] = [];
  let invoices = 0;
  for (const r of results) {
    await sleep(1100);
    const msg = tool("gmail_read", { id: r.id });
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
      else tool("upsert_records", { app: app.slug, collection: "ingredients", records: [{ name: l.name, category: l.category, quantity: l.qty, unit: l.unit, minimum: Math.ceil(l.qty / 3), supplier: l.supplier }] });
      if (applied.length < 3) applied.push(`+${l.qty} ${l.unit} ${l.name.toLowerCase()}`);
    }
    tool("mark_processed", { message_id: r.id });
  }
  const total = Object.entries(INVOICE_LINES).filter(([id]) => results.some((r) => r.id === id)).reduce((n, [, l]) => n + l.length, 0);
  if (!invoices) return "No new supplier invoices in Gmail — stock is up to date.";
  return `Imported ${invoices} supplier invoices: ${applied.join(", ")}${total > applied.length ? ` and ${total - applied.length} more items` : ""}.`;
}
