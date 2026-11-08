// One real research run on the demo request (05 §9 step 1). Costs money: requires --live.
// Saves every response block, progress, drops, usage and the result to logs/research-dry-run/<ts>.json.
import { mkdirSync, writeFileSync } from "node:fs";
import request from "../fixtures/research/request.json";
import { MODEL, costOf, isOpus } from "../server/claude";
import { formatValue, type ResearchRequest } from "../server/report";
import { runResearch } from "../server/research";

if (!process.argv.includes("--live")) {
  console.log(`Dry run is a paid API call (${MODEL}). Re-run with --live.`);
  process.exit(1);
}

const started = Date.now();
const progress: { t: number; lines: string[]; sources: number }[] = [];
const out: any = { model: MODEL, request, startedAt: new Date(started).toISOString() };
const file = `logs/research-dry-run/${started}.json`;
mkdirSync("logs/research-dry-run", { recursive: true });

const usageOf = (transcript: any[]) => transcript.filter((m) => m.role === "assistant").length;

try {
  const r = await runResearch(request as ResearchRequest, (p) => {
    progress.push({ t: Date.now() - started, ...p });
    console.log(`[${((Date.now() - started) / 1000).toFixed(0)}s] ${p.lines.at(-1) ?? ""}  (${p.sources} sources)`);
  });
  Object.assign(out, { ok: true, status: r.status, drops: r.drops, submission: r.submission, report: r.report, transcript: r.transcript });
  console.log(`\nstatus: ${r.status}   findings: ${r.report.findings.length}/${r.submission.findings.length}   sources: ${r.report.sources.length}/${r.submission.sources.length}`);
  for (const d of r.drops) console.log(`  dropped ${d}`);
  for (const e of r.report.estimates) console.log(`  ${e.id} ${e.label}: ${formatValue(e.low, e.high, e.unit)}   = ${e.formula}`);
  console.log(`responses: ${usageOf(r.transcript)}`);
} catch (e: any) {
  Object.assign(out, { ok: false, error: String(e?.message ?? e), transcript: e?.transcript });
  console.error(`FAILED: ${e?.message ?? e}`);
} finally {
  out.progress = progress;
  out.wallSeconds = (Date.now() - started) / 1000;
  // Per-response usage, recomputed from the transcript is impossible (usage isn't in content), so read the log tail.
  const { readFileSync } = await import("node:fs");
  const rows = readFileSync("logs/usage.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((r) => r.kind === "research" && r.ts >= started);
  out.usage = rows;
  out.cost = rows.reduce((s, r) => s + costOf(r.model, r.usage, r.speed), 0);
  writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`wall ${out.wallSeconds.toFixed(0)}s   cost $${out.cost.toFixed(3)}${isOpus ? " (fast)" : ""}   saved ${file}`);
}
