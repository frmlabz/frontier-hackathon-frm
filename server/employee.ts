// AI employee run: same-model tool loop over the (mock) Gmail inbox and app records.
import { client, logUsage, requestOptions } from "./claude";
import { publish } from "./bus";
import {
  MOCK, addActivity, getApp, getPerson, getRecord, insertChatItem, insertRecord, listApps, listKnowledge, listRecords,
  markProcessed, setPersonStatus, updateRecord, type Person,
} from "./db";
import { gmailRead, gmailSearch } from "./mockGmail";

const running = new Set<string>();
export const isRunning = (id: string) => running.has(id);

export function log(personId: string, text: string) {
  const a = addActivity(personId, text);
  publish({ type: "activity.add", personId, text: a.text, id: a.id, createdAt: a.createdAt });
}

const TOOLS = [
  {
    name: "gmail_search",
    description: "Search the connected Gmail inbox (from/subject/body). Already-processed messages are skipped. Returns id, from, subject, date, snippet.",
    input_schema: { type: "object", properties: { query: { type: "string" }, max: { type: "number", description: "≤ 10" } }, required: ["query"] },
  },
  {
    name: "gmail_read",
    description: "Read the full body of one message.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "list_records",
    description: "List all records of an app collection.",
    input_schema: { type: "object", properties: { app: { type: "string", description: "app slug" }, collection: { type: "string" } }, required: ["app", "collection"] },
  },
  {
    name: "upsert_records",
    description: "Write records to an app collection. A record with an existing id is shallow-merged (send only changed fields); without id it is inserted. Use the app's field names; numbers as numbers.",
    input_schema: {
      type: "object",
      properties: {
        app: { type: "string" },
        collection: { type: "string" },
        records: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      required: ["app", "collection", "records"],
    },
  },
  {
    name: "update_record",
    description: "Shallow-merge a patch into one record.",
    input_schema: {
      type: "object",
      properties: { app: { type: "string" }, collection: { type: "string" }, id: { type: "string" }, patch: { type: "object", additionalProperties: true } },
      required: ["app", "collection", "id", "patch"],
    },
  },
  {
    name: "mark_processed",
    description: "Mark an email as handled so it is never applied twice. Call right after applying it (or deciding it's not relevant).",
    input_schema: { type: "object", properties: { message_id: { type: "string" } }, required: ["message_id"] },
  },
  {
    name: "log",
    description: "Post a short line to your activity feed that the owner sees live (e.g. a decision or a skipped email).",
    input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
];

const label = (r: any) => r?.name ?? r?.item ?? r?.title ?? r?.ingredient ?? r?.id;
const fmt = (v: any) => (typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, "")) : JSON.stringify(v));

function describeChange(before: any, after: any, unitOf: (k: string) => string, full: any = after) {
  const parts: string[] = [];
  for (const k of Object.keys(after)) {
    if (["id", "createdAt", "updatedAt"].includes(k)) continue;
    if (JSON.stringify(before?.[k]) === JSON.stringify(after[k])) continue;
    const u = unitOf(k) || (typeof full?.unit === "string" && /qty|quantity|stock|on_hand|minimum|par/i.test(k) ? full.unit : "");
    parts.push(before?.[k] === undefined ? `${k} ${fmt(after[k])}${u ? " " + u : ""}` : `${k} ${fmt(before[k])} → ${fmt(after[k])}${u ? " " + u : ""}`);
  }
  return parts.slice(0, 3).join(", ");
}

/** Executes one employee tool. Shared by the real loop and mock mode. */
export function runEmployeeTool(p: Person, name: string, input: any): any {
  switch (name) {
    case "gmail_search": {
      const res = gmailSearch(input.query, input.max);
      log(p.id, `Searched Gmail for “${input.query}” · ${res.length} result${res.length === 1 ? "" : "s"}`);
      return res;
    }
    case "gmail_read": {
      const m = gmailRead(input.id);
      if (!m) return { error: "not found" };
      log(p.id, `Reading “${m.subject}”`);
      return m;
    }
    case "list_records":
      return listRecords(input.app, input.collection);
    case "upsert_records": {
      const app = getApp(input.app);
      if (!app) return { error: `No app ${input.app}. Apps: ${listApps().map((a) => a.slug).join(", ")}` };
      const unitOf = (k: string) => app.schema?.find((c) => c.name === input.collection)?.fields.find((f) => f.name === k)?.unit ?? "";
      const out: any[] = [];
      for (const r of input.records ?? []) {
        // No id but a same-named record exists → treat as an update (prevents duplicate rows).
        const key = ["name", "item", "ingredient", "title"].find((k) => typeof r[k] === "string");
        const byName = !r.id && key
          ? listRecords(app.slug, input.collection).find((x) => String(x[key] ?? "").trim().toLowerCase() === r[key].trim().toLowerCase())
          : null;
        const before = r.id ? getRecord(app.slug, input.collection, String(r.id)) : byName;
        if (before) {
          const after = updateRecord(app.slug, input.collection, before.id, r)!;
          const d = describeChange(before, r, unitOf, after);
          if (d) log(p.id, `Updated ${label(after)}: ${d}`);
          out.push(after);
        } else {
          const rec = insertRecord(app.slug, input.collection, r);
          log(p.id, `Added ${label(rec)} to ${app.name}`);
          out.push(rec);
        }
      }
      publish({ type: "records.changed", app: app.slug, collection: input.collection });
      return out;
    }
    case "update_record": {
      const app = getApp(input.app);
      if (!app) return { error: `No app ${input.app}` };
      const before = getRecord(app.slug, input.collection, input.id);
      const after = updateRecord(app.slug, input.collection, input.id, input.patch ?? {});
      if (!after) return { error: "record not found" };
      const unitOf = (k: string) => app.schema?.find((c) => c.name === input.collection)?.fields.find((f) => f.name === k)?.unit ?? "";
      const d = describeChange(before, input.patch ?? {}, unitOf, after);
      if (d) log(p.id, `Updated ${label(after)}: ${d}`);
      publish({ type: "records.changed", app: app.slug, collection: input.collection });
      return after;
    }
    case "mark_processed":
      markProcessed(input.message_id, p.id);
      return { ok: true };
    case "log":
      log(p.id, String(input.text ?? "").slice(0, 300));
      return { ok: true };
  }
  return { error: `unknown tool ${name}` };
}

function system(p: Person) {
  const knowledge = listKnowledge().map((k) => `## ${k.emoji} ${k.title}\n${k.markdown}`).join("\n\n");
  const apps = listApps()
    .filter((a) => a.schema)
    .map((a) => `- ${a.emoji} ${a.name} (slug "${a.slug}"): ${a.schema!.map((c) => `collection "${c.name}" fields ${c.fields.map((f) => `${f.name}:${f.type}${f.unit ? `(${f.unit})` : ""}`).join(", ")}`).join("; ")}`)
    .join("\n");
  return `You are ${p.name}, an AI employee at Marko's Bistro. Role: ${p.role}.

Your standing instructions from the CEO:
${p.instructions}

Apps you can read and write:
${apps || "(none)"}

How to work:
- First list the records you'll update so you can match by name (case-insensitive, singular/plural and small wording differences count as the same item). Update existing records by id; add a new record only when the item truly doesn't exist (fill every field sensibly).
- Read every candidate email. Only apply real supplier invoices/delivery notes; ignore newsletters, bills for utilities, bookings and staff messages (mark them processed too so they're not re-read, and log one short line saying you skipped them).
- Invoice quantities ADD to current stock. Convert units to the app's unit (e.g. 4 tins × 5 L = 20 L, 500 g = 0.5 kg). Numbers are numbers.
- Process each email exactly once: apply it, then mark_processed.
- Use log sparingly for decisions the owner should see (e.g. "Skipped the electricity bill — not stock"). Your reads and record changes are already shown.
- Finish with ONE plain sentence summarizing what you did, e.g. "Imported 3 supplier invoices: +12 kg tomatoes, +20 L olive oil, +8 kg feta (and 6 more items)." No preamble.

Business knowledge:
${knowledge}`;
}

export function startEmployee(personId: string, task: string) {
  if (running.has(personId)) return false;
  running.add(personId);
  setPersonStatus(personId, "working");
  publish({ type: "state.changed" });
  const p = getPerson(personId)!;
  log(p.id, `Started: ${task.replace(/^run [\w-]+:\s*/i, "").replace(/^./, (c) => c.toUpperCase())}`);
  (async () => {
    let summary = "";
    try {
      if (MOCK) {
        const { mockEmployeeRun } = await import("./mockAi");
        summary = await mockEmployeeRun(p, (name, input) => runEmployeeTool(p, name, input));
      } else {
        summary = await loop(p, task);
      }
    } catch (e: any) {
      console.error("[employee]", personId, e);
      summary = "I ran into a problem and stopped. Nothing was applied twice; I'll pick up where I left off next time.";
    } finally {
      running.delete(personId);
      setPersonStatus(personId, "idle");
      if (summary) log(p.id, `Done: ${summary}`);
      const item = insertChatItem("event", { icon: "bot", personId: p.id, text: summary || `${p.name} finished.` });
      publish({ type: "chat.item", item });
      publish({ type: "state.changed" });
    }
  })();
  return true;
}

async function loop(p: Person, task: string) {
  const messages: any[] = [{ role: "user", content: `Task: ${task}` }];
  let last = "";
  for (let i = 0; i < 40; i++) {
    const stream = client.beta.messages.stream({
      ...requestOptions("medium"),
      system: system(p),
      tools: TOOLS,
      tool_choice: { type: "auto" },
      messages,
    } as any);
    const msg: any = await stream.finalMessage();
    logUsage("employee", msg);
    messages.push({ role: "assistant", content: msg.content });
    const text = msg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
    if (text) last = text;
    const uses = msg.content.filter((b: any) => b.type === "tool_use");
    if (!uses.length || msg.stop_reason !== "tool_use") break;
    const results = uses.map((u: any) => {
      let out: any;
      try {
        out = runEmployeeTool(p, u.name, u.input ?? {});
      } catch (e: any) {
        out = { error: String(e?.message ?? e) };
      }
      return { type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out), ...(out?.error ? { is_error: true } : {}) };
    });
    messages.push({ role: "user", content: results });
  }
  return last;
}
