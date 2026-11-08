# Roadmap

What we would build after the demo. Each section covers the current state, the target and the smallest first step. The rule that holds across all of them: **generated apps only talk to the platform through the runtime contract** (`@bos/sdk`, `@bos/ui`, `postMessage` events). As long as that contract holds, the hosting, isolation and data behind it can change without regenerating any app.

---

## 1. Hosting and tenancy

**Now:** one Bun process, one SQLite file, one workspace. Apps are served from the shell's origin.

**Target:**
- **Control plane:** workspaces, members, billing and the app registry (slug, versions, active version, spec hash).
- **Data plane per workspace:** its own database (SQLite per tenant or Postgres schema per tenant) and object storage for bundles, uploads and specs.
- **Apps on their own origin** (`<app>.<workspace>.bos.app`) so the browser isolates them from the shell and from each other. The SDK API is authenticated with a short-lived, app-scoped token.
- **Bundles are immutable artifacts** (`<slug>/v<N>/app.js`, content-addressed) behind a CDN. Promoting a version is a pointer change.
- **Model calls go through one gateway** that handles per-workspace budgets, rate limits, model routing and usage records. `server/claude.ts` already centralises request options and usage logging.

**First step:** move `data/` behind a `Storage` interface (records, files, bundles) and serve apps from a separate origin with token auth.

## 2. MicroVM isolation

**Now:** generated code runs only in the browser iframe. Builds run in-process with `Bun.build`, and nothing generated runs on the server.

**Target:** anything generated or agent-driven that executes on the server runs in a **Firecracker microVM**:
- **Builds:** the builder sends spec + code to a build VM and gets back a bundle or an error. There is no network access beyond the package mirror.
- **App backends:** when an app needs server logic (scheduled jobs, webhooks, payments), it gets a VM that starts from a snapshot of a warm Bun runtime. Its only egress is the platform API and any connectors it was granted.
- **Employee workspaces:** each AI employee gets a persistent VM with a filesystem and code execution for data processing. Connector access goes through the platform's token broker, never through raw secrets.

**Contract:** one VM image per runtime kind (`build`, `app`, `employee`), with resource limits taken from the workspace plan. VM lifecycle events (start, crash, OOM, timeout) feed observability (§3).

**First step:** run `Bun.build` for generated apps in a VM with no network access, and keep the current API between the builder and the build.

## 3. Observability

**Now:** usage logging per model call (`logUsage`), a `bos:error` event from apps, and acceptance-check results.

**Target:** one trace model across the platform, built on OpenTelemetry.
- **Spans:** CEO turn → tool call → build → check run; employee run → connector call → record write. Each span carries `workspace`, `app`, `version` and `spec_hash`.
- **App telemetry through the SDK:** uncaught errors, failed SDK calls, slow renders and usage counts (which views and actions get used). Apps don't add any code for this; `runtime/entry.tsx` and `runtime/sdk.ts` collect it.
- **Data signals:** record-level anomalies, such as quantities outside the usual range or a supplier whose imports suddenly fail.
- **Model cost and latency** per workspace, per agent and per app. These numbers drive the budgets in the gateway.
- **For the owner:** plain-language status only ("Inventory had an issue, fixed"). Raw telemetry is for the platform and its agents.

**First step:** wrap the CEO, builder and employee loops in spans and export them to any OTLP backend. Send SDK errors as span events.

## 4. Self-healing

**Now:** after a build, failed acceptance checks or a runtime `bos:error` trigger one auto-fix rebuild.

**Target:** a closed loop that runs as a platform agent.
1. **Detect:** errors, failed checks, data anomalies and user reports in plain language ("the totals look wrong").
2. **Diagnose:** reproduce the problem against a snapshot of the data and pin it on one of three causes: the spec, the generated code or the data.
3. **Fix at the source:** a spec cause gets a spec edit that the owner confirms when it changes behaviour. A code cause gets a regeneration from the unchanged spec. A data cause gets a proposed correction.
4. **Verify:** acceptance checks plus a regression set recorded from past failures.
5. **Release:** canary the new version to a share of sessions, compare error rates and promote it or roll back automatically.
6. **Report:** one line to the owner.

**First step:** keep the last good version for every app and roll back automatically when the new version's error rate is higher.

## 5. Spec-driven, self-regenerating software

**Now:** a `spec.md` per app (Definitions / Functional specs / Starter data / Acceptance) with per-block hashes. A change to a block that drives the code regenerates the app.

**Target:** specs become typed, versioned contracts.
- **Definitions become the schema.** A diff of Definitions produces a data migration (add a field, rename one, change a unit), which is applied and checked before the new version goes live.
- **Shared definitions across apps.** `:Supply:` is defined once in the workspace and referenced by Inventory, Purchasing and the Dashboard, so apps compose through shared entities instead of ad-hoc collections.
- **Multi-file apps and server logic** are generated from the same spec, with functional-spec blocks mapped to the modules that implement them.
- **Partial regeneration:** only the modules whose blocks changed are regenerated. Unchanged modules are reused by hash.
- **Spec history with review:** every change records who asked for it, why, and the checks it passed.
- **Modules:** payments, auth, notifications, PDF and OCR as platform components that a spec references by name. The model never writes them.

**First step:** derive collection schemas from Definitions and refuse a build whose code writes fields that the spec doesn't define.

## 6. Adaptive knowledge layer

**Now:** the CEO writes Markdown knowledge pages, and they are part of its context on every turn.

**Target:** a knowledge graph behind the pages.
- **Entities and facts** (people, suppliers, products, processes, pain points), each with its **provenance** (conversation, app record, employee, connector) and a **confidence**.
- **Updated from every source:** employees and connectors propose facts. Contradictions with an existing fact go to the owner as one question instead of being overwritten silently.
- **Retrieval instead of the full dump:** the CEO, builder and employees get the entities relevant to the task. This keeps context small as the business grows.
- **Pages are views over the graph,** so they stay readable and editable, and an edit to a page writes facts back.
- **Compounding:** new app specs reuse existing entities and definitions, so each app is cheaper to build than the last.

**First step:** extract entities from the existing pages into a table with source references, and give the CEO a `lookup_knowledge` tool next to the full-page context.

## 7. Employee login and roles

**Now:** one implicit user. Human team members exist as records without accounts.

**Target:**
- **Accounts:** owner and staff sign in with passkeys or a magic link. Invites come from the Team page or the CEO ("add Ana as a waiter").
- **Roles per workspace and per app:** owner, manager, staff, plus custom roles defined in the workspace. App specs can reference roles ("only managers can change minimums"), and the generated code enforces them through the SDK, not by itself.
- **The SDK carries identity:** `useUser()` and server-side checks on every record call. Audit fields (`createdBy`, `updatedBy`) are added automatically.
- **AI employees are principals too:** each has scoped, revocable credentials for apps and connectors, and every action is attributed in the audit log.
- **Public apps** (menus, booking pages) get an anonymous role with read-only or form-only access.

**First step:** add sessions and a `members` table, pass the user through the SDK API and stamp `createdBy` and `updatedBy` on records.

## 8. Real connectors

**Now:** a catalog with a fake sign-in. Gmail is backed by a seeded mock inbox behind the same tool interface.

**Target:** OAuth per provider, tokens kept in a vault and never handed to the model, scopes per employee, and webhooks or polling that feed events to employees. Each connector implements the same small interface (`connect`, `scopes`, `tools`, `events`), so adding a provider is just writing the adapter.

**First step:** real Gmail OAuth behind the existing tool interface, with the mock kept for dev and QA.
