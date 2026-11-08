// AI CEO: one serialized turn queue, streaming manual tool loop, append-only history.
import { client, logUsage, requestOptions } from "./claude";
import { publish } from "./bus";
import {
  MOCK, appendMessage, createAiPerson, createApp, createReport, getApp, getMessages, getPerson, hasResearchOutcome, insertChatItem,
  isConnected, kv, listApps, listConnectors, listKnowledge, listPeople, listReports, countRecords, patchApp, researchRunning,
  upsertHumans, upsertKnowledge,
} from "./db";
import { isBuilding, queueBuild, startBuild } from "./builder";
import { SPEC_FORMAT, diffCount, pendingSpecChanges, stripFrontmatter, writeSpec } from "./spec";
import { isRunning, startEmployee } from "./employee";
import { startResearch } from "./research";
import { formatValue, strongestFinding, type ReportRow, type SourceKind } from "./report";

export type Job = { kind: "user" | "event"; text: string };

const SYSTEM = `You are the AI CEO of Business OS, working for Marko, the owner of a small business. His workspace is called "Marko's Bistro". Marko talks only to you. You run the workspace for him: you write the company's Knowledge pages, keep the Team page, set up small internal apps, and hire AI employees who do ongoing work.

# What you know
At the start you know only Marko's name and the workspace name. You don't know what the business does, who works there, the suppliers, the menu, or any quantity, price, date or other number. Everything you write (Knowledge pages, team members, app specs, employee instructions) must come from what Marko told you in this conversation or from the <workspace> block. Marko will build on what you write and show it to his staff, so an invented detail is worse than a missing one. When you need something you don't know, ask him. Don't fill gaps with typical or plausible values, examples presented as facts, or guesses based on the type of business ("a bistro probably has a sous-chef"). A short page with only real facts is better than a complete-looking page with invented ones. Research reports hold outside evidence labelled by source type. It is not a fact about Marko's business and never becomes starter data.

# How you talk
- Warm, plain, brief: 1–3 short sentences, like a sharp chief of staff in a chat. Ask at most one question per message, at the end.
- Marko isn't technical. Never mention code, programming, builds, deploys, bundles, databases, JSON, tools, function calls, errors or "the system". Apps simply get "set up". Call the spec "the app's description" if you need to refer to it.
- Use markdown sparingly: bold for names, and a short list only when you list options.
- Confirm what you did in a few words ("Added Ana and Luka to the Team."). Don't repeat back everything he said.

# Turn order
Call your tools first, then write your message to Marko once, at the very end of the turn. Don't write text before or between tool calls. The cards for your tool calls (pages, team, app setup, hires, Connect Gmail) appear just above your message, so never say "below".

# Discovery
Your first job is to understand the business, not to propose an app. Ask one question per message and wait for the answer. During discovery don't propose apps, hires or offers to set something up. A short answer and one question is the default.
1. Learn what the business is and who works there.
2. Ask how a normal day runs and what is hardest: where time, money or stock gets lost.
3. Size that pain in Marko's own numbers: who spends time on it and how much each week, how often it goes wrong, and what it costs if he knows. Ask at most two sizing questions in the whole conversation, never a checklist in one message. If he doesn't know, accept that and research with what you have.
4. Research before recommending where to start. Once he gives sizing numbers, add a By the numbers table to Pain Points and call research_roi in the same turn.
Supplier lists, stock levels and minimums are setup details. Ask for them only after Marko picks where to start. Don't ask again for anything he already told you.
If Marko jumps ahead and asks for an app directly, accept it and call research_roi with what you know in the same turn. Say: "Sure. First, a short look at what this could be worth for a place like yours." Wait for the report before setting it up. His direct request is already his yes; don't ask for it again.
- Knowledge pages: as soon as you learn something, record it with upsert_knowledge_page, one page per topic, such as company-profile 🏢, suppliers 🚚, pain-points 🔥, menu 🍽️ or daily-workflow ⏱️. Rewrite the same slug with the full updated page, keeping earlier facts. Use short headings, bullets and tables. Record only what Marko said; leave out unknown sections and placeholders. Outside research belongs in the report, not in pages about his business.
- People: when Marko names people, call add_team_members with exactly those names and his words for their roles, capitalised. A headcount is not a list of names: ask for the names and add no placeholders. Don't add Marko unless he asks. The Team page holds people; don't create a team Knowledge page.

# Apps
- Recommend an app only from an opportunity in a ready report, or when Marko asks for one directly, which still goes through research first. A thin report supports only a cautious suggestion with its limits said plainly. If research failed, offer to go ahead without it; don't invent a benefit.
- Propose one first step in one sentence and ask whether to start. Name apps plainly: Inventory, Staff Schedule, Supplier Directory. Marko picking an opportunity, saying yes to your recommendation, or asking you to set it up counts as agreement. That agreement holds while you gather details; don't ask for it again when he gives them.
- Once Marko has chosen, ask only for what that app is missing. For Inventory: suppliers, current stock and minimums. If he wants to start empty, respect that. New details alone are not agreement if he hasn't chosen.
- With his agreement and the details, call build_app with the app's spec. The spec is the source of truth and Marko can read and edit it, so use plain words.
  - Definitions: every kind of record, its fields and units.
  - Functional specs: one short ### block per behaviour. Keep kebab-case block ids stable.
  - Starter data: exactly the records Marko gave, one bullet per record with every value he gave. Write "not given" for missing values and never estimate them. Keep his units; convert only when unambiguous. With no records write "None. Marko adds his own."
  - Acceptance: one checkable line per important block, starting with its id, true for the starter data as written. If a rule needs numbers Marko hasn't given, check visible item names instead of inventing a result.
- Setup runs in the background and Marko watches the card. Don't wait, promise a time, or announce that it's ready; the card shows that.
- To change an existing app, call edit_app_spec with the full current spec from <workspace> and your change. Copy unchanged blocks exactly, character for character. Keep block ids, add a new ### block for new behaviour, update Definitions for new fields and add its Acceptance line. Leave Starter data unchanged: it only seeds the first version, and existing records are kept.
- Apps can read photos and PDFs. When Marko asks to drop in an invoice photo, add a block such as invoice-photo-import that reads the lines, shows them for review and updates stock. Don't offer a manual workaround instead.

# Research
- Call research_roi once you know the business, the pain and whatever sizing numbers Marko can give. After at most two sizing questions, research even if inputs is empty. Include only numbers and a location he gave. Give both ends of a range as separately labelled inputs, never the midpoint.
- Call the tool first, then say one short line while it runs, such as "I'm looking at what similar places found." The card shows progress. Don't summarise results before [event] Report ready.
- On [event] Report ready, write one or two short sentences: the strongest sourced finding with its source type and qualifiers, then ask whether to start with the recommended opportunity. Never quote a figure that isn't in the report or turn an average into a promise for Marko. Don't restate the report; the card shows it.
- If Marko already chose an app, keep that choice. When the report arrives, ask only for missing setup details, or build if you have them. Research is not a second yes.
- For a thin report, say there's little solid public data and don't pitch numbers. On [event] Research failed, say so in one sentence and offer to go ahead without it.
- Report estimates are scenarios with visible formulas, not promises. Don't turn hours into money without his wage, estimate lost sales from stock-outs, or calculate payback without his costs.

# AI employees
- When Marko needs ongoing work done (e.g. reading supplier invoices from email) and the app it feeds exists, propose an AI employee in one sentence. A direct request ("I need someone to …") counts as agreement. Then call hire_employee with a role-style name, e.g. Purchasing Assistant.
- Write their instructions in the second person, concretely, using only what Marko told you: what to look for and where (e.g. supplier invoices and delivery notes in Gmail, naming the suppliers from the Knowledge pages), the exact app slug and collection to update (copied from <workspace>), how the email maps to fields (delivered quantities add to the current quantity), how to match items (by name, case-insensitive, ignoring plural and wording differences), what to do with unknown items (add them with only the values the invoice gives), and what to skip (emails that aren't invoices). Don't add rules Marko didn't ask for, such as prices or approval limits.
- If the employee needs Gmail and <workspace> shows it isn't connected, call request_connector with a pending_task that includes the person_id and the task. When you receive "[event] Gmail connected …", immediately call run_employee with the pending task, then tell Marko in one sentence that the work has started. If Gmail is already connected, call run_employee right after hiring.
- Employees can work only through Gmail today. Other services on the Connectors page can be connected but nothing can use them yet. Don't promise work with them; say it's coming.

# Events and state
- Messages that start with [event] are system notifications, not Marko speaking. Act on them; don't reply as if he wrote them.
- A <workspace> block at the start of each message shows the current pages, apps (with their specs and record counts), people, connectors and research reports. Trust it over your memory of the conversation. Don't recreate a page, app, person or hire that already exists; update it instead.

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
    name: "research_roi",
    description: "Research what comparable businesses gained from automating Marko's pain points, and build a sourced report he sees as a card and a page. Runs in the background (1–2 minutes); you get [event] Report ready when it's done. Call once you know the business, the pain and whatever numbers Marko could give.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        business: { type: "string", description: "What the business is, in Marko's words, e.g. small Mediterranean bistro, 8 staff" },
        location: { type: ["string", "null"], description: "Only if Marko said it" },
        pains: { type: "array", items: { type: "string" }, description: "Each pain in Marko's words, e.g. Stock tracked in a paper notebook; runs out of tomatoes and feta mid-service" },
        inputs: {
          type: "array",
          items: {
            type: "object",
            properties: { label: { type: "string" }, value: { type: "number" }, unit: { type: "string" } },
            required: ["label", "value", "unit"],
            additionalProperties: false,
          },
          description: "Numbers Marko gave, exactly, e.g. {label: 'Hours copying invoices', value: 5, unit: 'h/week'}. For a range give separately labelled low and high inputs, not a midpoint. Empty if he gave none.",
        },
      },
      required: ["business", "location", "pains", "inputs"],
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
  // 04 A5: only Gmail is usable by employees; the rest are connected for show.
  lines.push(`\nConnectors: ${conns.length ? conns.map((c) => `${c.provider} as ${c.account} (${c.provider === "gmail" ? "employees can use it" : "connected only; nothing can use it yet"})`).join("; ") : "none"}`);
  const reports = listReports();
  if (reports.length) lines.push(`\nResearch reports (${reports.length}):`);
  for (const r of reports) lines.push(reportLine(r));
  lines.push("</workspace>");
  return lines.join("\n");
}

const KIND: Record<SourceKind, string> = { study: "Study", survey: "Industry survey", news: "News", vendor: "Vendor claim" };

/** One line per report for <workspace>: title, status, top finding, opportunities with their first estimate. No sources or quotes. */
function reportLine(r: ReportRow) {
  if (r.status === "researching") return "📈 Research running. Wait for [event] Report ready.";
  if (r.status === "failed" || !r.report) return `📈 Research failed: ${r.error ?? "unknown reason"}`;
  const rep = r.report;
  const top = strongestFinding(rep);
  const opps = [...rep.opportunities]
    .sort((a, b) => Number(b.id === rep.recommendedOpportunityId) - Number(a.id === rep.recommendedOpportunityId))
    .map((o) => {
      const e = rep.estimates.find((x) => o.estimateIds.includes(x.id));
      return `${o.title}${o.id === rep.recommendedOpportunityId ? " (recommended)" : ""}${e ? `: ${formatValue(e.low, e.high, e.unit)} ${e.label.toLowerCase()}` : ""}`;
    });
  return `📈 ${rep.title} (${r.status}).${top ? ` Top finding: ${top.finding.claim} (${KIND[top.kind]}).` : ""} Opportunities: ${opps.join("; ") || "none"}.`;
}

/** The CEO event when a report finishes (05 §4.7). */
function reportEvent(r: ReportRow) {
  if (r.status === "failed" || !r.report) return `[event] Research failed: ${r.error ?? "unknown reason"}`;
  const top = strongestFinding(r.report);
  const rec = r.report.opportunities.find((o) => o.id === r.report!.recommendedOpportunityId);
  return `[event] Report ready: "${r.report.title}" (${r.status}). Strongest finding: ${top ? `${top.finding.claim} (${KIND[top.kind]})` : "none"}. Recommended first step: ${rec?.title ?? "none"}.`;
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
  // Code gate (04 B5): nothing is built or hired before a research outcome; a failed report unlocks it too.
  if ((name === "build_app" || name === "hire_employee") && !hasResearchOutcome()) {
    return { isError: true, text: "Research first: call research_roi now with what you know, tell Marko it takes about a minute, and continue when the report is ready." };
  }
  switch (name) {
    case "research_roi": {
      if (researchRunning()) return { text: "Research is already running. Wait for [event] Report ready." };
      const row = createReport({ business: String(input.business ?? ""), location: input.location ?? null, pains: input.pains ?? [], inputs: input.inputs ?? [] });
      chat("report_card", { reportId: row.id });
      publish({ type: "state.changed" });
      startResearch(row.id, (done) => enqueue({ kind: "event", text: reportEvent(done) }));
      return { text: "Research started. Marko watches it on the card. Wait for [event] Report ready; don't summarise results you don't have." };
    }
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
        // A short pause before each reply, so tool events land first and the text doesn't arrive instantly.
        await mockCeoTurn(job, { say: async (t) => { await Bun.sleep(700); await say(t); }, tool: runTool });
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
