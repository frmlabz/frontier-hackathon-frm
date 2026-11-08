# Business OS

**Talk to your company. It builds itself.**

A small business owner opens a blank page and chats with an **AI CEO**. The CEO learns how the business works and sizes its problems against real research. It then builds, hosts and repairs small custom apps for the business, and hires **AI Employees** that do recurring work in the tools the owner already uses. The owner never sees code.

The source of truth for every app is its **spec**, not its code. When needs change or something breaks, the app is regenerated from the spec.

## Built (demo)

This repo is a working prototype: one Bun process, one SQLite file, one workspace.

- **Hub:** a full-screen chat with the AI CEO. Its tool calls write knowledge pages, build apps, hire employees and request connectors.
- **Generated apps:** Claude writes one `App.tsx` from the app spec. It is bundled into a versioned directory and served in an iframe with live records over a small runtime (`@bos/sdk`, `@bos/ui`).
- **Regeneration:** a `spec.md` per app with per-block hashes. A spec edit rebuilds the app only when a block that drives the code changed. Acceptance checks are derived from the spec, and a failure triggers one auto-fix.
- **AI Employee:** reads a mock Gmail inbox of supplier invoices and updates Inventory records while the app is open.
- **ROI research:** before proposing anything, the CEO runs a web-research agent and produces a validated report with sources. All numbers are computed in code.
- **Connectors catalog** with a fake sign-in (only Gmail is wired up), and **photo import** that reads a paper invoice into stock updates.

## Planned (product)

The platform boundaries are already contracts in [`contracts/`](contracts). The prototype implements each one in its simplest form ([`server/platform.ts`](server/platform.ts)), and the product replaces the implementations without changing the callers. See [`docs/architecture.md`](docs/architecture.md).

| Area | Prototype | Product | Spec |
|---|---|---|---|
| Isolation | builds run in-process, apps run only in the browser | Firecracker microVMs for builds, app backends and employee workspaces | [sandbox](docs/specs/sandbox.md) |
| Hosting | one process, same-origin apps | control plane plus a data plane per workspace, an origin per app, immutable bundles on a CDN | [hosting](docs/specs/hosting.md) |
| Observability | JSONL usage and error signals | OpenTelemetry traces across turns, builds and runs; app telemetry collected by the runtime | [observability](docs/specs/observability.md) |
| Self-healing | one auto-fix per version | detect → diagnose (code, spec or data) → fix → regression checks → canary → promote or roll back | [self-healing](docs/specs/self-healing.md) |
| Spec-driven apps | one-file apps, additive schema | typed Definitions as the schema, migrations from spec diffs, shared definitions, partial regeneration | [app-specs](docs/specs/app-specs.md) |
| Knowledge | Markdown pages in every prompt | an entity and fact graph with provenance, retrieval by task, pages as views | [knowledge](docs/specs/knowledge.md) |
| Identity | one implicit owner | passkey login, roles enforced by the records API, scoped AI principals | [identity](docs/specs/identity.md) |
| Connectors | mock Gmail | OAuth adapters, a token broker, per-employee scopes, event triggers | [connectors](docs/specs/connectors.md) |

## Run

```sh
devbox shell          # or direnv; pins bun, just, jq
bun install
echo "ANTHROPIC_API_KEY=..." > .env
bun dev               # :3000 live (empty), :3001 mock AI (seeded, no API spend)
```

`BOS_MOCK=1` replaces the model calls with scripted ones. Everything else (the queue, DB, bundler, hosting and WebSocket) runs the real code path. The demo workspace comes from `fixtures/workspace.json`; override it with `BOS_WORKSPACE`, `BOS_OWNER` and `BOS_OWNER_EMAIL`.

## Layout

```
contracts/  platform interfaces: domain types, services, runtime protocol, sandbox
server/     Bun.serve + ws, CEO, builder, employee, research, specs, checks, SQLite; platform.ts wires the contracts
runtime/    what generated apps import: sdk.ts, ui.tsx, entry.tsx
web/        the shell: sidebar, hub, app/knowledge/team/report pages
fixtures/   demo workspace, seed state, mock apps, demo invoice
docs/       vision, architecture, product specs, prototype spec
```

## Docs

- [`docs/01-product-vision.md`](docs/01-product-vision.md): the product and the user journey.
- [`docs/architecture.md`](docs/architecture.md): invariants, components, and contracts mapped to their prototype and product implementations.
- [`docs/specs/`](docs/specs): one design spec per platform area.
- [`docs/02-demo-spec.md`](docs/02-demo-spec.md): the prototype as built: data model, API, app contract, exact prompts.
- [`docs/04-connectors-and-roi.md`](docs/04-connectors-and-roi.md): connectors and the research-first opening.
