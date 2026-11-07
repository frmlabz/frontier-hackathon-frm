// Stretch A: the app spec is the source of truth and the code follows it.
// The CEO writes the body (Definitions / Functional specs / Starter data / Acceptance); the server adds frontmatter.
import { mkdirSync, writeFileSync } from "node:fs";
import { DATA_DIR, type App } from "./db";

export const SPEC_FORMAT = `## Definitions
- :Ingredient: — something the kitchen stocks; has name, quantity, unit, minimum, supplier.

## Functional specs
### list-ingredients
Marko sees every :Ingredient: in a table, lowest stock first, with a search box.

### low-stock-alert
An :Ingredient: at or below its minimum shows a red "Low" badge and is counted in a "Running low" stat.

## Starter data
Marko's ingredients: tomatoes, feta, olive oil, … with their suppliers. Realistic example stock and minimums; tomatoes and feta start below their minimum.

## Acceptance
- low-stock-alert: Tomatoes shows "Low".`;

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
}
