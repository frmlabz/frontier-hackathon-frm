# MVP scope and acceptance

## Goal and audience

Demonstrate that operational events can reveal useful improvements without employee desktop monitoring or an internal automation team. The primary user is an operations manager at a small or mid-sized business; the proposed demo vertical is e-commerce operations.

The core result is an evidence-backed, ranked opportunity feed. Workflow maps and dashboards help the manager understand those opportunities.

## Required user journey

1. Select the fictional demo organization and import its CSV or JSON event export.
2. Review accepted/rejected records, source coverage, and the observed date range.
3. Start an analysis and see its progress or actionable failure state.
4. Open discovered workflows, their variants, systems, frequencies, active effort, and elapsed delays.
5. Review at least three ranked improvement opportunities without supplying an analysis prompt.
6. Inspect an opportunity's supporting events, metrics, proposed solution, assumptions, confidence, and impact calculation.
7. Confirm or flag the workflow interpretation and accept or dismiss a recommendation with optional reasoning.
8. Open a generated executive report that explains what to improve first and why.

The demo must run from imported events. A precomputed screenshot or hardcoded opportunity list does not satisfy this journey.

## Screens and required content

| Screen | Minimum useful content |
| --- | --- |
| Overview | Organization, source/date coverage, workflow counts, top opportunities, capacity estimate with uncertainty |
| Process Explorer | Workflow graph, frequency, variants, systems, measured effort, elapsed duration, inspectable evidence |
| Opportunities | Ranked feed with impact, feasibility, implementation effort, confidence, and review status |
| Opportunity Detail | Current process, detected issue, recommendation, evidence, ROI inputs, limitations, next steps |
| Reports | Executive summary, top priorities, methodology, assumptions, source coverage, and analysis date |

Use a clean, executive-friendly interface with readable graphs. Include empty, importing, analyzing, completed, and failed states. Show synthetic provenance and estimate labels clearly without filling the interface with developer controls. On narrow screens, opportunity details and evidence must remain readable and navigable.

## In scope

- One fictional organization with several pseudonymous actors and business systems.
- Structured CSV and JSON imports using a shared event contract.
- Object-based workflow reconstruction, recurring sequences, variants, and deterministic metrics.
- Rule-based candidate detection plus LLM-assisted interpretation and recommendations.
- Deterministic ranking and transparent estimated capacity/financial calculations.
- Evidence inspection, lightweight review feedback, and a generated in-app executive report suitable for browser printing.
- Reproducible demo reset and a versioned dataset with independent expected results.

## Outside the first build

Desktop collectors, browser recording extensions, live OAuth connectors, production business-system writes, autonomous implementation, arbitrary process-mining accuracy, PDF export infrastructure, learned personalization, industry benchmarks, security analytics, and cross-company data products.

An authenticated production multi-tenant service is later work. The demo must still scope stored data and queries to the selected organization and must not be publicly exposed with real customer data before access controls are implemented.

## Completion gates

- A clean setup can import the versioned dataset and reproduce the same deterministic metrics and ranking.
- Imports reject invalid records with understandable errors and do not duplicate events on replay.
- At least three meaningful opportunities have traceable evidence and independently verified calculations.
- Discovery uses explicit object links and does not invent cross-system relationships.
- Graphs, opportunity details, and reports all reference the same completed analysis run.
- An invalid model response or provider outage produces a visible failed/retryable analysis state; a deterministic-only result must be labeled if offered.
- Feedback persists and reloads. Regeneration preserves feedback on stable opportunity identities or marks older records as superseded.
- Estimates label observed inputs, inferred conclusions, and assumed values. No employee leaderboard or employment score is shown.
- The full user journey is verified in a browser at desktop and narrow mobile widths. Domain calculations and evidence integrity have focused automated checks.

Startup validation is separate from hackathon completion. Interviews must establish data-sharing willingness, recommendation usefulness, measurable outcomes, repeat value, vertical focus, and willingness to pay before making commercial claims.
