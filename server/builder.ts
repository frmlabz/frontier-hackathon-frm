// App builder: Claude writes one App.tsx (structured output) → Bun.build → promote a new version.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { client, logUsage, requestOptions } from "./claude";
import { publish } from "./bus";
import {
  DATA_DIR, MOCK, countRecords, getApp, insertRecord, listKnowledge, patchApp, type App, type Collection,
} from "./db";
import { diffCount, pendingSpecChanges, writeSpec, type SpecDiff } from "./spec";
import { prepareChecks, type Check } from "./checks";

const ROOT = resolve(import.meta.dir, "..");
const RUNTIME = {
  "@bos/sdk": `${ROOT}/runtime/sdk.ts`,
  "@bos/ui": `${ROOT}/runtime/ui.tsx`,
  "@bos/entry": `${ROOT}/runtime/entry.tsx`,
};
export const STEPS = ["Designing your app", "Writing the app", "Packaging", "Ready"] as const;

export const UI_API = (() => {
  const src = readFileSync(RUNTIME["@bos/ui"], "utf8");
  return src.slice(src.indexOf("// @api-start") + 13, src.indexOf("// @api-end")).trim();
})();

const SDK_API = `type Rec = { id: string; createdAt: number; updatedAt: number };
// Live list of a collection; re-renders automatically when anyone (the user, an AI employee) changes it.
useCollection<T>(name: string): { items: (T & Rec)[]; loading: boolean }
db.list<T>(coll): Promise<(T & Rec)[]>
db.insert<T>(coll, data: T, id?: string): Promise<T & Rec>
db.update<T>(coll, id: string, patch: Partial<T>): Promise<T & Rec>   // shallow merge
db.remove(coll, id: string): Promise<void>
// Reads a photo/PDF with AI and returns JSON shaped as the instructions describe (e.g. invoice line items).
ai.extract(file: File, instructions: string): Promise<any>`;

const SYSTEM = `You write small, polished internal tools for a small business. Each tool is ONE React file (App.tsx) that runs inside the business's workspace (it looks like a Notion page).

The <spec> is the source of truth. Definitions describe the records (":Name:" is a defined record). Implement every "### id" block under Functional specs. "Starter data" says what seed_json contains. Every Acceptance line must hold for the seeded data.

Hard rules:
- Imports allowed: "react", "@bos/ui", "@bos/sdk". Nothing else. No fetch, no localStorage, no window.parent.
- export default function App(). Self-contained, under ~300 lines, TypeScript/TSX.
- All data lives in collections via @bos/sdk. Declare every collection you use in "collections" with its fields. Use only those.
- Never hard-code sample data in the code. Initial data goes in "seed_json": a JSON object string mapping collection name → array of records (field values only, no id/createdAt/updatedAt). Realistic, specific to this business, 6–14 rows for the main collection.
- Visual styling comes ONLY from @bos/ui components. Tailwind classes are allowed for layout only (flex, grid, gap-*, w-*, mt-*, etc.), never for colors, fonts, borders or shadows.
- Start with <Page><Header emoji=… title=… subtitle=… actions=…/> … </Page>. The Header emoji and title must match the app.
- A typical layout: a row of 3–4 Stat tiles (Grid cols), then a toolbar (search Input + filter Select + primary "Add" Button that opens a Modal form), then the main Table. Exactly one "Add" button per page (toolbar or Header actions, never both). The main Table has inline editing (onEdit → db.update) and onDelete. Use Badge for statuses, rowTone to highlight rows that need attention, EmptyState when there are no rows.
- Numbers are numbers (not strings). When saving from inputs convert with Number(). Guard against missing fields in records (AI employees may write partial records): use ?? defaults.
- Handle loading (Table loading prop) and empty states. Toast on add/delete.
- Photo/PDF import (e.g. a paper invoice), only when the spec asks for it: a header Button opens a side Modal with a FileDrop (busy while reading). On a file, call ai.extract(file, instructions) where instructions state the exact JSON shape (e.g. {"supplier": string, "lines": [{"name": string, "quantity": number, "unit": string}]}); the server already matches names to existing records. Show a small preview of the photo (URL.createObjectURL) and the lines in an editable review Table with a Badge per line: the change it will make to the matching record (case-insensitive name match, e.g. "4 → 12") or "New item". A primary Button applies it (db.update matches, db.insert the rest), then toast and close. On error, toast("Couldn't read that photo", "error").
- Keep it simple and robust over clever. No external state libs, no routing, no timers that write data.

@bos/ui (import named components from "@bos/ui"):
\`\`\`ts
${UI_API}
\`\`\`

@bos/sdk (import { useCollection, db, ai } from "@bos/sdk"):
\`\`\`ts
${SDK_API}
\`\`\`

Output: JSON with "code" (the full App.tsx), "collections" (name + fields; field type is text|number|date|boolean; unit is "" when none) and "seed_json".`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    code: { type: "string", description: "Full contents of App.tsx" },
    collections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          fields: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                type: { type: "string", enum: ["text", "number", "date", "boolean"] },
                unit: { type: "string" },
              },
              required: ["name", "type", "unit"],
              additionalProperties: false,
            },
          },
        },
        required: ["name", "fields"],
        additionalProperties: false,
      },
    },
    seed_json: { type: "string", description: "JSON object: collection name → array of records" },
  },
  required: ["code", "collections", "seed_json"],
  additionalProperties: false,
};

export type BuildOutput = { code: string; collections: Collection[]; seed: Record<string, any[]> | null };
type BuildReason = { changeRequest?: string; error?: string; failedChecks?: Check[] };

const running = new Set<string>();
const queued = new Set<string>(); // spec edits saved during a build; they rebuild as soon as it ends
const autoFixed = new Set<string>(); // `${slug}@v${n}` that already got their one auto-fix
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function setStatus(slug: string, p: Parameters<typeof patchApp>[1]) {
  const a = patchApp(slug, p);
  publish({ type: "app.status", slug, status: a.status, step: a.step, version: a.version, error: a.error });
  return a;
}

export const isBuilding = (slug: string) => running.has(slug);

/** Rebuilds the app from its saved spec once the running build finishes (or now, if none is running). */
export function queueBuild(slug: string) {
  if (!startBuild(slug)) queued.add(slug);
}

/** Starts a build in the background. Returns false if one is already running for this app. */
export function startBuild(slug: string, reason: BuildReason = {}) {
  if (running.has(slug)) return false;
  running.add(slug);
  build(slug, reason)
    .catch((e) => {
      console.error("[builder]", slug, e);
      setStatus(slug, { status: "failed", step: "Failed", error: "I couldn't finish this app. Ask me to try again." });
    })
    .finally(() => {
      running.delete(slug);
      if (queued.delete(slug)) startBuild(slug);
    });
  return true;
}

/** [P1] The iframe reported a crash on the current version: one rebuild with the error, per version. */
export function autoFix(slug: string, message: string, stack: string) {
  const app = getApp(slug);
  if (!app || app.status !== "ready" || app.version < 1) return false;
  const key = `${slug}@v${app.version}`;
  if (autoFixed.has(key)) return false;
  autoFixed.add(key);
  return startBuild(slug, { error: `${message}\n${stack}`.slice(0, 3000) });
}

/** Acceptance checks failed on the current version: one rebuild with the failures (shares the one-fix-per-version budget). */
export function checkFix(slug: string, failed: Check[]) {
  const app = getApp(slug);
  if (!app || app.status !== "ready" || app.version < 1 || !failed.length) return false;
  const key = `${slug}@v${app.version}`;
  if (autoFixed.has(key)) return false;
  autoFixed.add(key);
  return startBuild(slug, { failedChecks: failed });
}

function userPrompt(app: App, reason: BuildReason, code: string | null, diff: SpecDiff | null) {
  const knowledge = listKnowledge().map((p) => `## ${p.emoji} ${p.title}\n${p.markdown}`).join("\n\n");
  const parts = [
    `<business_knowledge>\n${knowledge || "(none yet)"}\n</business_knowledge>`,
    `<app>\nName: ${app.name}\nEmoji: ${app.emoji}\nDescription: ${app.description}\n</app>`,
    `<spec>\n${app.spec}\n</spec>`,
  ];
  if (code) {
    parts.push(`<current_code>\n${code}\n</current_code>`);
    parts.push(`<current_collections>\n${JSON.stringify(app.schema)}\n</current_collections>`);
    parts.push(
      "This is a rebuild. Existing records must keep working: keep every existing collection and field name (you may add new ones). seed_json is ignored on rebuilds; return \"{}\".",
    );
  }
  if (diffCount(diff)) {
    const d = diff!;
    const list = [...d.added.map((id) => `${id} (new)`), ...d.changed.map((id) => `${id} (changed)`), ...d.removed.map((id) => `${id} (removed)`)];
    parts.push(`<spec_change>\nThe spec changed since the current code was generated. Blocks: ${list.join(", ")}.\nRegenerate App.tsx so it implements the full spec, focusing on these blocks; keep everything else working as it does now.\n</spec_change>`);
  }
  if (reason.changeRequest) parts.push(`<change_request>\n${reason.changeRequest}\n</change_request>`);
  if (reason.failedChecks?.length)
    parts.push(
      `<failed_checks>\nThe app runs, but these acceptance checks from the spec failed against the rendered page on first load:\n${reason.failedChecks.map((c) => `- ${c.label}: expected "${c.text}"${c.row ? ` in the row for "${c.row}"` : " on the page"}`).join("\n")}\nFix the app so they pass without any clicks: the rows and text must be visible when the page opens.\n</failed_checks>`,
    );
  if (reason.error) parts.push(`<runtime_error>\nThe current version crashed in the browser with:\n${reason.error}\nFix the cause.\n</runtime_error>`);
  if (!code) parts.push(`Today is ${new Date().toISOString().slice(0, 10)}. Seed dates must be within the last two weeks.`);
  parts.push(code ? "Return the full updated app." : "Write the app.");
  return parts.join("\n\n");
}

async function generate(app: App, messages: any[], onWriting: () => void): Promise<{ out: BuildOutput; content: any[] }> {
  const opts = requestOptions("medium");
  const stream = client.beta.messages.stream({
    ...opts,
    output_config: { ...opts.output_config, format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    system: SYSTEM,
    messages,
  } as any);
  let writing = false;
  stream.on("text", () => {
    if (!writing) {
      writing = true;
      onWriting();
    }
  });
  const msg: any = await stream.finalMessage();
  logUsage("builder", msg);
  if (msg.stop_reason === "refusal") throw new Error("refusal");
  const text = msg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  const raw = JSON.parse(text);
  let seed: Record<string, any[]> | null = null;
  try {
    const v = JSON.parse(raw.seed_json || "{}");
    if (v && typeof v === "object" && !Array.isArray(v)) seed = v;
  } catch {}
  const collections: Collection[] = raw.collections.map((c: any) => ({
    name: c.name,
    fields: c.fields.map((f: any) => ({ name: f.name, type: f.type, ...(f.unit ? { unit: f.unit } : {}) })),
  }));
  return { out: { code: raw.code, collections, seed }, content: msg.content };
}

const transpiler = new Bun.Transpiler({ loader: "tsx" });

/** Static checks the bundler can't do for us. Returns an error message or null. */
function lint(code: string): string | null {
  // Bun's parser, not a regex: UI text like 'import them from "the photo"' isn't an import. Syntax errors are left to Bun.build.
  let imports: string[] = [];
  try {
    imports = transpiler.scanImports(code).map((i) => i.path);
  } catch {}
  const bad = imports.filter((i) => !/^(react|react\/jsx-(dev-)?runtime|@bos\/ui|@bos\/sdk)$/.test(i));
  if (bad.length) return `Disallowed imports: ${bad.join(", ")}. Only "react", "@bos/ui" and "@bos/sdk" are available.`;
  if (!/export\s+default/.test(code)) return "App.tsx must `export default` the App component.";
  if (/\bfetch\s*\(/.test(code)) return "Do not call fetch(); use db / useCollection from @bos/sdk.";
  return null;
}

/** First builds must ship starter rows, or the demo opens on an empty app. */
function seedProblem(out: BuildOutput): string | null {
  const main = out.collections[0]?.name;
  if (!out.seed) return "seed_json was not a valid JSON object string. Return seed_json as a JSON object string mapping collection name → array of records.";
  if (main && !(Array.isArray(out.seed[main]) && out.seed[main].length > 0)) return `seed_json has no starter rows for "${main}". Include 6–14 realistic records.`;
  return null;
}

export async function bundle(dir: string) {
  // @bos/entry first: its error listeners must exist before App.tsx's top-level code runs.
  writeFileSync(`${dir}/entry.tsx`, `import { mount } from "@bos/entry";\nimport App from "./App.tsx";\nmount(App);\n`);
  const result = await Bun.build({
    entrypoints: [`${dir}/entry.tsx`],
    outdir: dir,
    target: "browser",
    naming: "app.js",
    throw: false, // return errors so the retry loop can feed them back to the model
    minify: { whitespace: true, syntax: true },
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "bos-runtime",
        setup(b) {
          b.onResolve({ filter: /^@bos\/(sdk|ui|entry)$/ }, (args) => ({ path: RUNTIME[args.path as keyof typeof RUNTIME] }));
        },
      },
    ],
  });
  if (result.success) return null;
  return result.logs.map((l: any) => String(l.message ?? l) + (l.position ? ` (line ${l.position.line}:${l.position.column}: ${l.position.lineText?.trim()})` : "")).join("\n").slice(0, 4000);
}

async function build(slug: string, reason: BuildReason) {
  let app = getApp(slug)!;
  const prevVersion = app.version;
  const next = prevVersion + 1;
  const prevCode = prevVersion > 0 && existsSync(`${DATA_DIR}/apps/${slug}/v${prevVersion}/App.tsx`)
    ? readFileSync(`${DATA_DIR}/apps/${slug}/v${prevVersion}/App.tsx`, "utf8")
    : null;
  const fixing = !!reason.error || !!reason.failedChecks?.length;

  setStatus(slug, { status: fixing ? "fixing" : "generating", step: STEPS[0], error: null });

  const dir = `${DATA_DIR}/apps/${slug}/v${next}`;
  mkdirSync(dir, { recursive: true });
  const messages: any[] = [{ role: "user", content: userPrompt(app, reason, prevCode, prevCode ? pendingSpecChanges(app) : null) }];
  let lastErr = "";

  for (let attempt = 1; attempt <= 3; attempt++) {
    let out: BuildOutput;
    if (MOCK) {
      const { mockGenerate } = await import("./mockAi");
      out = await mockGenerate(app, () => setStatus(slug, { step: STEPS[1] }));
    } else {
      const r = await generate(app, messages, () => setStatus(slug, { step: STEPS[1] }));
      out = r.out;
      messages.push({ role: "assistant", content: r.content });
    }

    setStatus(slug, { status: fixing ? "fixing" : "building", step: STEPS[2] });
    writeFileSync(`${dir}/App.tsx`, out.code);
    const err = lint(out.code) ?? (prevVersion === 0 ? seedProblem(out) : null) ?? (await bundle(dir));
    if (!err) {
      // A version produced by an auto-fix never gets another one, so a fix that still crashes can't loop.
      if (fixing) autoFixed.add(`${slug}@v${next}`);
      promote(slug, next, out, prevVersion === 0, app.spec);
      return;
    }
    lastErr = err;
    console.warn(`[builder] ${slug} v${next} attempt ${attempt} failed:\n${err}`);
    if (MOCK) break;
    messages.push({ role: "user", content: `The build failed:\n${err}\n\nFix it and return the full corrected output.` });
    setStatus(slug, { step: STEPS[1] });
  }
  app = getApp(slug)!;
  // A failed rebuild keeps the previous working version live.
  if (prevVersion > 0) {
    setStatus(slug, { status: "ready", step: STEPS[3], error: "The last change couldn't be applied; the previous version is still live." });
  } else {
    setStatus(slug, { status: "failed", step: "Failed", error: "I couldn't get this app to work. Ask me to try a simpler version." });
  }
  console.error(`[builder] ${slug} gave up: ${lastErr.slice(0, 300)}`);
}

function promote(slug: string, version: number, out: BuildOutput, first: boolean, builtSpec: string) {
  const app = getApp(slug)!;
  writeSpec({ ...app, spec: builtSpec }, version); // the spec this version was built from
  // Schema changes are additive: keep fields the new build forgot so employees still see them.
  const merged: Collection[] = [...out.collections];
  for (const old of app.schema ?? []) {
    const cur = merged.find((c) => c.name === old.name);
    if (!cur) merged.push(old);
    else for (const f of old.fields) if (!cur.fields.some((x) => x.name === f.name)) cur.fields.push(f);
  }
  const seeded: string[] = [];
  if (first) {
    for (const c of out.collections) {
      const rows = out.seed?.[c.name];
      if (Array.isArray(rows) && countRecords(slug, c.name) === 0) {
        for (const r of rows) insertRecord(slug, c.name, r);
        seeded.push(c.name);
      }
    }
  }
  setStatus(slug, { schema: merged, version, status: "ready", step: STEPS[3], error: null });
  for (const c of seeded) publish({ type: "records.changed", app: slug, collection: c });
  publish({ type: "state.changed" });
  // Acceptance checks for this version; the shell runs them once they exist.
  void prepareChecks(slug).then((ok) => ok && publish({ type: "state.changed" }));
}

