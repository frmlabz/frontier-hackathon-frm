import index from "../web/index.html";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { publish, setServer, TOPIC } from "./bus";
import {
  DATA_DIR, MOCK, connect, createApp, deleteRecord, getApp, insertChatItem, insertRecord, kv, listRecords, snapshot, updateRecord,
} from "./db";
import { autoFix, bundle, checkFix, startBuild } from "./builder";
import { dataChangedSince, getChecks, prepareChecks, recordResults } from "./checks";
import { specChangeIds } from "./spec";
import { applySpecEdit, enqueue, isBusy } from "./ceo";
import { MODEL } from "./claude";

const ROOT = resolve(import.meta.dir, "..");
const json = (data: any, status = 200) => Response.json(data, { status });
const body = async (req: Request) => {
  try {
    return await req.json();
  } catch {
    return {};
  }
};

let kitBuild: Promise<string | null> | null = null;
async function buildKit() {
  const dir = `${DATA_DIR}/kit`;
  mkdirSync(dir, { recursive: true });
  copyFileSync(`${ROOT}/fixtures/kit/App.tsx`, `${dir}/App.tsx`);
  return bundle(dir);
}

function appHtml(src: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="/runtime/ui.css" />
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.1.13"></script>
</head>
<body>
<div id="root"></div>
<script type="module" src="${src}"></script>
</body>
</html>`;
}

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  idleTimeout: 120,
  development: process.env.NODE_ENV !== "production" && { hmr: true, console: true },
  routes: {
    "/ws": (req, srv) => (srv.upgrade(req) ? undefined : new Response("expected websocket", { status: 400 })),

    "/api/state": () => {
      const s = snapshot();
      const apps = s.apps.map((a) => ({ ...a, specChanges: specChangeIds(a), checks: getChecks(a.slug, a.version) }));
      return json({ ...s, apps, model: MODEL, busy: isBusy() });
    },

    "/api/chat": {
      POST: async (req) => {
        const { text } = await body(req);
        if (!text || typeof text !== "string" || !text.trim()) return json({ error: "empty" }, 400);
        const item = insertChatItem("user", { text: text.trim() });
        publish({ type: "chat.item", item });
        enqueue({ kind: "user", text: text.trim() });
        return json({ ok: true, item }, 202);
      },
    },

    "/api/connectors/gmail/connect": {
      POST: async (req) => {
        const { account = "marko@markosbistro.com" } = await body(req);
        await Bun.sleep(MOCK ? 700 : 500); // the "Connecting…" moment on the button
        connect("gmail", account);
        publish({ type: "state.changed" });
        const pending = kv.get("pending:gmail") ?? "";
        const item = insertChatItem("event", { icon: "plug", text: `Gmail connected as ${account}` });
        publish({ type: "chat.item", item });
        enqueue({ kind: "event", text: `[event] Gmail connected as ${account}.${pending ? ` Pending task: ${pending}` : ""}` });
        return json({ ok: true, account });
      },
    },

    "/api/dev/build": {
      POST: async (req) => {
        const b = await body(req);
        const app = createApp({
          name: b.name ?? "Inventory",
          emoji: b.emoji ?? "🥫",
          description: b.description ?? "Track ingredient stock levels",
          spec: b.spec ?? "## Functional specs\n### list-ingredients\nTrack ingredients: name, quantity, unit, minimum stock, supplier. Highlight low stock.",
        });
        publish({ type: "state.changed" });
        startBuild(app.slug);
        return json(app, 202);
      },
    },

    // Stretch A: Marko edits the spec on the Spec tab; the app regenerates from it.
    "/api/apps/:slug/spec": {
      PUT: async (req) => {
        const { markdown = "" } = await body(req);
        const r = applySpecEdit(req.params.slug, String(markdown), "Edited the spec");
        return json({ ok: !r.isError, message: r.text }, r.building ? 409 : r.isError ? 400 : 200);
      },
    },

    "/api/apps/:slug/checks": {
      POST: async (req) => {
        const { version, results = {} } = await body(req);
        const slug = req.params.slug;
        if (getApp(slug)?.version !== Number(version)) return json({ ok: false, stale: true });
        const before = getChecks(slug, Number(version));
        if (!before || before.results) return json({ ok: true, failed: 0, fixing: false });
        // Failures against data that changed after the checks were written don't count: rewrite the checks and rerun.
        if (Object.values(results).some((v) => !v) && dataChangedSince(slug, before.at)) {
          void prepareChecks(slug).then(() => publish({ type: "state.changed" }));
          return json({ ok: true, rechecking: true });
        }
        const failed = recordResults(slug, Number(version), results);
        publish({ type: "state.changed" });
        const fixing = failed.length ? checkFix(slug, failed) : false;
        return json({ ok: true, failed: failed.length, fixing });
      },
    },

    "/api/apps/:slug/error": {
      POST: async (req) => {
        const { message = "", stack = "" } = await body(req);
        const started = autoFix(req.params.slug, String(message), String(stack));
        return json({ ok: true, fixing: started });
      },
    },

    "/api/apps/:slug/:coll": {
      GET: (req) => json(listRecords(req.params.slug, req.params.coll)),
      POST: async (req) => {
        const { slug, coll } = req.params;
        if (!getApp(slug)) return json({ error: "no such app" }, 404);
        const { data = {}, id } = await body(req);
        const rec = insertRecord(slug, coll, data, id);
        publish({ type: "records.changed", app: slug, collection: coll });
        return json(rec, 201);
      },
    },

    "/api/apps/:slug/:coll/:id": {
      PATCH: async (req) => {
        const { slug, coll, id } = req.params;
        const { patch = {} } = await body(req);
        const rec = updateRecord(slug, coll, id, patch);
        if (!rec) return json({ error: "not found" }, 404);
        publish({ type: "records.changed", app: slug, collection: coll });
        return json(rec);
      },
      DELETE: (req) => {
        const { slug, coll, id } = req.params;
        deleteRecord(slug, coll, id);
        publish({ type: "records.changed", app: slug, collection: coll });
        return new Response(null, { status: 204 });
      },
    },

    "/runtime/ui.css": () => new Response(Bun.file(`${ROOT}/runtime/ui.css`), { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "no-cache" } }),

    "/apps/:slug/*": (req) => {
      const { slug } = req.params;
      const app = getApp(slug);
      if (!app) return new Response("Not found", { status: 404 });
      const rest = new URL(req.url).pathname.slice(`/apps/${slug}/`.length);
      if (rest === "" || rest === "index.html") {
        if (app.version < 1) return new Response("Still building", { status: 404 });
        // The build time is in the URL: bundles are cached forever, and a reset DB restarts at v1.
        const built = Math.round(Bun.file(`${DATA_DIR}/apps/${slug}/v${app.version}/app.js`).lastModified);
        return new Response(appHtml(`/apps/${slug}/v${app.version}/app.js?b=${built}`), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      }
      const m = rest.match(/^v(\d+)\/app\.js$/);
      const file = m && `${DATA_DIR}/apps/${slug}/v${m[1]}/app.js`;
      if (!file || !existsSync(file)) return new Response("Not found", { status: 404 });
      return new Response(Bun.file(file), { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=31536000, immutable" } });
    },

    // Dev: the UI kit showcase, bundled once per server start through the same pipeline as generated apps.
    "/dev/kit/frame": () => new Response(appHtml("/dev/kit/app.js"), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }),
    "/dev/kit/app.js": async () => {
      const err = await (kitBuild ??= buildKit());
      if (err) return new Response(`console.error(${JSON.stringify(err)})`, { headers: { "content-type": "text/javascript" } });
      return new Response(Bun.file(`${DATA_DIR}/kit/app.js`), { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" } });
    },

    "/apps/:slug": (req) => Response.redirect(`/apps/${req.params.slug}/`, 302),

    "/*": index,
  },
  websocket: {
    open(ws) {
      ws.subscribe(TOPIC);
    },
    message() {},
    close(ws) {
      ws.unsubscribe(TOPIC);
    },
  },
});

setServer(server);
console.log(`Business OS on ${server.url} · model ${MODEL}${MOCK ? " · MOCK MODE" : ""} · data ${DATA_DIR}`);
