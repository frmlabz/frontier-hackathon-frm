// Prototype BuildRunner: bundles a generated App.tsx in-process with Bun.build.
// The product runs the same step inside a `build` sandbox with no network (contracts/sandbox.ts).
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BuildRunner } from "../contracts/platform";

const ROOT = resolve(import.meta.dir, "..");
/** The only modules a generated app may import besides react. */
export const RUNTIME = {
  "@bos/sdk": `${ROOT}/runtime/sdk.ts`,
  "@bos/ui": `${ROOT}/runtime/ui.tsx`,
  "@bos/entry": `${ROOT}/runtime/entry.tsx`,
};

export const bunBuild: BuildRunner = {
  async bundle(dir) {
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
    if (result.success) return { ok: true };
    const error = result.logs
      .map((l: any) => String(l.message ?? l) + (l.position ? ` (line ${l.position.line}:${l.position.column}: ${l.position.lineText?.trim()})` : ""))
      .join("\n")
      .slice(0, 4000);
    return { ok: false, error };
  },
};
