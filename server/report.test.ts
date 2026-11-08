import { expect, test } from "bun:test";
import fixture from "../fixtures/research/report.json";
import request from "../fixtures/research/request.json";
import { formatValue, validateReport, type Evidence, type ResearchRequest, type Submission } from "./report";

const sub = fixture as Submission;
const req = request as ResearchRequest;
const clone = (): Submission => structuredClone(sub);
const est = (r: ReturnType<typeof validateReport>, id: string) => r.report.estimates.find((e) => e.id === id);
const allUrls = (s: Submission) => new Set(s.sources.map((x) => x.url));

test("fixture validates with the demo numbers", () => {
  const r = validateReport(sub, req, null);
  expect(r.drops).toEqual([]);
  expect(r.status).toBe("ready");
  expect(r.report.findings).toHaveLength(7);
  expect(r.report.charts).toHaveLength(3);
  expect(r.report.recommendedOpportunityId).toBe("O1");
  const v = (id: string) => [est(r, id)!.low, est(r, id)!.high];
  expect(v("E1")).toEqual([94, 234]);
  expect(v("E2")).toEqual([3.7, 3.7]);
  expect(v("E3")).toEqual([360, 900]);
  expect(v("E4")).toEqual([266, 666]);
  expect(v("E5")).toEqual([1.3, 1.3]);
  expect(est(r, "E1")!.formula).toBe("€9,000/month × 4–10% (F5) × 26% (F2)");
  expect(est(r, "E2")!.formula).toBe("5 h/week × (1 − 6,082 ÷ 23,333) (F6, F7)");
  expect(formatValue(94, 234, "EUR/month")).toBe("€94–234/month");
  expect(formatValue(3.7, 3.7, "h/week")).toBe("3.7 h/week");
});

test("a finding whose quote lacks its number is dropped", () => {
  const s = clone();
  s.findings.find((f) => f.id === "F2")!.quote = "Restaurants reduced food waste from their kitchens on average.";
  const r = validateReport(s, req, null);
  expect(r.report.findings.map((f) => f.id)).not.toContain("F2");
  expect(est(r, "E1")).toBeUndefined(); // depends on F2
  expect(est(r, "E3")).toBeDefined();
});

test("a source URL not seen in this run drops it and everything that depends on it", () => {
  const urls = allUrls(sub);
  urls.delete(sub.sources.find((x) => x.id === "S2")!.url);
  const r = validateReport(sub, req, { urls, fetched: new Map() });
  expect(r.report.sources.map((x) => x.id)).toEqual(["S1", "S3"]);
  expect(r.report.findings.map((f) => f.id)).not.toContain("F5");
  expect(r.report.estimates.map((e) => e.id)).toEqual(["E2", "E5"]); // E1, E3, E4 need F5
  expect(r.report.charts.map((c) => c.title)).not.toContain("Possible kitchen food waste");
  expect(r.report.opportunities.find((o) => o.id === "O1")!.estimateIds).toEqual([]);
});

test("verbatim: fetched page without the quote drops it; search-only keeps it", () => {
  const s1 = sub.sources.find((x) => x.id === "S1")!.url;
  const s3 = sub.sources.find((x) => x.id === "S3")!.url;
  const ev: Evidence = {
    urls: allUrls(sub),
    fetched: new Map([
      [s1, "Unrelated page text about something else."],
      [s3, `Intro. ${sub.findings.find((f) => f.id === "F6")!.quote.replace(/-/g, "–").toUpperCase()} More.`],
    ]),
  };
  const r = validateReport(sub, req, ev);
  const ids = r.report.findings.map((f) => f.id);
  expect(ids).not.toContain("F1"); // S1 fetched, quote missing
  expect(ids).toContain("F5"); // S2 search-only
  expect(ids).toContain("F6"); // S3 fetched, quote present after normalising
});

test("a chart with mixed units is dropped", () => {
  const s = clone();
  s.charts[0]!.bars[1]!.ref = "E2";
  const r = validateReport(s, req, null);
  expect(r.report.charts.map((c) => c.title)).not.toContain("Possible kitchen food waste");
  expect(r.drops.some((d) => d.includes("mixed units"))).toBe(true);
});

test("a summary with a digit is replaced", () => {
  const s = clone();
  s.summary = "Restaurants save $7 per $1.";
  expect(validateReport(s, req, null).report.summary).not.toMatch(/\d/);
});

test("malformed items are dropped, missing arrays become empty", () => {
  const s: any = clone();
  s.findings[0].low = "7";
  delete s.charts;
  const r = validateReport(s, req, null);
  expect(r.report.findings.map((f) => f.id)).not.toContain("F1");
  expect(r.report.charts).toEqual([]);
  expect(r.drops).toContain("findings[0]: malformed");
  expect(r.drops).toContain("charts: missing");
});

test("status: no findings is failed, one is thin", () => {
  const s = clone();
  s.findings = [];
  expect(validateReport(s, req, null).status).toBe("failed");
  s.findings = [sub.findings[0]!];
  expect(validateReport(s, req, null).status).toBe("thin");
});
