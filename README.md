# Business OS

**Talk to your company. It builds itself.**

A small business owner opens a blank page and chats with an **AI CEO**. The CEO learns how the business works, sizes the pain against real research, and then builds, hosts and repairs small custom apps for it. It can also hire **AI Employees** that do recurring work in the owner's existing tools. The owner never sees code.

The source of truth is each app's **spec**, not its code. When needs change or something breaks, the affected app is regenerated from the spec.

## What works today

- **Hub:** a full-screen chat with the AI CEO, which uses tool calls to write knowledge pages, build apps, hire employees and request connectors.
- **Knowledge:** Notion-style pages about the business that grow during the conversation.
- **Generated apps:** Claude writes one `App.tsx` from the app spec. `Bun.build` bundles it into a versioned directory, and the app is served in an iframe with live records over a small SDK (`@bos/sdk`, `@bos/ui`).
- **Regeneration:** a per-app `spec.md` with per-block hashes. Editing the spec rebuilds only when a code-driving block changed. Acceptance checks are derived from the spec and run after every build, and a failure triggers one auto-fix.
- **AI Employee:** reads a (mock) Gmail inbox of supplier invoices and updates Inventory records, which the open app shows live.
- **ROI research:** before proposing anything, the CEO runs a web-research agent. The result is a validated report with sources, and all numbers are computed in code.
- **Connectors page:** a catalog with a fake sign-in. Only Gmail is wired up.
- **Photo import:** one vision call reads a paper invoice into stock updates.

## Run

```sh
devbox shell          # or direnv; pins bun, just, jq
bun install
echo "ANTHROPIC_API_KEY=..." > .env
bun dev               # :3000 live (empty), :3001 mock AI (seeded, no API spend)
```

`BOS_MOCK=1` swaps the three model call sites for scripted versions. Everything else (queue, DB, bundler, hosting, WebSocket) runs the real code path.

## Layout

```
server/    Bun.serve routes + ws, CEO loop, builder, employee, research, specs, checks, SQLite
runtime/   what generated apps import: sdk.ts (data), ui.tsx (kit), entry.tsx (error boundary)
web/       the shell: sidebar, hub, app/knowledge/team/report pages
fixtures/  seed state, mock apps, demo invoice
docs/      vision, build spec, connectors + ROI spec, roadmap
```

## Docs

- [`docs/01-product-vision.md`](docs/01-product-vision.md): the product and the user journey.
- [`docs/02-demo-spec.md`](docs/02-demo-spec.md): architecture, data model, API, app contract, prompts.
- [`docs/04-connectors-and-roi.md`](docs/04-connectors-and-roi.md): the connectors and the research-first opening.
- [`docs/roadmap.md`](docs/roadmap.md): what we would build next.

## Where it goes next

The demo runs in one process, for one workspace and one user, on SQLite. The roadmap covers what it takes to make this real:

| Area | Direction |
|---|---|
| Hosting and tenancy | Multi-tenant control plane, one data store per workspace, apps served from their own origin |
| MicroVMs | Each generated app and employee runs in a Firecracker microVM. The app contract stays the same |
| Observability | OpenTelemetry traces for every turn, build and run. App errors and usage come in through the SDK |
| Self-healing | Signal → diagnose → fix spec or data → regenerate → check → canary → promote or roll back |
| Spec-driven software | Specs as versioned, typed contracts: data migrations from spec diffs, shared definitions across apps |
| Adaptive knowledge | Typed entities with provenance, updated by conversations, apps, employees and connectors |
| Employee login | Real accounts and roles for human staff; scoped credentials for AI employees |
| Real connectors | OAuth, a token vault, per-employee scopes |

Details are in [`docs/roadmap.md`](docs/roadmap.md).
