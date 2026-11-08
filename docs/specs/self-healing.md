# Self-healing

**Prototype:** after each build, acceptance checks derived from the spec run in an offscreen iframe (`server/checks.ts`, `web/components/CheckRunner.tsx`). A failed check, or a `bos:error` from a live app, triggers **one** auto-fix rebuild per version (`autoFix` and `checkFix` in `server/builder.ts`). Each version is kept in its own `v<N>` directory.

## Design

A platform agent (the healer) consumes `Signal`s and runs a closed loop:

1. **Detect:** runtime errors, failed checks, data anomalies and owner reports in plain language ("the totals look wrong"). These are deduplicated by (app, version, fingerprint).
2. **Diagnose:** reproduce the problem in a `build` sandbox against a snapshot of the app's data, then classify the cause:
   - **code:** the spec is right and the generated code is wrong, so regenerate from the unchanged spec, using the error as context;
   - **spec:** the spec is ambiguous or wrong, so propose a spec edit; the owner confirms it if it changes behaviour;
   - **data:** a record breaks an assumption, so propose a data correction or a spec rule for that case.
3. **Verify:** the acceptance checks, plus a regression set made of every past failure turned into a check, all run on the data snapshot.
4. **Release:** canary the new version to a share of sessions, compare error and check rates with the current version, and then promote it or roll back. Rollback is a registry pointer move (see [hosting](hosting.md)).
5. **Report:** one line to the owner, plus a spec-history entry with the cause and the fix.

**Budgets:** a cap on attempts per signal fingerprint and on model spend per workspace per day. Once the cap is hit, the healer escalates to the owner through the CEO instead of retrying.

## Migration from the prototype

1. Keep `lastGoodVersion` in the app registry and roll back automatically when a new version's error rate goes over the old one's.
2. Persist every check failure as a regression check that is appended to the next version's set.
3. Move auto-fix out of the builder into a healer that subscribes to `Telemetry.signal`.
