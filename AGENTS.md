# AGENTS.md

Business OS: an AI CEO that builds, hosts and repairs generated apps for a small business. This repo is the Bun prototype; `docs/architecture.md` describes the product it is a prototype of.

## Commands

```sh
bun install
bun run typecheck                 # tsc --noEmit, must pass
bun test                          # server/*.test.ts
bun run mock                      # :3000, scripted AI, no API spend (data/mock)
bun dev                           # :3000 live + :3001 seeded mock
bun scripts/rehearse.ts <url> --step6   # end-to-end demo script against a running server (fresh DB)
bun run prompts:doc               # after any prompt change: copies prompts into docs/02-demo-spec.md §16
```

If `bun` isn't on PATH, use `devbox shell` or `.devbox/nix/profile/default/bin/bun`.

## Boundaries

- **`contracts/`** holds pure types only, with no runtime code and no imports from `server/`. Change a contract on purpose and update `docs/architecture.md` in the same change.
- **`server/platform.ts`** is the composition root and the only place that picks implementations. Callers use `platform.records`, `platform.builds`, `platform.mail` and so on, never `db.ts` record helpers or `mockGmail.ts` directly.
- **`runtime/`** is the contract with generated apps. Generated code may import only `react`, `@bos/ui` and `@bos/sdk` (enforced by the builder lint). Changing `runtime/ui.tsx` between `@api-start`/`@api-end` changes the builder prompt.
- **Specs, not code:** generated apps are rebuilt from `spec.md`. Never edit `data/apps/**` by hand.

## Conventions

- Nothing about a specific business goes into server code or prompts. The workspace and owner come from `server/workspace.ts`. Prompts say "the owner" (they/them). Demo persona data belongs in `fixtures/`, `server/seed.ts` and `server/mockAi.ts`.
- Model IDs and request options go through `server/claude.ts`, and every model call is logged with `logUsage`.
- Numbers shown to the owner (ROI estimates, totals) are computed in code, never by the model.
- Mock mode (`BOS_MOCK=1`) must keep working. It swaps only the model calls, so a change to a tool handler or route is exercised by `rehearse.ts` against the mock server.

## Docs

- `docs/architecture.md`: invariants, components, and each contract's prototype and product implementations.
- `docs/specs/*.md`: one design spec per area (sandbox, hosting, observability, self-healing, app-specs, knowledge, identity, connectors).
- `docs/02-demo-spec.md`: the prototype as built. §16 is generated from the code.
- Write specs as product design: the current state, the design, and the migration from the prototype. No timelines.
