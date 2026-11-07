// Stretch A, step 4: acceptance checks. After each build, one cheap Claude call turns the spec's Acceptance list
// into DOM text checks that hold for the app's current data. The shell runs them in a hidden iframe (bos:check)
// and posts the results back; failures trigger one auto-fix rebuild.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { client, logUsage } from "./claude";
import { DATA_DIR, getApp, listRecords, type App } from "./db";
import { stripFrontmatter } from "./spec";

const MOCK = process.env.BOS_MOCK === "1";
const CHECK_MODEL = "claude-haiku-5-5";

/** row: a table row, list item or card (one without a table inside) whose text contains this must also contain `text`. No row: `text` appears anywhere on the page. */
export type Check = { id: string; label: string; row: string | null; text: string };
/** at: when the data the checks were written against was read. */
export type Checks = { version: number; at: number; items: Check[]; results: Record<string, boolean> | null };

const file = (slug: string, version: number) => `${DATA_DIR}/apps/${slug}/v${version}/checks.json`;

export function getChecks(slug: string, version: number): Checks | null {
  if (version < 1 || !existsSync(file(slug, version))) return null;
  try {
    return JSON.parse(readFileSync(file(slug, version), "utf8"));
  } catch {
    return null;
  }
}

export function acceptanceLines(spec: string): string[] {
  const m = /^## Acceptance\s*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(stripFrontmatter(spec));
  return (m?.[1] ?? "").split("\n").map((l) => l.replace(/^\s*[-*]\s+/, "").trim()).filter(Boolean);
}

/** Current rows of each collection, trimmed, so checks are written against what the app shows now (not just the seed). */
function dataSample(app: App) {
  const out: Record<string, any[]> = {};
  for (const c of app.schema ?? []) out[c.name] = listRecords(app.slug, c.name).slice(0, 40).map(({ id, createdAt, updatedAt, ...r }: any) => r);
  return out;
}

const SCHEMA = {
  type: "object",
  properties: {
    checks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "The spec block id the line starts with, e.g. low-stock-alert" },
          label: { type: "string", description: "Short plain-words label for Marko, max 6 words, e.g. Tomatoes flagged Low" },
          row: { type: ["string", "null"], description: "Exact text identifying one table row or card (usually the item name), or null for a page-wide check" },
          text: { type: "string", description: "Exact visible text that must appear (in that row, if row is set)" },
        },
        required: ["id", "label", "row", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["checks"],
  additionalProperties: false,
};

export async function generateChecks(app: App, lines: string[], data: Record<string, any[]>): Promise<Check[]> {
  const prompt = `Turn these acceptance lines for the "${app.name}" app into checks against the rendered page text.

<acceptance>
${lines.map((l) => `- ${l}`).join("\n")}
</acceptance>

<current_data>
${JSON.stringify(data)}
</current_data>

Rules:
- A check passes when \`text\` appears on the page, or inside the table row or card containing \`row\` when row is set. Matching is case-insensitive.
- Checks must hold for the current data above, which may have changed since the line was written (stock gets delivered). Drop a line that is no longer true for this data; never invert it.
- Use short texts the app certainly renders: an item name, a column header, a badge word like "Low", a button label. No numbers with units or formatting that might differ.
- One check per line at most. Skip lines that can't be checked from visible text.`;
  const msg: any = await client.beta.messages.create({
    model: CHECK_MODEL,
    max_tokens: 2000,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: prompt }],
  } as any);
  logUsage("checks", msg);
  const text = msg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  return (JSON.parse(text).checks as Check[]).filter((c) => c.text?.trim()).slice(0, 6);
}

/** Mock: `id: X shows "Y".` → row check (kept only while the data still says so); `id: X is listed.` → page check. */
function mockChecks(app: App, lines: string[], data: Record<string, any[]>): Check[] {
  const rows = Object.values(data).flat();
  const out: Check[] = [];
  for (const l of lines) {
    const [, id = "check", rest = l] = /^([\w-]+):\s*(.*)$/.exec(l) ?? [];
    let m = /^(.+?) shows "(.+?)"/.exec(rest);
    if (m) {
      const r = rows.find((x) => String(x.name ?? "").toLowerCase() === m![1]!.toLowerCase());
      const low = r && Number(r.quantity) <= Number(r.minimum);
      if (m[2] !== "Low" || low) out.push({ id, label: `${m[1]} shows ${m[2]}`, row: m[1]!, text: m[2]! });
      continue;
    }
    m = /^(.+?) (?:is listed|appears|is shown)/.exec(rest) ?? /has an? "?(.+?)"? column/.exec(rest);
    if (m) out.push({ id, label: rest.replace(/\.$/, ""), row: null, text: m[1]! });
  }
  return out;
}

/** Writes v<N>/checks.json for the app's live version. Never throws: no checks is a valid outcome. */
export async function prepareChecks(slug: string): Promise<boolean> {
  const app = getApp(slug);
  if (!app || app.version < 1) return false;
  const lines = acceptanceLines(app.spec);
  if (!lines.length) return false;
  const at = Date.now();
  const data = dataSample(app);
  let items: Check[] = [];
  try {
    items = MOCK ? mockChecks(app, lines, data) : await generateChecks(app, lines, data);
  } catch (e) {
    console.warn("[checks]", slug, e);
    return false;
  }
  if (!items.length || getApp(slug)?.version !== app.version) return false;
  const c: Checks = { version: app.version, at, items: items.map((x, i) => ({ ...x, id: `${x.id}#${i}` })), results: null };
  writeFileSync(file(slug, app.version), JSON.stringify(c, null, 2));
  return true;
}

/** True if any record of the app changed after the checks were written (e.g. an invoice import landed meanwhile). */
export function dataChangedSince(slug: string, at: number) {
  const app = getApp(slug);
  return (app?.schema ?? []).some((c) => listRecords(slug, c.name).some((r: any) => (r.updatedAt ?? 0) > at));
}

/** Records the first result set for a version. Returns the failed checks (empty if none, or already recorded). */
export function recordResults(slug: string, version: number, results: Record<string, boolean>): Check[] {
  const c = getChecks(slug, version);
  if (!c || c.results) return [];
  c.results = Object.fromEntries(c.items.map((x) => [x.id, !!results[x.id]]));
  writeFileSync(file(slug, version), JSON.stringify(c, null, 2));
  return c.items.filter((x) => !c.results![x.id]);
}
