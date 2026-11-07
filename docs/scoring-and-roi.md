# Scoring and ROI

All formulas below are proposed deterministic MVP rules. Version them with the analysis run. Display inputs, units, coverage, and assumptions beside results; an LLM may explain calculations but cannot supply the authoritative totals.

## Time and financial impact

For a defined workflow segment and observation window:

```text
baseline_hours = sum(eligible measured human active_duration_ms) / 3_600_000
gross_recoverable_hours = baseline_hours * removable_fraction
net_recoverable_hours = max(0, gross_recoverable_hours - added_review_hours)
capacity_value = net_recoverable_hours * assumed_loaded_hourly_cost
monthly_net_value = monthly_capacity_value - monthly_operating_cost
first_year_net_value = 12 * monthly_net_value - implementation_cost
first_year_roi = first_year_net_value / implementation_cost
payback_months = implementation_cost / monthly_net_value
```

The annual and payback formulas apply only to an explicitly justified recurring monthly scenario with consistent units. Do not annualize an arbitrary partial window without an explicit volume/seasonality assumption. `first_year_roi` is unavailable when implementation cost is zero or unknown; payback is unavailable when monthly net value is nonpositive or inputs are missing.

For uniform demo cases, `case_count * active_minutes_per_case / 60` is an independent check on baseline hours. Real data should use event-level measured totals and disclose missing coverage. Do not impute unmeasured effort silently.

`removable_fraction`, future review effort, labor cost, implementation cost, and operating cost are assumptions unless separately measured or quoted. Explain each source and allow review. Use low/base/high scenarios when inputs are uncertain, each using a coherent set of assumptions. Unknown impact remains unknown; zero is a calculated result, not a placeholder.

Recovered time is **capacity**, not cash savings. Monetary figures are an estimated capacity value unless a separate, validated cash-cost change is documented. Elapsed turnaround improvement is a separate metric and is never multiplied by labor cost.

## Ranking v1

Rank eligible opportunities using the base-case monthly net recoverable hours `H`, assessed feasibility `F` from 0 to 1, and estimated implementation effort `D` in person-days:

```text
impact_component = min(H / 20, 1)
effort_component = 1 - min(D / 10, 1)
score = 100 * (0.50 * impact_component + 0.30 * F + 0.20 * effort_component)
```

Reject negative/nonfinite values, `F` outside `[0, 1]`, or missing required inputs. Such findings remain visible as unranked with an explanation. Sort by unrounded score descending, then stable opportunity ID ascending; round only for display.

The 20-hour and 10-day normalization caps and weights are explicit hackathon assumptions, not learned or validated business benchmarks. Feasibility and implementation effort need written rationale. Confidence stays visible separately and must not be treated as another hidden multiplier. Scores support review; they do not authorize implementation.

This MVP score favors capacity, feasibility, and effort. Show estimated financial impact and risks alongside it. A later production model can incorporate validated costs, error rates, and constraints; do not describe v1 as an optimized financial ROI ranking.

## Independent demo calculation

The planned fixture covers one complete synthetic month. Each row targets a disjoint set of human work events; these are expected results to implement and verify, not measurements from an existing dataset.

| Opportunity | Cases × minutes | Baseline h | Removable fraction | Added review h | Net h | F | D | Score |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Order re-entry → system integration | 600 × 2 | 20 | 0.90 | 2 | 16 | 0.9 | 2 | 83 |
| Return classification → rules/AI triage with review | 300 × 4 | 20 | 0.80 | 4 | 12 | 0.8 | 4 | 66 |
| Invoice reconciliation → matching rules with exceptions | 200 × 6 | 20 | 0.75 | 5 | 10 | 0.7 | 6 | 54 |

At an assumed EUR 30 per hour, the first opportunity represents EUR 480 per month of capacity value. Assuming EUR 80 monthly operating cost and EUR 1,200 one-time implementation cost, net estimated monthly value is EUR 400, first-year net value is EUR 3,600, first-year ROI is 300%, and payback is 3 months. All cost inputs are illustrative, unvalidated assumptions.

## Aggregation and outcome rules

- Combine only estimates using the same organization, period, and scenario.
- Sum independent work segments only. Competing solutions for the same segment are alternatives, not additive benefits.
- Use evidence-event membership to detect overlapping savings claims. Exclude unresolved overlap from combined totals and explain the exclusion.
- For the disjoint demo rows, expected combined net capacity is 38 hours per synthetic month. That is not a guaranteed real-world outcome.
- Keep realized outcomes separate from forecasts. A future outcome record needs a baseline, post-change measurement window, and context about volume or process changes before making a causal claim.
