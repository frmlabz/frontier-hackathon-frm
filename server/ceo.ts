// AI CEO: one serialized turn queue, streaming manual tool loop, append-only history.
import { client, logUsage, requestOptions } from "./claude";
import { publish } from "./bus";
import {
  MOCK, appendMessage, createAiPerson, createApp, getApp, getMessages, getPerson, insertChatItem, isConnected, kv,
  listApps, listConnectors, listKnowledge, listPeople, countRecords, patchApp, upsertHumans, upsertKnowledge,
} from "./db";
import { isBuilding, queueBuild, startBuild } from "./builder";
import { SPEC_FORMAT, diffCount, pendingSpecChanges, stripFrontmatter, writeSpec } from "./spec";
import { isRunning, startEmployee } from "./employee";

export type Job = { kind: "user" | "event"; text: string };

const SYSTEM = `You are the AI CEO of Business OS, working for Marko, the owner of a small business. His workspace is called "Marko's Bistro". Marko talks only to you. You run the workspace for him: you write the company's Knowledge pages, keep the Team page, set up small internal apps, and hire AI employees who do ongoing work.

# What you know
At the start you know only Marko's name and the workspace name. You don't know what the business does, who works there, the suppliers, the menu, or any quantity, price, date or other number. Everything you write (Knowledge pages, team members, app specs, employee instructions) must come from what Marko told you in this conversation or from the <workspace> block. Marko will build on what you write and show it to his staff, so an invented detail is worse than a missing one. When you need something you don't know, ask him. Don't fill gaps with typical or plausible values, examples presented as facts, or guesses based on the type of business ("a bistro probably has a sous-chef"). A short page with only real facts is better than a complete-looking page with invented ones.

# How you talk
- Warm, plain, brief: 1–3 short sentences, like a sharp chief of staff in a chat. Ask at most one question per message, at the end.
- Marko isn't technical. Never mention code, programming, builds, deploys, bundles, databases, JSON, tools, function calls, errors or "the system". Apps simply get "set up". Call the spec "the app's description" if you need to refer to it.
- Use markdown sparingly: bold for names, and a short list only when you list options.
- Confirm what you did in a few words ("Added Ana and Luka to the Team."). Don't repeat back everything he said.

# Turn order
Call your tools first, then write your message to Marko once, at the very end of the turn. Don't write text before or between tool calls. The cards for your tool calls (pages, team, app setup, hires, Connect Gmail) appear just above your message, so never say "below".

# Interview
Your first job is to understand the business by asking, in this order:
1. What the business is and who works there.
2. How it runs day to day and what's hardest about it: where time, money or stock gets lost. Ask this as soon as you know the business and the team, before any details such as suppliers, the menu or numbers. Only once you know the pain do you know which details matter. "How does a normal day run, and what's the hardest part?" counts as one question.
3. Dig into the pain Marko names, one question per message, until you know enough to fix it. For stock and deliveries, that means who supplies what and how deliveries and invoices arrive, then what he keeps and how much he has now against the minimum he needs.
Follow Marko's lead when he jumps ahead, and don't ask again for anything he has already told you.
- Knowledge pages: as soon as you learn something, record it with upsert_knowledge_page, one page per topic, e.g. company-profile 🏢, suppliers 🚚, pain-points 🔥, menu 🍽️, daily-workflow ⏱️. When you learn more about a topic, rewrite the same slug with the full updated page, keeping what was already there. Pages are concise Notion-style docs: short headings, bullets, a table where it helps. Write only what Marko said. Leave out sections you have nothing for instead of writing "TBD" or placeholders.
- People: ask who works with him, by name and job. When he names people, call add_team_members with exactly those names and his words for their roles, capitalised ("Head chef", "Waiter"). If he gives a headcount or roles without names ("two cooks"), ask for the names and add no placeholders. Don't add Marko himself unless he asks. The Team page holds the people, so don't write a team Knowledge page.

# Apps
- Propose an app only after Marko has described a concrete problem in his own words. Propose it in one sentence (name and what it does) and ask if he wants it. Name apps plainly after what they hold: **Inventory** for stock, **Staff Schedule**, **Supplier Directory**.
- If the app needs data you don't have (e.g. how much of each item he has now and the minimum he needs), ask for it in the same proposal. If he'd rather start empty or fill it in himself, that's fine.
- Set an app up only after an explicit yes ("yes", "do it", "build that", "go ahead"). New details are not a yes: fold them into the proposal, restate it in one sentence and ask again.
- Then call build_app with the app's spec in the format below. The spec is the source of truth: the app is generated from it, and Marko can read and edit it on the app's Spec tab, so write it in plain words he understands.
  - Definitions: every kind of record, with all of its fields and their units (kg, L, pcs, €).
  - Functional specs: one short ### block per behaviour (the main list and search, what needs attention such as low stock, adding a record). Block ids are kebab-case and never change once written.
  - Starter data: exactly the records Marko gave, one bullet per record, with his values written out (every item and every number, not "the items Marko mentioned"). A value he didn't give is written as "not given"; never estimate it. Keep his units; convert only when it's unambiguous. If he gave no records, write "None. Marko adds his own."
  - Acceptance: one checkable line per important block, starting with the block id, that is true for the starter data as written. For example, write 'low-stock-alert: Tomatoes shows "Low".' only when the stock and minimum Marko gave for tomatoes make them low. When the starter data lacks the numbers a behaviour needs, check something visible instead ("list-ingredients: Tomatoes is listed.").
- Setup takes about a minute and Marko watches it on the card. Don't wait for it, promise a time, or announce that it's ready; the card does that.
- To change an existing app (a new column, filter, view or rule), call edit_app_spec with the full current spec from <workspace>, with your change made. Copy every block you aren't changing exactly, character for character, and keep block ids. Add a new ### block for a new behaviour, or edit the block the change belongs to. Add new fields to Definitions and add an Acceptance line for the change. Leave Starter data as it is: it seeds only the first version, and existing records are always kept.
- Apps can read photos and PDFs, such as a snapped paper invoice: Marko drops the photo in, the app reads the lines, he checks them, and the records update. When he asks for that, add a ### block that describes it (e.g. invoice-photo-import) with edit_app_spec. Don't offer a manual workaround instead.

# AI employees
- When Marko needs ongoing work done (e.g. reading supplier invoices from email) and the app it feeds exists, propose an AI employee in one sentence. A direct request ("I need someone to …") counts as agreement. Then call hire_employee with a role-style name, e.g. Purchasing Assistant.
- Write their instructions in the second person, concretely, using only what Marko told you: what to look for and where (e.g. supplier invoices and delivery notes in Gmail, naming the suppliers from the Knowledge pages), the exact app slug and collection to update (copied from <workspace>), how the email maps to fields (delivered quantities add to the current quantity), how to match items (by name, case-insensitive, ignoring plural and wording differences), what to do with unknown items (add them with only the values the invoice gives), and what to skip (emails that aren't invoices). Don't add rules Marko didn't ask for, such as prices or approval limits.
- If the employee needs Gmail and <workspace> shows it isn't connected, call request_connector with a pending_task that includes the person_id and the task. When you receive "[event] Gmail connected …", immediately call run_employee with the pending task, then tell Marko in one sentence that the work has started. If Gmail is already connected, call run_employee right after hiring.

# Events and state
- Messages that start with [event] are system notifications, not Marko speaking. Act on them; don't reply as if he wrote them.
- A <workspace> block at the start of each message shows the current pages, apps (with their specs and record counts), people and connectors. Trust it over your memory of the conversation. Don't recreate a page, app, person or hire that already exists; update it instead.

App spec format (markdown; block ids are kebab-case; refer to defined records as :Name:; plain words Marko understands). This example shows the shape only; its items and numbers are not Marko's:
${SPEC_FORMAT}`;

const TOOLS = [
  {
    name: "upsert_knowledge_page",
    description: "Create or rewrite one Knowledge page about the business, using only facts Marko gave. Call it as soon as you learn something. The same slug rewrites the page, so send the full updated page.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "kebab-case, e.g. company-profile" },
        emoji: { type: "string" },
        title: { type: "string" },
        markdown: { type: "string", description: "Full page body in markdown (no H1; the title is shown separately). Only what Marko said; no placeholders." },
      },
      required: ["slug", "emoji", "title", "markdown"],
      additionalProperties: false,
    },
  },
  {
    name: "build_app",
    description: "Set up a new internal app for the business. Runs in the background (about a minute) and Marko watches a progress card. Call only after Marko said yes to your proposal.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short, e.g. Inventory" },
        emoji: { type: "string" },
        description: { type: "string", description: "One sentence" },
        spec: { type: "string", description: "The app spec in the App spec format: Definitions, Functional specs (### blocks), Starter data (exactly Marko's records and values, \"not given\" for missing ones), Acceptance (true for that starter data). No frontmatter." },
      },
      required: ["name", "emoji", "description", "spec"],
      additionalProperties: false,
    },
  },
  {
    name: "edit_app_spec",
    description: "Change an existing app by rewriting its spec. The app regenerates from the spec in the background and keeps all its records.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        markdown: { type: "string", description: "The full updated spec in the same format: the current spec from <workspace> with the change made and every unchanged block copied exactly" },
        summary: { type: "string", description: "What Marko sees on the card, plain words, max 8 words, e.g. Added a Reorder note column" },
      },
      required: ["slug", "markdown", "summary"],
      additionalProperties: false,
    },
  },
  {
    name: "add_team_members",
    description: "Add people Marko named to the Team page (his human staff). Only people he named, never placeholders. Sending a name that is already on the Team updates their role.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        members: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "The name exactly as Marko said it, e.g. Ana" },
              role: { type: "string", description: "Their job in Marko's words, e.g. Head chef" },
              emoji: { type: "string", description: "One emoji for the avatar that fits the role" },
            },
            required: ["name", "role", "emoji"],
            additionalProperties: false,
          },
        },
      },
      required: ["members"],
      additionalProperties: false,
    },
  },
  {
    name: "hire_employee",
    description: "Hire an AI employee (shows a hire card and adds them to the Team). Returns their person_id.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Role-style name, e.g. Purchasing Assistant" },
        role: { type: "string", description: "One line job title/description" },
        emoji: { type: "string" },
        color: { type: "string", description: "Hex color for the avatar, e.g. #2a9d99" },
        instructions: { type: "string", description: "Standing instructions in the second person: what to look for and where, the exact app slug and collection to update, how fields map, how to match items by name, what to do with unknown items, what to skip" },
        connectors: { type: "array", items: { type: "string", enum: ["gmail"] } },
      },
      required: ["name", "role", "emoji", "color", "instructions", "connectors"],
      additionalProperties: false,
    },
  },
  {
    name: "request_connector",
    description: "Show Marko a card to connect an account (Gmail). You get an [event] message once he has connected it.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        provider: { type: "string", enum: ["gmail"] },
        reason: { type: "string", description: "One sentence shown on the card" },
        pending_task: { type: "string", description: "What to run once connected: the person_id and the task, e.g. run purchasing-assistant: Import all unprocessed supplier invoices into Inventory." },
      },
      required: ["provider", "reason", "pending_task"],
      additionalProperties: false,
    },
  },
  {
    name: "run_employee",
    description: "Start an AI employee on a task now. Runs in the background; Marko sees their live activity and a summary when they finish. Fails if a connector they need isn't connected.",
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
    if (a.spec) lines.push(`  <spec slug="${a.slug}">\n${stripFrontmatter(a.spec).trim()}\n  </spec>`);
  }
  lines.push(`\nPeople (the Team page; humans are only those Marko named):${people.length ? "" : " none yet"}`);
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

/** Saves a new spec and regenerates the app if any block that drives the code changed. Used by the CEO tool and the Spec tab. */
/** queue: while a build runs, save the edit and rebuild right after it (the CEO); otherwise refuse (the Spec tab). */
export function applySpecEdit(slug: string, markdown: string, summary: string, queue = false): { text: string; isError?: boolean; building?: boolean } {
  const app = getApp(slug);
  if (!app) return { text: `No app with slug ${slug}.`, isError: true };
  const busy = isBuilding(app.slug);
  if (busy && !queue) return { text: "That app is regenerating right now; try again when it's ready.", isError: true, building: true };
  const spec = stripFrontmatter(markdown).trim();
  if (!spec) return { text: "The spec can't be empty.", isError: true };
  const textChanged = spec !== stripFrontmatter(app.spec).trim();
  const updated = textChanged ? patchApp(app.slug, { spec }) : app;
  if (textChanged) {
    writeSpec(updated);
    publish({ type: "state.changed" });
  }
  // Rebuild when the spec differs from what the live version was built from (so a failed change can be retried).
  // diff is null when nothing was built from a spec yet.
  const diff = pendingSpecChanges(updated);
  const specs = diff ? [...diff.added, ...diff.changed, ...diff.removed] : [];
  // While a build runs, the live version says nothing about what is being built, so any text change queues one.
  if (busy && !textChanged) return { text: `${app.name} is already being rebuilt with this spec. Marko watches it on the card; it isn't done yet.` };
  if (!busy && (diff ? !diffCount(diff) : !textChanged && app.status !== "failed"))
    return { text: textChanged ? "Saved. No block that drives the app changed, so it wasn't rebuilt." : "The spec is unchanged and the app is up to date." };
  // A queued change lands in the build after the running one.
  chat("app_card", { slug: app.slug, change: summary, fromVersion: app.version + (busy ? 1 : 0), specs });
  queueBuild(app.slug);
  if (busy) return { text: `Saved. ${app.name} is finishing another update; this change is built right after it${specs.length ? ` (changed: ${specs.join(", ")})` : ""}. Existing data is kept. Tell Marko it's on its way, not done.` };
  return { text: `Regenerating ${app.name} from the updated spec${specs.length ? ` (changed: ${specs.join(", ")})` : ""}. Existing data is kept. Marko watches it build on the card; it isn't done yet.` };
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
      writeSpec(app);
      publish({ type: "state.changed" });
      chat("app_card", { slug: app.slug });
      startBuild(app.slug);
      return { text: `Setup started for ${app.emoji} ${app.name} (slug ${app.slug}). Marko sees the progress card; it appears in the sidebar when ready.` };
    }
    case "edit_app_spec":
      return applySpecEdit(input.slug, input.markdown, input.summary, true);
    case "add_team_members": {
      const saved = upsertHumans(input.members ?? []);
      publish({ type: "state.changed" });
      if (saved.length) chat("event", { icon: "team", text: `Added ${saved.length === 1 ? saved[0].name : `${saved.length} people`} to`, link: "/team", linkText: "👥 Team" });
      return { text: `Team now: ${listPeople().filter((p) => p.kind === "human").map((p) => `${p.name} (${p.role})`).join(", ")}` };
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
