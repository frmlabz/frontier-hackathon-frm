// ROI report: types, the submit_report schema, estimate math and validation.
// Pure: no DB, no SDK. The web imports types and formatValue from here.

export type ResearchInput = { label: string; value: number; unit: string };
export type ResearchRequest = { business: string; location: string | null; pains: string[]; inputs: ResearchInput[] };

export type SourceKind = "study" | "survey" | "news" | "vendor";
export type Source = { id: string; title: string; publisher: string; url: string; kind: SourceKind; year: number | null };
export type Finding = { id: string; area: string; claim: string; low: number; high: number; unit: string; sourceIds: string[]; quote: string };
export type CaseStudy = { business: string; location: string | null; automated: string; result: string; sourceId: string; quote: string };
export type FactorOp = "pct" | "pct-remaining" | "ratio" | "ratio-remaining";
export type Factor = { op: FactorOp; findingId: string; denominatorId: string | null };
export type EstimateRef = { id: string; label: string; inputLabel: string; factors: Factor[] };
export type Chart = { title: string; bars: { label: string; ref: string }[] };
export type Opportunity = { id: string; title: string; pain: string; what: string; estimateIds: string[]; findingIds: string[] };

export type Submission = {
  title: string;
  summary: string;
  sources: Source[];
  findings: Finding[];
  caseStudies: CaseStudy[];
  estimates: EstimateRef[];
  charts: Chart[];
  opportunities: Opportunity[];
  caveats: string[];
  recommendedOpportunityId: string;
};

export type Estimate = EstimateRef & { low: number; high: number; unit: string; formula: string };
export type Report = Omit<Submission, "estimates"> & { inputs: ResearchInput[]; estimates: Estimate[] };
export type ReportStatus = "researching" | "ready" | "thin" | "failed";
export type ReportRow = {
  id: string;
  status: ReportStatus;
  input: ResearchRequest;
  report: Report | null;
  progress: { lines: string[]; sources: number };
  error: string | null;
  createdAt: number;
  updatedAt: number;
};

/** URLs seen in this run's tool results; fetched text is null for PDFs and binaries. */
export type Evidence = { urls: Set<string>; fetched: Map<string, string | null> };

// ---------- schema ----------
const str = { type: "string" } as const;
const num = { type: "number" } as const;
const strs = { type: "array", items: str } as const;
const obj = (properties: Record<string, any>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

export const REPORT_SCHEMA = obj({
  title: str,
  summary: { type: "string", description: "At most two sentences, no numbers." },
  sources: {
    type: "array",
    items: obj({
      id: { type: "string", description: "S1, S2, …" },
      title: str,
      publisher: str,
      url: { type: "string", description: "Exactly as returned by web_search or web_fetch in this run." },
      kind: { type: "string", enum: ["study", "survey", "news", "vendor"] },
      year: { type: ["number", "null"] },
    }),
  },
  findings: {
    type: "array",
    items: obj({
      id: { type: "string", description: "F1, F2, …" },
      area: str,
      claim: { type: "string", description: "Plain words, keeping qualifiers such as average, about, over, up to." },
      low: num,
      high: num,
      unit: { type: "string", description: "Percentages start with %, e.g. '% less kitchen food waste'." },
      sourceIds: strs,
      quote: { type: "string", description: "The sentence from the page, word for word, containing low and high." },
    }),
  },
  caseStudies: {
    type: "array",
    items: obj({
      business: str,
      location: { type: ["string", "null"] },
      automated: str,
      result: str,
      sourceId: str,
      quote: { type: "string", description: "Word for word from the page; every number in result must be in it." },
    }),
  },
  estimates: {
    type: "array",
    items: obj({
      id: { type: "string", description: "E1, E2, …" },
      label: str,
      inputLabel: { type: "string", description: "Exactly one of the owner's input labels." },
      factors: {
        type: "array",
        description: "One to three factors.",
        items: obj({
          op: { type: "string", enum: ["pct", "pct-remaining", "ratio", "ratio-remaining"] },
          findingId: str,
          denominatorId: { type: ["string", "null"], description: "Only for ratio ops: the finding to divide by." },
        }),
      },
    }),
  },
  charts: {
    type: "array",
    items: obj({
      title: str,
      bars: {
        type: "array",
        description: "2 to 4 bars sharing one unit.",
        items: obj({ label: str, ref: { type: "string", description: "An estimate id, a finding id, or input:<exact input label>." } }),
      },
    }),
  },
  opportunities: {
    type: "array",
    items: obj({
      id: { type: "string", description: "O1, O2, …" },
      title: { type: "string", description: "Plain app name, e.g. Inventory." },
      pain: { type: "string", description: "The owner's pain in their words." },
      what: { type: "string", description: "One sentence: what would be set up." },
      estimateIds: strs,
      findingIds: strs,
    }),
  },
  caveats: strs,
  recommendedOpportunityId: str,
});

// ---------- formatting ----------
const round = (v: number) => (Math.abs(v) >= 10 ? Math.round(v) : Math.round(v * 10) / 10);
const fmt = (v: number) => round(v).toLocaleString("en-US");
const range = (lo: number, hi: number) => (round(lo) === round(hi) ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`);

/** €94–234/month for EUR/…, otherwise "3.7 h/week". */
export function formatValue(low: number, high: number, unit: string): string {
  const m = /^(EUR|USD|GBP)(\/.*)?$/.exec(unit);
  if (m) return `${{ EUR: "€", USD: "$", GBP: "£" }[m[1] as "EUR"]}${range(low, high)}${m[2] ?? ""}`;
  return `${range(low, high)} ${unit}`;
}
const pctText = (f: Finding) => `${range(f.low, f.high)}%`;

// ---------- estimates ----------
export function computeEstimate(ref: EstimateRef, inputs: ResearchInput[], findings: Finding[]): Estimate | null {
  const input = inputs.find((i) => i.label === ref.inputLabel);
  if (!input || !Number.isFinite(input.value) || input.value < 0) return null;
  if (ref.factors.length < 1 || ref.factors.length > 3) return null;
  const byId = new Map(findings.map((f) => [f.id, f]));
  let lo = input.value;
  let hi = input.value;
  const parts = [formatValue(input.value, input.value, input.unit)];
  for (const fac of ref.factors) {
    const f = byId.get(fac.findingId);
    if (!f) return null;
    let a: number, b: number;
    if (fac.op === "pct" || fac.op === "pct-remaining") {
      if (!f.unit.trim().startsWith("%") || f.low < 0 || f.high > 100 || f.low > f.high) return null;
      [a, b] = fac.op === "pct" ? [f.low / 100, f.high / 100] : [1 - f.high / 100, 1 - f.low / 100];
      parts.push(fac.op === "pct" ? `${pctText(f)} (${f.id})` : `(100% − ${pctText(f)}) (${f.id})`);
    } else {
      const d = fac.denominatorId ? byId.get(fac.denominatorId) : undefined;
      if (!d || d.unit !== f.unit || !(d.low > 0) || f.low < 0) return null;
      const ratio = `${range(f.low, f.high)} ÷ ${range(d.low, d.high)}`;
      if (fac.op === "ratio") {
        [a, b] = [f.low / d.high, f.high / d.low];
        parts.push(`${ratio} (${f.id}, ${d.id})`);
      } else {
        [a, b] = [1 - f.high / d.low, 1 - f.low / d.high];
        if (a < 0) return null;
        parts.push(`(1 − ${ratio}) (${f.id}, ${d.id})`);
      }
    }
    lo *= a;
    hi *= b;
  }
  return { ...ref, low: round(lo), high: round(hi), unit: input.unit, formula: parts.join(" × ") };
}

// ---------- validation ----------
export const normUrl = (u: string) => u.trim().replace(/#.*$/, "").replace(/\/+$/, "");
export const normText = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
const numbersIn = (s: string) => (s.match(/\d[\d,]*(\.\d+)?/g) ?? []).map((n) => Number(n.replace(/,/g, "")));

const NEUTRAL_SUMMARY = "Some public evidence is available. See the findings and their limits.";

/** Minimal check of a value against the subset of JSON Schema used by REPORT_SCHEMA. */
function conforms(v: any, s: any): boolean {
  const types: string[] = Array.isArray(s.type) ? s.type : [s.type];
  if (v === null) return types.includes("null");
  if (s.enum && !s.enum.includes(v)) return false;
  if (types.includes("string") && typeof v === "string") return true;
  if (types.includes("number") && typeof v === "number" && Number.isFinite(v)) return true;
  if (types.includes("array") && Array.isArray(v)) return v.every((x) => conforms(x, s.items));
  if (types.includes("object") && typeof v === "object" && !Array.isArray(v))
    return s.required.every((k: string) => k in v && conforms(v[k], s.properties[k]));
  return false;
}

/**
 * The tool isn't strict (the API rejects a grammar this large), so shape is checked here:
 * top-level arrays keep only well-formed items, and a missing or wrong top-level field becomes empty.
 */
export function shapeSubmission(raw: any, drops: string[]): Submission {
  const P = REPORT_SCHEMA.properties as Record<string, any>;
  const out: any = {};
  for (const [k, s] of Object.entries(P)) {
    const v = raw?.[k];
    if (s.type === "array") {
      const items = Array.isArray(v) ? v : [];
      if (!Array.isArray(v)) drops.push(`${k}: missing`);
      out[k] = items.filter((x: any, i: number) => conforms(x, s.items) || (drops.push(`${k}[${i}]: malformed`), false));
    } else if (conforms(v, s)) out[k] = v;
    else {
      drops.push(`${k}: missing`);
      out[k] = "";
    }
  }
  return out as Submission;
}

export type Validated = { report: Report; status: "ready" | "thin" | "failed"; drops: string[] };

/** Drops anything unsupported (never repairs). evidence = null skips the URL and verbatim checks (hand-checked fixture). */
export function validateReport(raw: Submission, request: ResearchRequest, evidence: Evidence | null): Validated {
  const drops: string[] = [];
  const sub = shapeSubmission(raw, drops);
  const drop = (what: string, why: string) => drops.push(`${what}: ${why}`);
  const fetchedText = new Map<string, string | null>();
  if (evidence) for (const [u, t] of evidence.fetched) fetchedText.set(normUrl(u), t == null ? null : normText(t));
  const seenUrls = evidence ? new Set([...evidence.urls].map(normUrl)) : null;

  // 1. sources
  const sources: Source[] = [];
  for (const s of sub.sources) {
    if (sources.some((x) => x.id === s.id)) drop(s.id, "duplicate id");
    else if (!/^https?:\/\//.test(s.url)) drop(s.id, "not an http(s) URL");
    else if (seenUrls && !seenUrls.has(normUrl(s.url))) drop(s.id, `URL not returned in this run (${s.url})`);
    else sources.push(s);
  }
  const srcIds = new Set(sources.map((s) => s.id));
  const srcUrl = new Map(sources.map((s) => [s.id, normUrl(s.url)]));

  /** 3. verbatim: if any cited source was fetched with text, the quote must be in it. */
  const verbatim = (ids: string[], quote: string) => {
    const texts = ids.map((id) => fetchedText.get(srcUrl.get(id)!)).filter((t): t is string => typeof t === "string");
    if (!texts.length) return true;
    const q = normText(quote);
    return texts.some((t) => t.includes(q));
  };

  // 2. findings
  const findings: Finding[] = [];
  for (const f of sub.findings) {
    const nums = numbersIn(f.quote);
    if (findings.some((x) => x.id === f.id)) drop(f.id, "duplicate id");
    else if (!f.sourceIds.length || !f.sourceIds.every((id) => srcIds.has(id))) drop(f.id, "cites a missing source");
    else if (!Number.isFinite(f.low) || !Number.isFinite(f.high) || f.low > f.high) drop(f.id, "bad range");
    else if (!f.quote.trim()) drop(f.id, "empty quote");
    else if (!nums.includes(f.low) || !nums.includes(f.high)) drop(f.id, `numbers ${f.low}/${f.high} not in quote`);
    else if (!verbatim(f.sourceIds, f.quote)) drop(f.id, "quote not found on the fetched page");
    else findings.push(f);
  }

  // 4. case studies
  const caseStudies: CaseStudy[] = [];
  for (const c of sub.caseStudies) {
    const what = `case study ${c.business}`;
    const qn = numbersIn(c.quote);
    if (!srcIds.has(c.sourceId)) drop(what, "missing source");
    else if (!c.quote.trim()) drop(what, "empty quote");
    else if (!numbersIn(c.result).every((n) => qn.includes(n))) drop(what, "result numbers not in quote");
    else if (!verbatim([c.sourceId], c.quote)) drop(what, "quote not found on the fetched page");
    else caseStudies.push(c);
  }

  // 5. estimates
  const estimates: Estimate[] = [];
  const findingIds = new Set(findings.map((f) => f.id));
  for (const ref of sub.estimates) {
    if (findingIds.has(ref.id) || estimates.some((e) => e.id === ref.id)) {
      drop(ref.id, "duplicate id");
      continue;
    }
    const e = computeEstimate(ref, request.inputs, findings);
    if (e) estimates.push(e);
    else drop(ref.id, "can't be computed from the owner's inputs and surviving findings");
  }

  // 6. charts
  const unitOf = (ref: string): { unit: string } | null => {
    if (ref.startsWith("input:")) return request.inputs.find((i) => i.label === ref.slice(6)) ?? null;
    return estimates.find((e) => e.id === ref) ?? findings.find((f) => f.id === ref) ?? null;
  };
  const charts: Chart[] = [];
  for (const c of sub.charts) {
    const units = c.bars.map((b) => unitOf(b.ref)?.unit);
    if (c.bars.length < 2 || c.bars.length > 4) drop(`chart "${c.title}"`, "needs 2–4 bars");
    else if (units.some((u) => u == null)) drop(`chart "${c.title}"`, "a bar doesn't resolve");
    else if (new Set(units).size > 1) drop(`chart "${c.title}"`, `mixed units (${[...new Set(units)].join(", ")})`);
    else if (charts.length >= 3) drop(`chart "${c.title}"`, "more than 3 charts");
    else charts.push(c);
  }

  // 7. opportunities
  const estIds = new Set(estimates.map((e) => e.id));
  const opportunities: Opportunity[] = [];
  for (const o of sub.opportunities) {
    const kept = { ...o, estimateIds: o.estimateIds.filter((id) => estIds.has(id)), findingIds: o.findingIds.filter((id) => findingIds.has(id)) };
    if (!kept.findingIds.length) drop(o.id, "no surviving findings");
    else opportunities.push(kept);
  }
  const recommendedOpportunityId = opportunities.some((o) => o.id === sub.recommendedOpportunityId) ? sub.recommendedOpportunityId : "";

  // 8. summary
  const summary = /\d/.test(sub.summary) ? NEUTRAL_SUMMARY : sub.summary;
  if (summary !== sub.summary) drop("summary", "contained a number");

  // 9. status
  const status = findings.length === 0 ? "failed" : findings.length === 1 ? "thin" : "ready";
  return {
    status,
    drops,
    report: {
      title: sub.title,
      summary,
      inputs: request.inputs,
      sources,
      findings,
      caseStudies,
      estimates,
      charts,
      opportunities,
      caveats: sub.caveats,
      recommendedOpportunityId,
    },
  };
}

const KIND_RANK: SourceKind[] = ["study", "survey", "news", "vendor"];
/** First finding from the best-ranked source kind. */
export function strongestFinding(r: Report): { finding: Finding; kind: SourceKind } | null {
  const kindOf = (f: Finding) =>
    f.sourceIds.map((id) => r.sources.find((s) => s.id === id)?.kind ?? "vendor").sort((a, b) => KIND_RANK.indexOf(a) - KIND_RANK.indexOf(b))[0]!;
  let best: { finding: Finding; kind: SourceKind } | null = null;
  for (const f of r.findings) {
    const k = kindOf(f);
    if (!best || KIND_RANK.indexOf(k) < KIND_RANK.indexOf(best.kind)) best = { finding: f, kind: k };
  }
  return best;
}
