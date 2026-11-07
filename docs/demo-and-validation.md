# Demo and validation plan

## Fictional scenario

Use **Demo Commerce**, a fictional e-commerce company with approximately 60 employees. The fixture needs only a representative operations subset: six pseudonymous actors across order operations, support, and finance, using a storefront, ERP, help desk, spreadsheet, and accounting system.

Use a fixed random seed, fixed October 2026 observation window, stable IDs, and UTC timestamps. No real customer, employee, payment, or credential data is required. The dataset and generator are planned; neither exists yet.

## Planned workflows and ground truth

| Workflow | Planned sequence | Checkable inefficiency |
| --- | --- | --- |
| Order handling: 600 instances | Storefront order received → human ERP re-entry → ERP confirmation | 120,000 ms of human re-entry per instance, totaling 20 h |
| Returns: 300 instances | Help desk request received → human classification → routing → response | 240,000 ms of classification per instance, totaling 20 h |
| Invoice reconciliation: 200 instances | Accounting invoice received → human spreadsheet matching → reconciliation complete | 360,000 ms of manual matching per instance, totaling 20 h |

Give other steps their own measured or unknown effort and retain those values in workflow totals. Opportunity baselines select only the targeted step, so whole-process effort must not replace the 20-hour segment baselines.

Add deterministic variants and exception markers without altering these target counts/durations. Include long elapsed handoff gaps and automated events to demonstrate that waiting and machine time are not counted as human effort. Keep synthetic human work nonoverlapping per actor. Use explicit object IDs across systems.

Store expected case counts, target event IDs, baseline totals, variant membership, and planted issues in an independent ground-truth file used only by verification. The importer and analyzer must not read planted issue labels or expected recommendations. Derive the expected values independently rather than copying analysis output into the oracle.

Export equivalent CSV and JSON event sets. Keep invalid-row, duplicate, conflict, missing-duration, tied-timestamp, and cross-organization cases in separate validation fixtures so the canonical demo remains predictable.

## Walkthrough

1. Reset the fictional organization's demo state and import the versioned export.
2. Show import coverage and start analysis; select the resulting completed run.
3. Open the order workflow and inspect the recurring storefront-to-ERP sequence.
4. Open the opportunity feed: integration, return triage, and reconciliation matching should rank in that order under the documented assumptions.
5. Inspect the integration opportunity: 600 supporting re-entry events, 20 baseline hours, 16 net recoverable hours, and score 83.
6. Open supporting event rows and the explicit calculation. Show confidence and assumptions without implying the integration has been implemented.
7. Confirm the workflow and accept or dismiss a recommendation; reload to demonstrate persistence.
8. Open the executive report with three priorities, source coverage, limitations, and 38 estimated recoverable hours for the disjoint monthly scenario.

The moment to demonstrate is an opportunity surfaced from events without the manager asking what to automate. An integration should be recommended where it is more practical than an AI agent.

## Verification plan

Once implementation exists, use focused domain/backend checks for:

- CSV/JSON normalization equivalence, validation reasons, idempotent replay, and conflicting event identities.
- Object-based grouping, stable variants, missing endpoints, timestamp ties, exception counts, and separation of elapsed and active time.
- Ground-truth case counts and the three independently calculated 20-hour target baselines.
- ROI examples, missing/zero inputs, score boundaries, deterministic tie breaking, and overlapping-evidence exclusion.
- Rejection of fabricated, wrong-run, or cross-organization evidence references and invalid model output.
- Analysis failure/retry behavior and immutable completed snapshots.

Use browser verification for the complete import-to-report flow, persisted feedback, evidence navigation, loading/error states, and desktop/narrow-screen layouts. Do not add frontend tests. Run the actual repository's formatting, lint, type, and build checks once those tools exist; document commands and results at that point.

Run the live LLM path at least once with valid server-side credentials. For repeatable domain checks, use clearly identified recorded provider responses or a stub adapter. Such checks do not prove that a live model call succeeded. Model wording can vary; authoritative arithmetic, evidence references, and ranking cannot.

## Reporting limitations

The executive report must state that the organization and observations are synthetic. Assumed removability, future review load, feasibility, implementation effort, and costs are illustrative. The MVP does not prove causal savings, arbitrary workflow discovery, customer demand, or production privacy/security readiness.
