// AI CEO: one serialized turn queue, streaming manual tool loop, append-only history.
import { client, logUsage, requestOptions } from "./claude";
import { publish } from "./bus";
import {
  MOCK, appendMessage, createAiPerson, createApp, getApp, getMessages, getPerson, insertChatItem, isConnected, kv,
  listApps, listConnectors, listKnowledge, listPeople, countRecords, patchApp, upsertKnowledge,
} from "./db";
import { isBuilding, startBuild } from "./builder";
import { isRunning, startEmployee } from "./employee";

export type Job = { kind: "user" | "event"; text: string };

const SYSTEM = `You are the AI CEO of Business OS, working for Marko, the owner of a small business ("Marko's Bistro"). Marko only ever talks to you. You run his workspace: you write the company's Knowledge pages, build small internal apps, and hire AI employees.

How you talk:
- Warm, plain, brief: 1–3 short sentences, like a sharp chief of staff in a chat. One question at a time.
- Never mention code, programming, deploys, bundles, databases, JSON, tools, errors or "the system". Apps simply get "set up".
- Markdown is fine but sparse (bold for names, short lists only when listing options).

How you work:
- Turn order: call your tools first, then write your message to Marko at the very end of the turn. Do not narrate before or between tool calls. Cards for your tool calls (pages, app setup, hires, Connect Gmail) appear just above your message, so never say "below".
- Interview Marko to understand the business. As soon as you learn something, write it down with upsert_knowledge_page — several pages over the conversation (e.g. company-profile 🏢, suppliers 🚚, pain-points 🔥, team 👥, menu 🍽️, daily-workflow ⏱️). Rewrite a page (same slug) when you learn more. Pages are concise Notion-style docs: short headings, bullets, tables where useful. Never invent facts Marko didn't give you; leave gaps out.
- When a pain point can be solved with a small app, propose it in one sentence (name + what it does) and wait for a yes. Then call build_app. Requirements must be specific: the records to track, every field with units, what needs attention (e.g. low stock), and the concrete items, suppliers and numbers Marko mentioned so the app starts with his real data.
- Apps take about a minute to set up; Marko watches progress in a card. Don't wait for it or promise a time.
- When Marko needs ongoing work done (e.g. reading supplier emails), propose an AI employee and hire them with hire_employee once he agrees (a direct request counts as agreement). Instructions must name the exact app slug and collection to update and how to match items (by name, case-insensitive; add new items when missing).
- If an employee needs Gmail and it isn't connected, call request_connector with the task to run afterwards. When you receive "[event] Gmail connected …", immediately call run_employee with the pending task, then tell Marko in one sentence that the work has started.
- Messages that start with [event] are system notifications, not Marko speaking.
- A <workspace> block at the start of each message shows the current workspace. Trust it over memory.`;

const TOOLS = [
  {
    name: "upsert_knowledge_page",
    description: "Create or rewrite one Knowledge page about the business. Call it as soon as you learn something. Same slug = rewrite.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "kebab-case, e.g. company-profile" },
        emoji: { type: "string" },
        title: { type: "string" },
        markdown: { type: "string", description: "Full page body in markdown (no H1 title; it is shown separately)" },
      },
      required: ["slug", "emoji", "title", "markdown"],
      additionalProperties: false,
    },
  },
  {
    name: "build_app",
    description: "Set up a new internal app for the business (runs in the background, ~1 minute). Only after Marko agreed.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short, e.g. Inventory" },
        emoji: { type: "string" },
        description: { type: "string", description: "One sentence" },
        requirements: { type: "string", description: "Detailed: records, fields with units, highlights, real items/suppliers/numbers Marko gave" },
      },
      required: ["name", "emoji", "description", "requirements"],
      additionalProperties: false,
    },
  },
  {
    name: "update_app",
    description: "Change an existing app (adds features or fields; data is kept). Runs in the background.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { slug: { type: "string" }, change_request: { type: "string" } },
      required: ["slug", "change_request"],
      additionalProperties: false,
    },
  },
  {
    name: "hire_employee",
    description: "Hire an AI employee. Returns their person_id.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Role-style name, e.g. Purchasing Assistant" },
        role: { type: "string", description: "One line job title/description" },
        emoji: { type: "string" },
        color: { type: "string", description: "Hex color for the avatar, e.g. #2a9d99" },
        instructions: { type: "string", description: "Standing instructions: what to do, which app slug + collection to read/update, matching rules" },
        connectors: { type: "array", items: { type: "string", enum: ["gmail"] } },
      },
      required: ["name", "role", "emoji", "color", "instructions", "connectors"],
      additionalProperties: false,
    },
  },
  {
    name: "request_connector",
    description: "Show Marko a card to connect an account (Gmail). You'll get an [event] message once connected.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        provider: { type: "string", enum: ["gmail"] },
        reason: { type: "string", description: "One sentence shown on the card" },
        pending_task: { type: "string", description: "What to run once connected, incl. the person_id" },
      },
      required: ["provider", "reason", "pending_task"],
      additionalProperties: false,
    },
  },
  {
    name: "run_employee",
    description: "Start an AI employee on a task now (runs in the background; Marko sees live activity).",
    strict: true,
    input_schema: {
      type: "object",
      properties: { person_id: { type: "string" }, task: { type: "string", description: "One short instruction addressed to the employee, shown in their activity feed, e.g. \"Import all unprocessed supplier invoices into Inventory.\"" } },
      required: ["person_id", "task"],
      additionalProperties: false,
    },
  },
];

// ---------- workspace state (sent as the first block of each user message; system prompt stays frozen) ----------
function stateBlock() {
  const pages = listKnowledge();
  const apps = listApps();
  const people = listPeople();
  const conns = listConnectors();
  const lines: string[] = ["<workspace>"];
  lines.push(`Knowledge pages (${pages.length}):`);
  for (const p of pages) lines.push(`--- ${p.slug} · ${p.emoji} ${p.title}\n${p.markdown}`);
  lines.push(`\nApps (${apps.length}):`);
  for (const a of apps) {
    const colls = (a.schema ?? []).map((c) => `${c.name}[${countRecords(a.slug, c.name)} records](${c.fields.map((f) => f.name + (f.unit ? ` ${f.unit}` : "")).join(", ")})`).join("; ");
    lines.push(`- ${a.emoji} ${a.name} · slug=${a.slug} · status=${a.status}${a.version ? ` v${a.version}` : ""}${colls ? ` · collections: ${colls}` : ""}`);
  }
  lines.push(`\nPeople:`);
  for (const p of people) lines.push(`- ${p.kind === "ai" ? "AI" : "human"} · id=${p.id} · ${p.name} · ${p.role}${p.kind === "ai" ? ` · status=${p.status} · connectors=${p.connectors.join(",") || "none"}` : ""}`);
  lines.push(`\nConnectors: ${conns.length ? conns.map((c) => `${c.provider} connected as ${c.account}`).join(", ") : "none"}`);
  lines.push("</workspace>");
  return lines.join("\n");
}

// ---------- tool handlers (shared by the real loop and mock mode) ----------
function chat(kind: string, payload: any) {
  const item = insertChatItem(kind, payload);
  publish({ type: "chat.item", item });
  return item;
}

export function runTool(name: string, input: any): { text: string; isError?: boolean } {
  switch (name) {
    case "upsert_knowledge_page": {
      const { page, created } = upsertKnowledge(input);
      publish({ type: "knowledge.changed", slug: page.slug });
      publish({ type: "state.changed" });
      chat("event", { icon: "page", text: `${created ? "Created" : "Updated"} page`, link: `/knowledge/${page.slug}`, linkText: `${page.emoji} ${page.title}` });
      return { text: `Saved page "${page.title}" (slug ${page.slug}).` };
    }
    case "build_app": {
      const app = createApp(input);
      publish({ type: "state.changed" });
      chat("app_card", { slug: app.slug });
      startBuild(app.slug);
      return { text: `Setup started for ${app.emoji} ${app.name} (slug ${app.slug}). Marko sees the progress card; it appears in the sidebar when ready.` };
    }
    case "update_app": {
      const app = getApp(input.slug);
      if (!app) return { text: `No app with slug ${input.slug}.`, isError: true };
      if (isBuilding(app.slug)) return { text: "That app is being set up right now; try again when it's ready.", isError: true };
      patchApp(app.slug, { requirements: `${app.requirements}\n\nChange (v${app.version + 1}): ${input.change_request}` });
      chat("app_card", { slug: app.slug, change: input.change_request, fromVersion: app.version });
      startBuild(app.slug, { changeRequest: input.change_request });
      return { text: `Update started for ${app.name}. Existing data is kept.` };
    }
    case "hire_employee": {
      const p = createAiPerson(input);
      publish({ type: "state.changed" });
      chat("hire_card", { personId: p.id });
      return { text: `Hired ${p.name}. person_id: ${p.id}` };
    }
    case "request_connector": {
      if (isConnected(input.provider)) {
        const c = listConnectors().find((x) => x.provider === input.provider);
        return { text: `Already connected as ${c?.account}. You can run the employee now.` };
      }
      kv.set(`pending:${input.provider}`, input.pending_task);
      chat("connector_card", { provider: input.provider, reason: input.reason });
      return { text: "Card shown. Waiting for Marko to connect; you'll get an [event] message." };
    }
    case "run_employee": {
      const p = getPerson(input.person_id) ?? listPeople().find((x) => x.kind === "ai" && x.name.toLowerCase() === String(input.person_id).toLowerCase());
      if (!p || p.kind !== "ai") return { text: `No AI employee with id ${input.person_id}.`, isError: true };
      const missing = p.connectors.filter((c) => !isConnected(c));
      if (missing.length) return { text: `${p.name} needs ${missing.join(", ")} connected first. Call request_connector.`, isError: true };
      if (isRunning(p.id)) return { text: `${p.name} is already working.`, isError: true };
      startEmployee(p.id, input.task);
      return { text: `${p.name} started. Marko sees live activity; a summary is posted when done.` };
    }
  }
  return { text: `Unknown tool ${name}`, isError: true };
}

// ---------- queue ----------
const queue: Job[] = [];
let busy = false;
export const isBusy = () => busy;

export function enqueue(job: Job) {
  queue.push(job);
  if (!busy) void drain();
}

async function drain() {
  busy = true;
  publish({ type: "ceo.busy", busy: true });
  while (queue.length) {
    const job = queue.shift()!;
    try {
      if (MOCK) {
        const { mockCeoTurn } = await import("./mockAi");
        await mockCeoTurn(job, { say, tool: runTool });
      } else {
        await turn(job);
      }
    } catch (e: any) {
      console.error("[ceo] turn failed", e?.status ?? "", e?.message ?? e);
      flushBubble();
      chat("ceo", { text: "Sorry — I lost my train of thought there. Could you say that again?" });
    }
  }
  busy = false;
  publish({ type: "ceo.busy", busy: false });
}

// The in-progress CEO bubble: deltas stream to the shell, then the whole text becomes a chat item.
let bubble = "";
function delta(text: string) {
  bubble += text;
  publish({ type: "chat.delta", text });
}
function flushBubble() {
  const text = bubble.trim();
  bubble = "";
  if (text) chat("ceo", { text });
}

/** Mock mode: stream text word by word like the real model. */
async function say(text: string) {
  const words = text.split(/(\s+)/);
  for (const w of words) {
    delta(w);
    if (w.trim()) await Bun.sleep(28 + Math.random() * 20);
  }
  flushBubble();
}

async function turn(job: Job) {
  appendMessage("user", [
    { type: "text", text: stateBlock() },
    { type: "text", text: job.text },
  ]);
  for (let i = 0; i < 12; i++) {
    const stream = client.beta.messages.stream({
      ...requestOptions("low"),
      system: SYSTEM,
      tools: TOOLS,
      tool_choice: { type: "auto" },
      messages: getMessages(),
    } as any);
    stream.on("text", delta);
    const msg: any = await stream.finalMessage();
    logUsage("ceo", msg);
    appendMessage("assistant", msg.content);
    flushBubble();

    if (msg.stop_reason === "refusal") {
      chat("ceo", { text: "I can't help with that one, but I'm happy to keep going on the business." });
      return;
    }
    const uses = msg.content.filter((b: any) => b.type === "tool_use");
    if (!uses.length || msg.stop_reason !== "tool_use") return;
    const results = uses.map((u: any) => {
      let r: { text: string; isError?: boolean };
      try {
        r = runTool(u.name, u.input);
      } catch (e: any) {
        console.error("[ceo] tool", u.name, e);
        r = { text: `Failed: ${e?.message ?? e}`, isError: true };
      }
      return { type: "tool_result", tool_use_id: u.id, content: r.text, ...(r.isError ? { is_error: true } : {}) };
    });
    appendMessage("user", results);
  }
}
