import Anthropic from "@anthropic-ai/sdk";
import { jsonlTelemetry as telemetry } from "./telemetry";

export const MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-5-5";
export const isOpus = MODEL.startsWith("claude-opus");
export const client = new Anthropic({ maxRetries: 3 });

/** One helper builds the request options for every call (spec §10). */
export function requestOptions(effort: "low" | "medium", opts: { updates?: boolean; fast?: boolean } = {}) {
  const fast = isOpus && opts.fast !== false;
  return {
    model: MODEL,
    max_tokens: 64000,
    thinking: opts.updates ? { type: "adaptive", display: "updates" } : { type: "adaptive" },
    output_config: { effort },
    fallbacks: "default",
    ...(fast && { speed: "fast" }),
    betas: [
      "server-side-fallback-2026-07-01",
      ...(opts.updates ? ["thinking-display-updates-2026-08-18"] : []),
      ...(fast ? ["fast-mode-2026-02-01"] : []),
    ],
  } as any;
}

// ---------- usage / cost tracking ----------
const PRICES: Record<string, { in: number; out: number; cacheRead: number; cacheWrite: number }> = {
  "claude-sonnet-5-5": { in: 2, out: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-opus-5-5": { in: 4, out: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-haiku-5-5": { in: 0.1, out: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};

export function costOf(model: string, u: any, speed?: string) {
  const p = PRICES[model] ?? PRICES["claude-opus-5-5"]!;
  const mult = speed === "fast" ? 2 : 1;
  const searches = (u.server_tool_use?.web_search_requests ?? 0) * 0.01; // $10 per 1,000 searches, not affected by fast mode
  return (
    (mult *
      ((u.input_tokens ?? 0) * p.in +
        (u.output_tokens ?? 0) * p.out +
        (u.cache_read_input_tokens ?? 0) * p.cacheRead +
        (u.cache_creation_input_tokens ?? 0) * p.cacheWrite)) /
      1e6 +
    searches
  );
}

export function logUsage(kind: string, msg: any, fast = isOpus) {
  try {
    const model = msg.model ?? MODEL;
    const usage = msg.usage ?? {};
    const speed = usage.speed ?? (fast ? "fast" : undefined);
    telemetry.usage({ kind, model, speed, usage, cost: costOf(model, usage, speed) });
  } catch (e) {
    console.error("usage log failed", e);
  }
}

/** Text of all text blocks in a message. */
export const textOf = (content: any[]) =>
  content.filter((b) => b.type === "text").map((b) => b.text).join("");
