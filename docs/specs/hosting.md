# Hosting and tenancy

**Prototype:** one Bun process, one SQLite file and one workspace. Apps are served from the shell's origin at `/apps/:slug/` and read data through unauthenticated `/api/apps/:slug/*`.

## Design

- **Control plane** (shared): workspaces, members, plans and billing, the app registry (slug, versions, active version, spec hash), the model gateway and telemetry ingest.
- **Data plane** (per workspace): records, knowledge, specs and uploads. Storage is SQLite per tenant (libSQL/LiteFS-style replication) or a Postgres schema per tenant, behind `RecordStore` and `KnowledgeStore`. Bundles and files go to object storage.
- **App origins:** `<app>.<workspace>.bos.app`. The browser then isolates apps from the shell and from each other. The shell embeds them cross-origin, and `postMessage` checks the exact origin on both sides (`contracts/runtime.ts`).
- **App tokens:** the shell mints a short-lived token per (principal, app, version). `@bos/sdk` sends it, and the records API checks it against the app's collections and the principal's role.
- **Artifacts:** `<workspace>/<slug>/v<N>/app.js` is immutable and served from a CDN. Promoting a version only moves the registry pointer, and rollback works the same way.
- **Model gateway:** every model call goes through one service, which handles the per-workspace budget, rate limits, routing (model per task), caching policy and usage records. `server/claude.ts` (`requestOptions`, `logUsage`) is that seam in the prototype.
- **Agents:** CEO turns, builds and employee runs become jobs on a durable queue (one ordered queue per workspace for CEO turns). Today they are in-memory promises.

## Migration from the prototype

1. Add a `workspace` key to every table, and make `server/workspace.ts` resolve the workspace from the request instead of from the fixture.
2. Serve `/apps/*` from a second listener on another origin, and add token checks to the records routes.
3. Move `data/apps/**` to object storage behind an artifact interface.
