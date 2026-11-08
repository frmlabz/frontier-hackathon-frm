// Stretch A: the app spec is the source of truth and the code follows it.
// The CEO writes the body (Definitions / Functional specs / Starter data / Acceptance); the server adds frontmatter.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { DATA_DIR, type App } from "./db";

export const SPEC_FORMAT = `## Definitions
- :Supply: — something the business keeps in stock; has name, quantity, unit, minimum (same unit) and supplier.

## Functional specs
### list-supplies
Marko sees every :Supply: in a table, lowest stock first, with a search box.

### low-stock-alert
A :Supply: whose quantity is at or below its minimum shows a red "Low" badge and is counted in a "Running low" stat. A :Supply: without a minimum is never Low.

### add-supply
Marko can add a :Supply: from an "Add supply" form; only the name is required.

## Starter data
- Paper cups: 300 pcs, minimum 500 pcs, from CleanPro
- Napkins: 20 packs, minimum not given, from CleanPro
- Dish soap: quantity not given, minimum not given, supplier not given

## Acceptance
- list-supplies: Dish soap is listed.
- low-stock-alert: Paper cups shows "Low".`;

export const stripFrontmatter = (md: string) => md.replace(/^---\n[\s\S]*?\n---\n*/, "");

export function specFile(app: Pick<App, "slug" | "emoji" | "spec">) {
  return `---\napp: ${app.slug}\nemoji: ${app.emoji}\n---\n${stripFrontmatter(app.spec).trim()}\n`;
}

/** Adds a ### block at the end of Functional specs (before Starter data / Acceptance). */
export function addSpecBlock(spec: string, id: string, text: string) {
  const block = `### ${id}\n${text.trim()}\n\n`;
  const m = spec.match(/^## (Starter data|Acceptance)/m);
  return m ? spec.slice(0, m.index) + block + spec.slice(m.index) : `${spec.trimEnd()}\n\n${block}`;
}

/** Writes data/apps/<slug>/spec.md (and the copy a version was built from, when given). */
export function writeSpec(app: Pick<App, "slug" | "emoji" | "spec">, version?: number) {
  const dir = `${DATA_DIR}/apps/${app.slug}`;
  mkdirSync(version ? `${dir}/v${version}` : dir, { recursive: true });
  writeFileSync(version ? `${dir}/v${version}/spec.md` : `${dir}/spec.md`, specFile(app));
  if (version) writeFileSync(`${dir}/v${version}/hashes.json`, JSON.stringify(hashSpec(app.spec), null, 2));
}

// ---------- per-block hashing (step 2) ----------
/** Blocks that drive the code: each "### id" under Functional specs, plus Definitions and Acceptance as a whole. */
export function specBlocks(md: string): Record<string, string> {
  const out: Record<string, string> = {};
  let id: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (id) out[id] = buf.join("\n").trim();
    id = null;
    buf = [];
  };
  for (const line of stripFrontmatter(md).split("\n")) {
    const h3 = /^###\s+(.+)/.exec(line);
    const h2 = /^##\s+(.+)/.exec(line);
    if (h3) {
      flush();
      id = h3[1]!.trim();
    } else if (h2) {
      flush();
      const section = h2[1]!.trim().toLowerCase();
      if (section === "definitions" || section === "acceptance") id = section;
    } else if (id) buf.push(line);
  }
  flush();
  return out;
}

/** Ids of spec blocks that differ from what the live version was built from. */
export const specChangeIds = (app: Pick<App, "slug" | "version" | "spec">) => {
  const d = pendingSpecChanges(app);
  return d ? [...d.added, ...d.changed, ...d.removed] : [];
};

export const hashSpec = (md: string) =>
  Object.fromEntries(Object.entries(specBlocks(md)).map(([k, v]) => [k, Bun.hash(v.replace(/\s+/g, " ")).toString(16)]));

export type SpecDiff = { added: string[]; changed: string[]; removed: string[] };
export const diffCount = (d: SpecDiff | null) => (d ? d.added.length + d.changed.length + d.removed.length : 0);

/** Hashes the given version was built from (null for versions built before Stretch A). */
export function builtHashes(slug: string, version: number): Record<string, string> | null {
  const dir = `${DATA_DIR}/apps/${slug}/v${version}`;
  if (existsSync(`${dir}/hashes.json`)) return JSON.parse(readFileSync(`${dir}/hashes.json`, "utf8"));
  return null;
}

/** Which spec blocks changed since the live version was built. */
export function pendingSpecChanges(app: Pick<App, "slug" | "version" | "spec">): SpecDiff | null {
  const before = app.version > 0 ? builtHashes(app.slug, app.version) : null;
  if (!before) return null;
  const now = hashSpec(app.spec);
  return {
    added: Object.keys(now).filter((k) => !(k in before)),
    changed: Object.keys(now).filter((k) => k in before && before[k] !== now[k]),
    removed: Object.keys(before).filter((k) => !(k in now)),
  };
}
