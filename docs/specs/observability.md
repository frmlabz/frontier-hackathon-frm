# Observability

**Contract:** `Telemetry` in `contracts/platform.ts` (`usage`, `signal`).
**Prototype:** `server/telemetry.ts` writes `logs/usage.jsonl` (one row per model call, with its cost) and `logs/signals.jsonl` (`app.error`, `app.checks`). `bun run cost` sums usage.

## Design

- **Traces (OpenTelemetry):** one trace per CEO turn, with child spans for each tool call, build, check run and employee run, and further children for model calls, connector calls and record writes. Every span carries `workspace`, `app`, `version`, `spec_hash` and `principal`.
- **App telemetry without app code:** `runtime/entry.tsx` and `runtime/sdk.ts` report uncaught errors, failed SDK calls, render time and view or action counts. Generated code adds nothing.
- **Signals** (`Signal` union): typed events that the self-healing loop consumes, such as `app.error`, `app.checks` and `build.failed`, plus data anomalies (a value outside its historical range, a supplier whose imports stop parsing).
- **Cost:** model spend per workspace, agent and app, computed from the gateway's usage records. Budgets and alerts are set on the same numbers.
- **Owner view:** plain-language status only ("Inventory had a problem; fixed"). Raw telemetry is for operators and platform agents.
- **Export:** OTLP to any backend. Signals go to the platform's own queue so agents can act on them.

## Migration from the prototype

1. Implement `Telemetry` with the OTel SDK. `usage` becomes span attributes on the model-call span, and `signal` becomes span events plus a queue publish.
2. Wrap `turn()` (ceo.ts), `build()` (builder.ts) and `loop()` (employee.ts) in spans.
3. Batch SDK errors from the iframe through the shell instead of one POST per error.
