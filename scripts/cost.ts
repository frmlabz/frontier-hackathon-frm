// Prints the running total of real API spend from logs/usage.jsonl.
import { existsSync, readFileSync } from "node:fs";

const f = "logs/usage.jsonl";
if (!existsSync(f)) {
  console.log("No usage yet: $0.00");
  process.exit(0);
}
const rows = readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const by: Record<string, { n: number; cost: number }> = {};
let total = 0;
for (const r of rows) {
  const k = `${r.model}${r.speed === "fast" ? " (fast)" : ""} · ${r.kind}`;
  by[k] ??= { n: 0, cost: 0 };
  by[k].n++;
  by[k].cost += r.cost;
  total += r.cost;
}
for (const [k, v] of Object.entries(by).sort()) console.log(`${k.padEnd(48)} ${String(v.n).padStart(4)} calls  $${v.cost.toFixed(3)}`);
console.log(`TOTAL: $${total.toFixed(2)} of $40 budget`);
