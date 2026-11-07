# Business OS — Demo Build Spec

**Goal:** a real, working local demo. You talk only to the AI CEO in the **Hub** (a full-screen chat). It interviews you, builds a **Knowledge layer** (Notion-style pages about the business that appear in the sidebar as you talk), hires AI Employees, asks you to connect Gmail, and **actually generates, builds and hosts** small one-file apps that show up in the sidebar with their own emoji, their own data, and update live. App generation is never cached, pre-generated or scripted. The only mocked thing is the Gmail provider (§9). Generated apps are **flexible**: any small business tool (inventory, suppliers, staff schedule, reservations, recipes), not an inventory template.

**Demo spine (protect this above everything):** Hub chat → genuinely generated Inventory app → AI Employee reads (mock) Gmail invoices → stock visibly changes in the open app.

Context: `docs/01-product-vision.md`. Design tokens: `DESIGN.md`.

---

## 1. Constraints

- **Bun for everything:** runtime, server, bundler, SQLite, package manager.
- **One process, one command:** `bun dev` → `http://localhost:3000`.
- **One model for everything** (CEO, app builder, employees), set by `CLAUDE_MODEL` in `.env`. Use **Sonnet 5.5** (`claude-sonnet-5-5`) while building and testing, and **Opus 5.5** (`claude-opus-5-5`) for rehearsals and the demo.
- **Generated apps are one file** (`App.tsx`).
- **SQLite:** a single file at `data/bos.sqlite`.
- No tests, no auth, one workspace, one user. Rehearse the demo instead.
- **Real-time:** one WebSocket from server to shell. The shell forwards updates into the app iframes.
- **Gmail is mocked:** a local fake inbox behind the same tool interface a real Gmail integration would have. No Google OAuth.
- **No OCR / photo import** until the core flow is finished (end of the checklist).
- **Mock AI mode for UX work** (`BOS_MOCK=1`, §14): scripted CEO/builder/employee so the whole UI can be developed and QA'd without API spend. Dev only; the demo always runs real models.
- **Commit after every checklist section** (and every stretch step) so anything can be rolled back.

## 2. Stack

| Concern | Choice |
|---|---|
| Scaffold | `bun init --react=tailwind` (Bun fullstack: HTML imports + `bun-plugin-tailwind` + HMR) |
| Server | `Bun.serve({ routes, websocket })`, no framework |
| Shell UI | React 19, Tailwind v4, `zustand`, `lucide-react` (chrome icons), `react-markdown` |
| App icons | Emoji (Notion-style), picked by the CEO |
| AI | `@anthropic-ai/sdk`, streaming manual tool loop |
| Generated app bundling | `Bun.build()` in-process. **No Tailwind plugin here.** |
| Generated app styling | Iframe HTML loads `runtime/ui.css` (hand-written Notion tokens + kit styles) and the Tailwind browser CDN script `https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.1.13` for layout classes |
| Gmail | Mocked **connection** only: clicking Connect marks Gmail as connected (no OAuth, no consent UI). Once connected, the employee calls a fake Gmail API backed by a seeded inbox in SQLite |
| Dev env | `devbox` (`devbox.json` pins `bun`, `just`, `jq`; `.envrc` loads it via direnv) |

Setup: `devbox shell` (or direnv), `bun install`, `bun dev`. Already in the repo: `devbox.json`, `.envrc`, `.gitignore`.

## 3. Repo layout

```
package.json  bunfig.toml  tsconfig.json  .env
server/
  index.ts       Bun.serve: shell, /api/*, /apps/*, ws
  db.ts          schema, helpers, seed humans on empty DB
  bus.ts         publish(event) over ws
  claude.ts      client + shared request options
  ceo.ts         CEO tool loop + serialized turn queue
  builder.ts     generate App.tsx → Bun.build → promote
  employee.ts    AI employee run loop
  mockGmail.ts   fake inbox: seed, search, read
  seed.ts        humans + mock inbox
  mockAi.ts      BOS_MOCK=1 scripted CEO / builder / employee (§14)
fixtures/
  apps/inventory/App.tsx   hand-written fixture used only by mock mode (still goes through Bun.build)
  demo-state.ts            `bun run seed:demo`: mid-demo DB state for UI QA
web/
  index.html  frontend.tsx  store.ts  ws.ts
  components/ Sidebar, HubPage (chat), cards/*, AppPage, KnowledgePage, TeamPage, PersonPage
runtime/              importable by generated apps
  sdk.ts   ui.tsx   ui.css   entry.tsx
data/
  bos.sqlite
  apps/<slug>/v<N>/App.tsx, app.js
```

`tsconfig.json` paths: `@bos/sdk → runtime/sdk.ts`, `@bos/ui → runtime/ui.tsx`. `Bun.build` respects them. If it doesn't, pass a small `onResolve` plugin.

## 4. Data model

```sql
messages(id INTEGER PRIMARY KEY, role TEXT, content_json TEXT)   -- exact Anthropic history, append-only
chat_items(id INTEGER PRIMARY KEY, kind TEXT, payload_json TEXT, created_at INTEGER)
  -- kind: user | ceo | app_card | hire_card | connector_card | event
knowledge_pages(slug TEXT PRIMARY KEY, emoji TEXT, title TEXT, markdown TEXT, position INTEGER, updated_at INTEGER)
  -- e.g. company-profile, team, suppliers, menu, daily-workflow, pain-points
apps(slug TEXT PRIMARY KEY, name TEXT, emoji TEXT, description TEXT,
     requirements TEXT, schema_json TEXT,           -- collections + fields, persisted for employees & rebuilds
     status TEXT, version INTEGER, step TEXT, error TEXT, created_at INTEGER)
  -- status: generating | building | ready | fixing | failed
records(app TEXT, collection TEXT, id TEXT, data_json TEXT, created_at INTEGER, updated_at INTEGER,
        PRIMARY KEY(app, collection, id))
people(id TEXT PRIMARY KEY, kind TEXT, name TEXT, role TEXT, emoji TEXT, color TEXT,
       instructions TEXT, connectors_json TEXT, status TEXT)   -- kind: human | ai; status: idle | working
activity(id INTEGER PRIMARY KEY, person_id TEXT, text TEXT, created_at INTEGER)
connectors(provider TEXT PRIMARY KEY, account TEXT, connected_at INTEGER)
emails(id TEXT PRIMARY KEY, from_name TEXT, from_addr TEXT, subject TEXT, body TEXT, received_at INTEGER)  -- mock inbox
processed_emails(message_id TEXT PRIMARY KEY, person_id TEXT)   -- dedupe: reruns never double stock
```

Seed on an empty DB:
- 8 humans for "Marko's Bistro" (chef, sous-chef, 2 cooks, 3 waiters, manager) with names and colors.
- About 8 mock inbox emails. 4 are supplier invoices from different suppliers, each with a plain-text or HTML table of line items (item, qty, unit, unit price, total), and each laid out a bit differently so the model has to actually read them. The other 4 are noise (newsletter, booking request, staff message, utility bill).

**Record shape for apps:** `{ id, ...fields, createdAt, updatedAt }`. `insert` takes an optional `id`, otherwise the server uses `crypto.randomUUID()`. `update` is a shallow merge. The app is identified by the iframe URL (`/apps/:slug/`); the SDK reads the slug from `location.pathname`.

## 5. Real-time events (server → shell)

| Event | Shell reaction |
|---|---|
| `chat.delta {text}` | append to the in-progress CEO bubble |
| `chat.item {item}` | push a chat item (closes the bubble); unread dot on *Hub* in the sidebar if you're on another page |
| `ceo.busy {busy}` | typing indicator, disable send |
| `app.status {slug, status, step, version}` | sidebar spinner/dot, build card steps, iframe reload on version bump |
| `records.changed {app, collection}` | `postMessage` into the matching iframe |
| `activity.add {personId, text}` | live feed on the person page + a "working" pulse |
| `knowledge.changed {slug}` | sidebar row fades in / page re-renders with a brief highlight |
| `state.changed` | refetch `GET /api/state` (people, connectors, knowledge, apps) |

Client → server is plain HTTP.

## 6. HTTP API

```
GET    /api/state                         snapshot of everything
POST   /api/chat {text}                   enqueue a CEO turn → 202
GET    /apps/:slug/                       iframe HTML (ui.css, tailwind CDN, v<N>/app.js)
GET    /apps/:slug/v:n/app.js             bundle
GET    /api/apps/:slug/:coll              list
POST   /api/apps/:slug/:coll {data}       insert          → records.changed
PATCH  /api/apps/:slug/:coll/:id {patch}  shallow merge   → records.changed
DELETE /api/apps/:slug/:coll/:id                          → records.changed
POST   /api/ai/extract {file, mediaType, instructions}  → JSON (Claude vision)   [Stretch]
POST   /api/apps/:slug/error {message, stack}           → auto-fix               [P1]
POST   /api/connectors/gmail/connect {account}  → store connector → state.changed → enqueue CEO event
```

## 7. Generated app contract

### What Claude writes

```tsx
import { useState } from "react";
import { Page, Header, Card, Table, Button, Input, Select, Badge, Stat, EmptyState, FileDrop } from "@bos/ui";
import { useCollection, db, ai } from "@bos/sdk";

export default function App() { /* ... */ }
```

Rules in the builder prompt:
- Use only `react`, `@bos/ui` and `@bos/sdk`. No other imports, no `fetch`.
- Tailwind classes are for layout only. Visual styling comes from the kit.
- The file must be self-contained, under about 300 lines, and use only the collections it declares.
- It must never seed data in the code. Seed data goes in `seed`.

### `@bos/sdk`

```ts
useCollection<T>(name): { items: (T & Rec)[], loading: boolean }  // fetch on mount, refetch on records.changed postMessage
db.list(coll)  db.insert(coll, data, id?)  db.update(coll, id, patch)  db.remove(coll, id)
ai.extract(file: File, instructions: string): Promise<any>        // Stretch
```

`entry.tsx` mounts `<ErrorBoundary><App/></ErrorBoundary>`. It posts `{type:"bos:ready"}` or `{type:"bos:error", message, stack}` to the parent and catches `window.onerror` and `unhandledrejection`. The shell checks `event.origin`.

### `@bos/ui`

Page, Header (emoji + title + actions), Card, Table (`columns`, `rows`, `onEdit` inline cell edit), Button (`primary|secondary|ghost`), Input, Select, Badge (`tone`), Stat, EmptyState, FileDrop (stretch). Fix the props in `ui.tsx` and paste that file's type signatures into the builder prompt verbatim.

### Builder output (structured output, no tool loop)

```ts
output_config.format = json_schema {
  code: string,
  collections: [{ name, fields: [{ name, type: "text|number|date|boolean", unit? }] }],
  seed: { [collection]: object[] }      // ignored on rebuilds
}
```

### Build pipeline (`builder.ts`)

1. `status=generating`, then a Claude call with the requirements, knowledge pages, ui/sdk signatures, and, for rebuilds, the current code and schema.
2. Write `data/apps/<slug>/v<N+1>/App.tsx` and generate `entry.tsx` importing it. `status=building`.
3. `Bun.build({ entrypoints:[entry], outdir: v<N+1>, target:"browser", naming:"app.js" })`.
4. If the build fails, send the build log back to Claude in the same conversation and try again, up to 3 attempts in total. If all fail, set `status=failed` with a friendly error.
5. If it succeeds, persist the schema, insert the seed (first version only), and set `version=N+1, status=ready`. Records are never touched on rebuilds.
6. [P1] When the iframe reports `bos:error` on a new version, set `status=fixing` and run step 1 with the error, at most once. This is the real self-healing moment.

Build card steps shown to the user are honest status changes, not invented ones: *Designing your app → Writing the app → Packaging → Ready*.

## 8. AI CEO (`ceo.ts`)

**Turn queue:** one CEO turn at a time. `POST /api/chat` and connector callbacks enqueue. Build completion does **not** trigger a turn. The build card shows it, and the CEO sees it through state on its next turn.

**System prompt:** the persona (warm, brief, one question at a time, propose and wait for a yes before building or hiring, never mention code, deploys or errors) plus a **state block rebuilt every turn**: knowledge pages (full markdown), apps (slug, status, schema), people, connectors.

**Tools** (all `strict: true`, `tool_choice: auto`, because forced tool choice returns a 400 on both Opus 5.5 and Sonnet 5.5):

| Tool | Effect | Returns |
|---|---|---|
| `upsert_knowledge_page({slug, emoji, title, markdown})` | creates/rewrites one Knowledge page (call it as soon as you learn something; several pages per interview) | ok |
| `build_app({name, emoji, description, requirements})` | creates the app row + `app_card`, starts the builder async | "build started" |
| `update_app({slug, change_request})` [P1] | rebuilds async | "rebuild started" |
| `hire_employee({name, role, emoji, color, instructions, connectors})` | AI person + `hire_card` | person id |
| `request_connector({provider:"gmail", reason, pending_task})` | `connector_card` with a Connect button. Stores `pending_task` | "waiting for user" |
| `run_employee({person_id, task})` | starts an employee run async. Errors if a required connector is missing | "started" or error |

**Loop:** `client.beta.messages.stream(...)`, with `text` deltas sent as `chat.delta`. Append the full `response.content` to `messages`. Every tool result goes back in one user message. Stop on `end_turn` or `refusal`.

**Gmail resume:** `/connect` enqueues the user-role message `[event] Gmail connected as x@y. Pending task: <pending_task>` so the CEO calls `run_employee` itself.

## 9. AI Employee run (`employee.ts`)

Same-model tool loop. The system prompt includes the person's instructions, the knowledge pages and every app's schema.

Tools:
- `gmail_search({query, max})`: case-insensitive match on from/subject/body in the mock `emails` table. Max 10. Skips ids already in `processed_emails`. Returns id, from, subject, date and snippet.
- `gmail_read({id})`: returns the full body.
- `list_records({app, collection})`, `upsert_records({app, collection, records})`, `update_record({app, collection, id, patch})`.
- `mark_processed({message_id})`.
- `log({text})`: sent as `activity.add`.

The tool names and shapes match what a real Gmail integration would expose, so swapping in the real API later only touches `mockGmail.ts`.

Each write sends `records.changed`, so the open Inventory iframe updates live. The run ends with a summary, which becomes a chat `event` item ("Purchasing Assistant imported 3 invoices: +12 kg tomatoes, …").

## 10. Claude request options

```ts
// claude.ts — one helper builds the options for every call; verify each optional flag in step 0, drop it if it errors
const MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-5-5";   // .env: claude-sonnet-5-5 (dev) | claude-opus-5-5 (demo)
const isOpus = MODEL.startsWith("claude-opus");

{
  model: MODEL,
  max_tokens: 64000,
  thinking: { type: "adaptive" },
  output_config: { effort: "low" /* CEO */ | "medium" /* builder, employee */ },
  fallbacks: "default",                                         // optional: refusal fallback (both models, Claude API)
  ...(isOpus && { speed: "fast" }),                             // optional: fast mode exists on Opus only
  betas: ["server-side-fallback-2026-07-01", ...(isOpus ? ["fast-mode-2026-02-01"] : [])],
}
```

- Always set `effort` explicitly: Opus 5.5 defaults to `medium` and Sonnet 5.5 to `high`, so leaving it out makes the two models behave differently.
- Don't send `thinking: {type: "disabled"}` (a 400 on both) and don't use `temperature` / `top_p`.
- Fast mode is only for perceived speed. Opus 5.5 is still the model behind every demo call.
- Never edit or reorder `messages`. History must stay append-only (preserved thinking on both models).
- Switch models only on a fresh DB (`bun run reset`). Thinking blocks are tied to the model that produced them, so don't continue a Sonnet conversation on Opus.

## 11. UI (Notion app, not Notion's marketing site)

DESIGN.md describes Notion's **marketing site**. Use its colors, Inter type, hairlines, spacing and warm `canvas-soft`. **Skip** the hero bands, pill CTAs and big shadows. Copy the look of the Notion *app*.

- **Sidebar** (240px, `canvas-soft`): workspace switcher "🍋 Marko's Bistro". Then **💬 Hub** (default, unread dot), *Team*, a **Knowledge** section (pages fade in as the CEO writes them), then an **Apps** section. Each app row has its emoji and name, a spinner while generating/building/fixing, a red dot if failed, and a fade-in when a new app appears. Rows are 28px with a hover tint and 4px radius.
- **Hub (default route `/`):** a full-screen chat and nothing else, no side panels, and no chat on any other page.
  - Centered 720px column with a large composer pinned to the bottom (autosizing textarea, send on Enter).
  - Empty state: a big greeting ("Good evening, Marko. What are we working on?") and 3 suggestion chips ("I run a restaurant…", "Help me track stock", "Hire an assistant").
  - CEO messages have no bubble, with a small CEO avatar, like Notion AI. User messages get a soft grey bubble, right-aligned. Streaming shows a caret, plus a typing indicator while the CEO is busy.
  - Cards render inline in the stream.
- **Other pages:** a Notion page with a 78px emoji, a 40px bold H1 title, a breadcrumb, and a 900px content width. Pages: Knowledge page (rendered markdown, "Updated by AI CEO · 2m ago"), Team, Person, App. Their builds and activity update live without the chat.
- **Chat cards:**
  - *App card:* emoji, name, a 4-step progress list with a spinner on the active step, then an "Open app" button.
  - *Hire card:* gradient avatar, name, role, connector chips.
  - *Connector card:* Gmail logo, reason, and a "Connect Gmail" primary button. Clicking it shows a short "Connecting…" spinner on the button, calls `/api/connectors/gmail/connect`, and the card turns into "✓ Connected as marko@markosbistro.com". No modal, no fake Google screens.
  - *Event line:* small grey text with an icon.
- **Team page:** Notion database table: Name · Role · Type (`Human` / `AI` badge) · Status. AI rows show their connectors and a "Working…" pulse.
- **Person page (AI):** instructions, connectors, live activity feed (newest first, timestamps).
- **App page:** page chrome, then a borderless `<iframe src="/apps/:slug/?v=N">` filling the rest. While building, a skeleton shimmer. After a version bump, a crossfade.

## 12. Demo script (acceptance)

Fresh DB (seeded humans + mock inbox).

1. Open `localhost:3000` and land on the Hub empty state.
2. "I run a small Mediterranean bistro with 8 people." The CEO asks questions; *Company Profile*, *Suppliers*, *Pain Points* pages appear in the Knowledge section while you talk.
3. Describe the notebook stock mess and list some ingredients. The CEO proposes Inventory, you say "yes", the card progresses, and 🥫 **Inventory** appears in the sidebar and opens with the generated ingredients.
4. "I need someone to pull supplier invoices from Gmail and update stock." The CEO proposes and hires 🛒 **Purchasing Assistant**, then asks you to connect Gmail. You click Connect, and a moment later it shows as connected. The CEO runs the employee. The activity feed streams, and the Inventory quantities change live in the iframe.
5. [P1] "Add a supplier column to Inventory." The app rebuilds to v2 and the data is preserved.
6. [Stretch, last] Drop an invoice photo into Inventory and the stock updates.

## 13. Checklist (in order)

### 0 — Prove the risky bits first
- [x] devbox with Bun 1.4.2 (`devbox.json`, `.envrc`)
- [x] `bun init --react=tailwind`; `bun dev` serves the page with HMR
- [x] One real streaming call on **each** model (`claude-sonnet-5-5`, `claude-opus-5-5`) with the §10 options; drop any flag that errors
- [x] `Bun.build` of a hand-written `App.tsx` importing `@bos/ui` / `@bos/sdk`, served in an iframe with ui.css + Tailwind CDN
- [x] `.env` with `ANTHROPIC_API_KEY` (`CLAUDE_MODEL` defaults to `claude-sonnet-5-5` in code)

### 1 — Contracts (freeze before parallel work)
- [x] `db.ts` schema + seed humans + seed mock inbox
- [x] `runtime/ui.tsx` props + `ui.css` (Notion tokens)
- [x] `runtime/sdk.ts`, `runtime/entry.tsx` (ErrorBoundary, ready/error postMessage)
- [x] `bus.ts` event types shared with `web/store.ts`

### 1.5 — Mock mode (§14)
- [x] `mockAi.ts` scripted CEO turns (streamed word by word), fixture build through the real `Bun.build`, scripted employee run with activity + record writes
- [x] `bun run seed:demo` mid-demo state
- [x] `/dev/gallery`: every chat card in every state, kit components, empty/loading/error states

### 2 — Generate → host → live data
- [x] `builder.ts` full pipeline incl. retry and versioned dirs
- [x] `/apps/*` routes + records CRUD + `records.changed`
- [x] Shell forwards `records.changed` into iframes, reloads on version bump
- [x] Sidebar app rows with status; App page
- [x] Temporary dev button "build test app" to exercise the builder without the CEO

### 3 — CEO
- [x] Turn queue, streaming loop, `messages` + `chat_items` persistence
- [x] `upsert_knowledge_page`, `build_app`, `hire_employee`, `request_connector`, `run_employee`
- [x] Hub page (empty state, stream, composer), all four card types, unread dot

### 4 — Gmail employee (mock inbox)
- [x] Connector card button + `/connect`, CEO resume event
- [x] `mockGmail.ts` search/read
- [x] `employee.ts` loop + `processed_emails` dedupe + activity events
- [x] Team page + Person page with live feed

### 5 — Polish + rehearsal
- [x] Notion fidelity pass on the shell (spacing, hover states, type scale, empty states, transitions)
- [x] Run the demo script end to end on a fresh DB at least 3 times with `CLAUDE_MODEL=claude-opus-5-5`; fix whatever breaks
- [x] `bun run reset` script: delete `data/`, restart

### P1 (only after 5 passes)
- [x] `update_app` rebuild
- [x] Auto-fix on `bos:error`

### Stretch A — Regenerative apps (§15), one commit per step, tag `demo-core` first
- [ ] Spec file per app + Spec tab on the App page
- [ ] Build from spec; per-block hashes; "N specs changed" in the build card
- [ ] `edit_app_spec` CEO tool + inline spec editing → regenerate
- [ ] Acceptance checks from the spec run after each build; failures trigger one auto-fix

### Stretch B (only after A)
- [ ] `/api/ai/extract` + `FileDrop` invoice photo import (OCR)

### Cut
Dashboard, Connectors page, real Google OAuth, Google Sheets, public apps, team invites, prompt caching, streaming code line counts, right-side chat panel.

## 14. Mock AI mode (dev / QA only)

`BOS_MOCK=1 bun dev` swaps the three Claude call sites for scripted versions in `server/mockAi.ts`. Everything else (queue, DB, bus, builder's `Bun.build`, iframe hosting, records, WS) is the real code path.

- **CEO:** keyword-matched scripted replies that follow the demo script (interview → knowledge pages → propose Inventory → build → hire → connector → run). Text streams as `chat.delta` at a realistic pace (~30 ms/word) and tool effects fire through the same tool handlers the real loop uses.
- **Builder:** sleeps through the real steps (Designing → Writing → Packaging) and builds `fixtures/apps/<name>/App.tsx` with the real `Bun.build`. Unknown app names fall back to a generic fixture list app.
- **Employee:** walks the seeded inbox, emits `activity.add` lines with delays, and writes real record updates so the iframe changes live.
- **`bun run seed:demo`:** writes a mid-demo state into `data/mock` (knowledge pages, Inventory built and updated to v2, Purchasing Assistant hired with activity) for screenshot/QA work. It drives the real mock flow via `scripts/rehearse.ts` against a temporary server, so the state always matches the code.

Mock mode exists so UX can be iterated for free. It is never used in rehearsal or the demo, and nothing from it is cached for the real path.

## 15. Stretch A — Regenerative apps

Idea (from codeplain / turri `.plain`): **the spec is the source of truth and code follows it.** Code is never edited directly; when the spec changes, the affected app is regenerated from it.

**Spec file** `data/apps/<slug>/spec.md` (also stored in `apps.spec`), written by the CEO via `build_app` (replaces free-text `requirements`):

```md
---
app: inventory
emoji: 🥫
---
## Definitions
- :Ingredient: — something the kitchen stocks; has name, quantity, unit, minimum, supplier.

## Functional specs
### list-ingredients
The owner sees all :Ingredient:s in a table, lowest stock first.

### low-stock-alert
An :Ingredient: below its minimum shows a red "Low" badge and is counted in a "Running low" stat.

## Acceptance
- low-stock-alert: an ingredient with quantity 1 and minimum 5 shows "Low".
```

- **Per-block hashing:** each `### id` block is hashed; the build stores the hashes it was built from. On a spec change the build card shows "2 specs changed → regenerating" and the builder prompt gets the previous code, the full spec, and the changed block ids (`<spec change>`). Full regen of the one file is fine; the diff is for the UX and the prompt.
- **Spec tab** on the App page (App | Spec), Notion-style rendered markdown, editable inline; saving triggers a rebuild. The CEO tool `edit_app_spec({slug, markdown, summary})` does the same from chat ("Add a supplier column" → CEO edits the spec → app follows).
- **Acceptance checks:** after a build, the builder makes one cheap Claude call that turns the Acceptance list into checks the iframe runs against rendered DOM text (`bos:check` postMessage). Failures trigger one auto-fix rebuild. The card shows ✓ per check.
- Records are never touched by regeneration; schema changes are additive.
