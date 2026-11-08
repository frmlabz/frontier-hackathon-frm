// 📈 Automation ROI report (04 B6). Renders a ReportRow as stored by server/research.ts; every number
// here comes from the validated report (fixture in mock mode), nothing is computed beyond display formatting.
import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { navigate, sendChat, useStore } from "../store";
import { formatValue, strongestFinding, type Estimate, type Finding, type Report, type ReportRow, type ResearchInput, type SourceKind } from "../../server/report";
import { Badge, Button, PageChrome, PageTitle, Spinner, cx } from "./common";

// ---------- display helpers ----------
const round = (v: number) => (Math.abs(v) >= 10 ? Math.round(v) : Math.round(v * 10) / 10);
const num = (v: number) => round(v).toLocaleString("en-US");
const span = (lo: number, hi: number) => (round(lo) === round(hi) ? num(lo) : `${num(lo)}–${num(hi)}`);

/** formatValue, plus "26% less…" for % units and "$7 saved per $1" for units that start with a currency symbol. */
export function showValue(low: number, high: number, unit: string) {
  if (unit.startsWith("%")) return `${span(low, high)}${unit}`;
  const m = /^([$€£]) (.*)$/.exec(unit);
  if (m) return `${m[1]}${span(low, high)} ${m[2]}`;
  return formatValue(low, high, unit);
}
const isPoint = (lo: number, hi: number) => round(lo) === round(hi);

export const KIND: Record<SourceKind, { label: string; tone: "green" | "blue" | "purple" | "orange" }> = {
  study: { label: "Study", tone: "green" },
  survey: { label: "Industry survey", tone: "blue" },
  news: { label: "News", tone: "purple" },
  vendor: { label: "Vendor claim", tone: "orange" },
};
export const KindChip = ({ kind }: { kind: SourceKind }) => <Badge tone={KIND[kind].tone}>{KIND[kind].label}</Badge>;

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });

/** Superscript source numbers, e.g. ¹ ³, that scroll to the numbered list. */
function Cites({ r, ids }: { r: Report; ids: string[] }) {
  return (
    <sup className="ml-0.5 inline-flex gap-0.5">
      {ids.map((id) => ({ id, n: r.sources.findIndex((s) => s.id === id) + 1 })).sort((a, b) => a.n - b.n).map(({ id, n }) => {
        return n > 0 ? (
          <a key={id} href={`#src-${id}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); scrollTo(`src-${id}`); }} className="text-primary hover:underline font-medium">
            [{n}]
          </a>
        ) : null;
      })}
    </sup>
  );
}

/** "Stock-outs per week (low)" + "(high)" become one "Stock-outs per week: 2–3 times/week" row. */
export function toldUs(inputs: ResearchInput[]) {
  const rows: { label: string; value: string }[] = [];
  const done = new Set<string>();
  for (const i of inputs) {
    const m = /^(.*) \((low|high)\)$/.exec(i.label);
    if (!m) { rows.push({ label: i.label, value: formatValue(i.value, i.value, i.unit) }); continue; }
    if (done.has(m[1]!)) continue;
    done.add(m[1]!);
    const lo = inputs.find((x) => x.label === `${m[1]} (low)`)?.value ?? i.value;
    const hi = inputs.find((x) => x.label === `${m[1]} (high)`)?.value ?? i.value;
    rows.push({ label: m[1]!, value: formatValue(Math.min(lo, hi), Math.max(lo, hi), i.unit) });
  }
  return rows;
}

const findingIdsOf = (e: Estimate) => [...new Set(e.factors.flatMap((f) => [f.findingId, f.denominatorId]).filter((x): x is string => !!x))];
const kindOfFinding = (r: Report, f: Finding): SourceKind => {
  const order: SourceKind[] = ["study", "survey", "news", "vendor"];
  return f.sourceIds.map((id) => r.sources.find((s) => s.id === id)?.kind ?? "vendor").sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] ?? "vendor";
};

/** Opportunities in rank order, the recommended one first. */
const ranked = (r: Report) => [...r.opportunities].sort((a, b) => Number(b.id === r.recommendedOpportunityId) - Number(a.id === r.recommendedOpportunityId));

/** The first estimate of each opportunity, recommended first, max 2. */
export function headlineEstimates(r: Report) {
  const out: Estimate[] = [];
  for (const o of ranked(r)) {
    const e = o.estimateIds.map((id) => r.estimates.find((x) => x.id === id)).find(Boolean);
    if (e && !out.includes(e)) out.push(e);
    if (out.length === 2) break;
  }
  return out;
}

// ---------- tiles ----------
export function EstimateTile({ r, e, compact }: { r: Report; e: Estimate; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const ids = findingIdsOf(e);
  return (
    <div data-tile={e.id} className={cx("@container rounded-lg border border-hairline bg-white min-w-0", compact ? "p-3" : "p-4")}>
      <div className={cx("font-bold tracking-[-0.02em] text-ink-strong leading-tight [overflow-wrap:break-word]", compact ? "text-[18px] @min-[180px]:text-[20px]" : "text-[18px] @min-[200px]:text-[28px]")}>
        {isPoint(e.low, e.high) ? "≈ " : ""}{formatValue(e.low, e.high, e.unit)}
      </div>
      <div className="mt-1 text-[13px] text-muted">{e.label}</div>
      {!compact && (
        <>
          <button onClick={() => setOpen((o) => !o)} className="mt-2 inline-flex items-center gap-0.5 text-[12px] text-muted hover:text-ink cursor-pointer">
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />} How we got this
          </button>
          {open && (
            <div className="mt-1.5 text-[12px] text-ink anim-fade-in">
              <div className="font-mono text-[12px] bg-canvas-soft rounded px-2 py-1.5 [overflow-wrap:anywhere]">{e.formula}</div>
              <div className="mt-1.5 text-muted">
                Uses{" "}
                {ids.map((id, i) => (
                  <span key={id}>
                    {i > 0 && ", "}
                    <a href={`#f-${id}`} onClick={(ev) => { ev.preventDefault(); scrollTo(`f-${id}`); }} className="text-primary hover:underline">
                      {r.findings.find((f) => f.id === id)?.area ?? id}
                    </a>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EvidenceTile({ r, f }: { r: Report; f: Finding }) {
  const m = /^([$€£]) (.*)$/.exec(f.unit);
  const big = m ? `${m[1]}${span(f.low, f.high)}` : f.unit.startsWith("%") ? `${span(f.low, f.high)}%` : span(f.low, f.high);
  const rest = m ? m[2] : f.unit.startsWith("%") ? f.unit.slice(1).trim() : f.unit;
  return (
    <div data-tile="evidence" className="@container rounded-lg border border-hairline bg-canvas-soft p-4 min-w-0">
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="text-[18px] @min-[200px]:text-[28px] font-bold tracking-[-0.02em] text-ink-strong leading-tight">{big}</span>
        <span className="text-[14px] text-ink">{rest}</span>
      </div>
      <div className="mt-1 text-[13px] text-muted">
        {f.area}
        <Cites r={r} ids={f.sourceIds} />
      </div>
      <div className="mt-2 inline-block rounded px-1.5 py-0.5 text-[12px] font-medium leading-tight bg-[#dbeddb] text-[#2b593f]">Study, not your numbers</div>
    </div>
  );
}

// ---------- charts ----------
type Bar = { label: string; low: number; high: number; unit: string; sourceIds: string[] | "you" };
function resolveBars(r: Report, bars: { label: string; ref: string }[]): Bar[] {
  return bars.flatMap((b): Bar[] => {
    if (b.ref.startsWith("input:")) {
      const i = r.inputs.find((x) => x.label === b.ref.slice(6));
      return i ? [{ label: b.label, low: i.value, high: i.value, unit: i.unit, sourceIds: "you" }] : [];
    }
    const e = r.estimates.find((x) => x.id === b.ref);
    if (e) return [{ label: b.label, low: e.low, high: e.high, unit: e.unit, sourceIds: findingIdsOf(e).flatMap((id) => r.findings.find((f) => f.id === id)?.sourceIds ?? []) }];
    const f = r.findings.find((x) => x.id === b.ref);
    return f ? [{ label: b.label, low: f.low, high: f.high, unit: f.unit, sourceIds: f.sourceIds }] : [];
  });
}

export function ChartView({ r, title, bars: refs }: { r: Report; title: string; bars: { label: string; ref: string }[] }) {
  const bars = resolveBars(r, refs);
  if (!bars.length) return null;
  const pct = bars.every((b) => b.unit.startsWith("%"));
  const max = Math.max(pct ? 100 : 0, ...bars.map((b) => b.high)) || 1;
  const ids = [...new Set(bars.flatMap((b) => (b.sourceIds === "you" ? [] : b.sourceIds)))];
  const fromYou = bars.some((b) => b.sourceIds === "you");
  const kinds = [...new Set(ids.map((id) => r.sources.find((s) => s.id === id)?.kind).filter((k): k is SourceKind => !!k))];
  // One row per bar: HTML label and value (they wrap at phone width), then the bar as an SVG on the chart's shared 0–max axis.
  return (
    <figure data-chart className="rounded-lg border border-hairline bg-white p-4 min-w-0">
      <figcaption className="text-[14px] font-semibold text-ink-strong mb-3">{title}</figcaption>
      <div className="flex flex-col gap-3">
        {bars.map((b, i) => {
          const lo = (Math.min(b.low, b.high) / max) * 100;
          const hi = (b.high / max) * 100;
          return (
            <div key={i} data-bar className="min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] leading-snug">
                <span className="text-ink min-w-0">{b.label}</span>
                <span className="font-semibold text-ink-strong">{showValue(b.low, b.high, b.unit).replace(/ .*$/, "") /* the number; a non-currency unit is under the chart */}</span>
              </div>
              <svg viewBox="0 0 100 4" preserveAspectRatio="none" className="mt-1 block w-full h-2.5 bg-canvas-soft rounded-sm" aria-hidden>
                {hi > lo && <rect x={lo} y="0" width={hi - lo} height="4" fill="#0075de" opacity="0.28" />}
                <rect x="0" y="0" width={Math.max(lo, 0.6)} height="4" fill="#0075de" />
              </svg>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
        {!/^(EUR|USD|GBP)/.test(bars[0]!.unit) && <><span>{bars[0]!.unit}</span><span className="text-faint">·</span></>}
        {fromYou && <Badge>You, in chat</Badge>}
        {kinds.map((k) => <KindChip key={k} kind={k} />)}
        {ids.length > 0 && <Cites r={r} ids={ids} />}
      </div>
    </figure>
  );
}

// ---------- findings ----------
function FindingRow({ r, f }: { r: Report; f: Finding }) {
  const [open, setOpen] = useState(false);
  return (
    <div id={`f-${f.id}`} data-finding={f.id} className="border-b border-hairline last:border-b-0">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left py-3 flex gap-3 cursor-pointer hover:bg-hover/50 -mx-2 px-2 rounded" aria-expanded={open}>
        <span className="pt-0.5 text-faint shrink-0">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[12px] font-medium text-muted">{f.area}</span>
            <KindChip kind={kindOfFinding(r, f)} />
          </span>
          <span className="block mt-0.5 text-[14px] text-ink leading-snug">
            {f.claim}
            <Cites r={r} ids={f.sourceIds} />
          </span>
          <span className="@md:hidden block mt-1 text-[13px] font-semibold text-ink-strong">{showValue(f.low, f.high, f.unit)}</span>
          {open && <span className="block mt-2 pl-3 border-l-2 border-hairline-strong text-[13px] text-muted italic anim-fade-in">“{f.quote}”</span>}
        </span>
        <span className="shrink-0 text-[13px] font-semibold text-ink-strong text-right max-w-[40%] hidden @md:block">{showValue(f.low, f.high, f.unit)}</span>
      </button>
    </div>
  );
}

const H2 = ({ children }: { children: ReactNode }) => <h2 className="mt-10 mb-3 text-[20px] font-semibold text-ink-strong tracking-[-0.01em]">{children}</h2>;

// ---------- page ----------
export function ReportPage({ id }: { id: string }) {
  const row = useStore((s) => s.reports.find((r) => r.id === id));
  const loaded = useStore((s) => s.loaded);
  if (!row) {
    return (
      <PageChrome crumbs={["📈 Automation ROI"]}>
        <div className="pt-24 text-[14px] text-muted">{loaded ? "This report doesn't exist." : <Spinner />}</div>
      </PageChrome>
    );
  }
  return (
    <PageChrome crumbs={["📈 Automation ROI"]}>
      <ReportPageView row={row} />
    </PageChrome>
  );
}

export function ReportPageView({ row }: { row: ReportRow }) {
  const busy = useStore((s) => s.busy);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const r = row.report;
  if (row.status === "researching" || !r) {
    return (
      <div data-report={row.id} data-status={row.status}>
        <PageTitle emoji="📈" title={row.status === "failed" ? "Research didn't finish" : "Researching what automation is worth"} />
        {row.status === "failed" ? (
          <p className="text-[15px] text-ink">{row.error ?? "The research didn't produce a report."}</p>
        ) : (
          <Progress row={row} lines={12} />
        )}
      </div>
    );
  }
  const thin = row.status === "thin";
  const ev = strongestFinding(r);
  const study = ev?.kind === "study" ? ev.finding : null;
  const tiles = thin ? [] : headlineEstimates(r);
  const start = async (title: string) => {
    setSending(true);
    setSendError(null);
    const ok = await sendChat(`Let's start with ${title}.`).catch(() => false);
    setSending(false);
    if (ok) navigate("/");
    else setSendError("Couldn't send that. Try again.");
  };

  return (
    <div data-report={row.id} data-status={row.status} className="@container">
      <PageTitle emoji="📈" title={r.title} sub={<span className="text-[15px] text-ink leading-relaxed">{r.summary}</span>} />

      {thin && (
        <div className="mt-2 rounded-lg border border-[#f3d9a4] bg-[#fdf6e3] px-4 py-3 text-[14px] text-ink">
          <div className="font-semibold text-ink-strong">Not much solid public data on this</div>
          <div className="text-muted mt-0.5">We found too little verified evidence to put numbers on it. What we did find is below.</div>
        </div>
      )}
      {row.status === "failed" && <p className="mt-2 text-[14px] text-red">{row.error}</p>}

      {(tiles.length > 0 || (!thin && study)) && (
        <div className="mt-6 grid grid-cols-1 @2xl:grid-cols-3 gap-3 items-start">
          {tiles.map((e) => <EstimateTile key={e.id} r={r} e={e} />)}
          {!thin && study && <EvidenceTile r={r} f={study} />}
        </div>
      )}

      {r.inputs.length > 0 && (
        <>
          <H2>You told us</H2>
          <div data-told-us className="rounded-lg border border-hairline">
            {toldUs(r.inputs).map((t) => (
              <div key={t.label} className="flex flex-wrap items-baseline justify-between gap-x-3 px-3 py-2 text-[14px] border-b border-hairline last:border-b-0">
                <span className="text-muted min-w-0">{t.label}</span>
                <span className="text-ink-strong font-medium">{t.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 text-[12px] text-faint">Source: you, in chat</div>
        </>
      )}

      {!thin && r.charts.length > 0 && (
        <>
          <H2>How it compares</H2>
          <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-3">
            {r.charts.map((c, i) => <ChartView key={i} r={r} title={c.title} bars={c.bars} />)}
          </div>
        </>
      )}

      <H2>What others saw</H2>
      {r.findings.length ? <div>{r.findings.map((f) => <FindingRow key={f.id} r={r} f={f} />)}</div> : <p className="text-[14px] text-muted">No findings survived verification.</p>}

      <H2>Restaurants like yours</H2>
      {r.caseStudies.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {r.caseStudies.map((c, i) => (
            <div key={i} className="rounded-lg border border-hairline p-4">
              <div className="text-[14px] font-semibold text-ink-strong">{c.business}{c.location ? `, ${c.location}` : ""}<Cites r={r} ids={[c.sourceId]} /></div>
              <div className="mt-1 text-[13px] text-ink">{c.automated}</div>
              <div className="mt-1 text-[13px] text-ink-strong font-medium">{c.result}</div>
              <div className="mt-2 text-[12px] text-muted italic">“{c.quote}”</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[14px] text-muted">No named restaurant examples were verified.</p>
      )}

      {!thin && r.opportunities.length > 0 && (
        <>
          <H2>Where to start</H2>
          <div className="flex flex-col gap-3">
            {ranked(r).map((o) => {
              const rec = o.id === r.recommendedOpportunityId;
              const ests = o.estimateIds.map((id) => r.estimates.find((e) => e.id === id)).filter((e): e is Estimate => !!e);
              return (
                <div key={o.id} data-opportunity={o.id} className={cx("rounded-lg border p-3 @md:p-4", rec ? "border-primary bg-[#f2f8fd]" : "border-hairline")}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[16px] font-semibold text-ink-strong">{o.title}</span>
                        {rec && <Badge tone="blue">Recommended</Badge>}
                      </div>
                      <div className="mt-1 text-[13px] text-muted">{o.pain}</div>
                      <div className="mt-1 text-[14px] text-ink">{o.what}</div>
                    </div>
                    <Button variant={rec ? "primary" : "secondary"} size="sm" disabled={busy || sending} onClick={() => void start(o.title)}>Start with this</Button>
                  </div>
                  {ests.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                      {ests.map((e) => (
                        <li key={e.id}><span className="font-semibold text-ink-strong">{isPoint(e.low, e.high) ? "≈ " : ""}{formatValue(e.low, e.high, e.unit)}</span> <span className="text-muted">{e.label.toLowerCase()}</span></li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
          {sendError && <p className="mt-2 text-[13px] text-red" role="alert">{sendError}</p>}
        </>
      )}

      {r.caveats.length > 0 && (
        <>
          <H2>Caveats</H2>
          <ul className="list-disc pl-5 space-y-1 text-[14px] text-ink">{r.caveats.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </>
      )}

      <H2>Sources</H2>
      <ol className="space-y-2">
        {r.sources.map((s, i) => (
          <li key={s.id} id={`src-${s.id}`} className="flex gap-2 text-[14px] scroll-mt-16">
            <span className="text-muted w-6 shrink-0 text-right">{i + 1}.</span>
            <span className="min-w-0">
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-ink-strong font-medium hover:underline [overflow-wrap:anywhere]">
                {s.title} <ExternalLink size={12} className="inline -mt-0.5 text-faint" />
              </a>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-[12px] text-muted">
                <span>{s.publisher}{s.year ? `, ${s.year}` : ""}</span>
                <KindChip kind={s.kind} />
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The last `lines` progress lines (newest bold) and the source count. Shared with the chat card. */
export function Progress({ row, lines = 4 }: { row: ReportRow; lines?: number }) {
  const shown = row.progress.lines.slice(-lines);
  return (
    <div data-progress>
      <div className="flex flex-col gap-1">
        {shown.map((l, i) => {
          const last = i === shown.length - 1;
          return (
            <div key={row.progress.lines.length - shown.length + i} className={cx("flex items-center gap-2 text-[13px] anim-fade-in", last ? "text-ink-strong font-medium" : "text-muted")}>
              <span className="w-4 h-4 flex items-center justify-center shrink-0">{last ? <Spinner size={12} /> : <span className="w-1.5 h-1.5 rounded-full bg-[#c7c6c4]" />}</span>
              <span className="min-w-0 [overflow-wrap:anywhere]">{l}</span>
            </div>
          );
        })}
        {!shown.length && <div className="flex items-center gap-2 text-[13px] text-muted"><Spinner size={12} /> Starting…</div>}
      </div>
      <div className="mt-2 text-[12px] text-faint">{row.progress.sources} source{row.progress.sources === 1 ? "" : "s"} found</div>
    </div>
  );
}
