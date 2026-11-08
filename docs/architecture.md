# Architecture

Business OS is a platform that writes, hosts and maintains software for one business at a time. Each workspace has an owner, an AI CEO that talks to them, a set of generated apps, AI employees that work in connected tools, and a knowledge layer that holds what the platform has learned about the business.

This repository contains the **prototype**: one Bun process that implements every part of the platform in its simplest form. The target system keeps the same boundaries. Each boundary is a contract in `contracts/`, and replacing an implementation should not change the code that calls it.

## Invariants

1. **Specs are the source of truth.** Every app is generated from its `spec.md`. Code is a build artifact and is never edited by hand or patched in place.
2. **Apps talk only through the runtime contract** (`contracts/runtime.ts`: `@bos/sdk`, `@bos/ui`, the records API and the `bos:*` messages). Hosting, isolation and storage can change without regenerating any app.
3. **Generated code never holds credentials.** Apps get an app-scoped token. Employees reach connectors through a broker that holds the tokens.
4. **The model never computes numbers that matter.** Report estimates, record writes and money values are computed or validated in code.
5. **Every action has a principal** (owner, member or AI employee), and every write records who made it.

## Components

```
                 ┌──────────── control plane ────────────┐
 owner/staff ──► │ identity · workspaces · app registry  │
                 │ model gateway · billing · telemetry   │
                 └───────┬───────────────────┬───────────┘
                         │                   │
              ┌──────────▼─────────┐  ┌──────▼────────────────────┐
              │ agents             │  │ data plane (per workspace) │
              │ CEO · builder ·    │  │ records · knowledge ·      │
              │ employees · healer │  │ specs · bundles · files    │
              └──────────┬─────────┘  └──────▲────────────────────┘
                         │ sandboxes         │ records API (app token)
              ┌──────────▼─────────┐  ┌──────┴────────────────────┐
              │ build / app /      │  │ app runtime (browser,      │
              │ employee microVMs  │  │ own origin per app)        │
              └────────────────────┘  └───────────────────────────┘
```

## Contracts and implementations

| Contract | Prototype (this repo) | Product | Spec |
|---|---|---|---|
| `RecordStore` | one SQLite `records` table, JSON rows (`server/db.ts`) | a store per workspace; schema and migrations derived from spec Definitions | [app-specs](specs/app-specs.md) |
| `BuildRunner` | `Bun.build` in-process (`server/bunBuild.ts`) | the same call inside a `build` microVM with no network | [sandbox](specs/sandbox.md) |
| `Sandbox` / `SandboxProvider` | not implemented; nothing generated runs on the server | Firecracker microVMs per kind: `build`, `app`, `employee` | [sandbox](specs/sandbox.md) |
| Runtime protocol | same-origin iframe at `/apps/:slug/`, `postMessage` | an origin per app (`<app>.<workspace>.bos.app`) with an app-scoped token | [hosting](specs/hosting.md) |
| `MailConnector` | a seeded inbox in SQLite (`server/mockGmail.ts`) | Gmail/IMAP adapters behind a token broker | [connectors](specs/connectors.md) |
| `KnowledgeStore` | Markdown pages, injected in full on every turn | an entity/fact graph with provenance; pages are views over it | [knowledge](specs/knowledge.md) |
| `Identity` | one implicit owner from `fixtures/workspace.json` | sessions and passkeys, members, roles, AI principals | [identity](specs/identity.md) |
| `Telemetry` | JSON lines in `logs/` (`server/telemetry.ts`) | OpenTelemetry traces, metrics and events | [observability](specs/observability.md) |
| Self-healing | one auto-fix rebuild per version on a runtime error or a failed check | a diagnose → fix → verify → canary loop | [self-healing](specs/self-healing.md) |

`server/platform.ts` is the composition root: it is the only place that picks implementations. The CEO, builder, employee and HTTP routes import `platform`, not the modules behind it.

## Request paths

**Chat turn.** `POST /api/chat` → the CEO queue (`server/ceo.ts`) → a streaming tool loop. The first content block of each user message is a `<workspace>` block rebuilt from state, so the system prompt never changes. Tool effects are published as `BusEvent`s over one WebSocket.

**App build.** `build_app` / `edit_app_spec` → `server/builder.ts`: the model writes `App.tsx` as structured output → import allowlist lint → `platform.builds.bundle` (up to 3 attempts, errors fed back) → promote `v<N>` → derive acceptance checks. The shell runs the checks in an offscreen iframe. A failure, or a `bos:error` from a live app, triggers one auto-fix.

**Employee run.** `run_employee` → `server/employee.ts`: a tool loop over `platform.mail` and `platform.records`. Each write publishes `records.changed`, and the shell forwards it into open app iframes as `bos:records`.

## What the prototype does not do

It has no auth or tenancy, it runs nothing generated on the server, connectors other than the mock Gmail are not functional, and it has no rollback beyond keeping old version directories. These are the subjects of `specs/`.
