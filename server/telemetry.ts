// Prototype Telemetry: JSON lines under logs/. `bun run cost` reads usage.jsonl.
// The product exports the same records as OTLP spans and events (docs/specs/observability.md).
import { appendFileSync, mkdirSync } from "node:fs";
import type { Telemetry } from "../contracts/platform";

const append = (file: string, row: object) => {
  try {
    mkdirSync("logs", { recursive: true });
    appendFileSync(`logs/${file}`, JSON.stringify({ ts: Date.now(), ...row }) + "\n");
  } catch (e) {
    console.error(`[telemetry] ${file}`, e);
  }
};

export const jsonlTelemetry: Telemetry = {
  usage: (rec) => append("usage.jsonl", rec),
  signal: (s) => append("signals.jsonl", s),
};
