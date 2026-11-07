# Implementation roadmap

All implementation milestones are pending. The current deliverable is the documentation set and preserved project brief.

## Milestones in dependency order

| Milestone | Deliverable | Exit evidence |
| --- | --- | --- |
| 1. Application foundation | Confirm stack; scaffold app, database/migrations, server configuration, and domain modules | Clean install/start instructions, environment template without secrets, database setup, existing lint/type/build checks pass |
| 2. Event contract and synthetic company | Implement event validation, fixture generator, CSV/JSON exports, independent ground truth | Fixed-seed repeatability; known case counts, target durations, and privacy-safe content |
| 3. Import and discovery | Persist imports/events, idempotency, object-based instances, variants, metrics | Fixture metrics match independent truth; row errors and provenance inspectable |
| 4. First complete vertical slice | One discovered order workflow → candidate → live LLM explanation → validated evidence → ROI/rank → basic opportunity and report views | Browser can follow an imported event through to its generated recommendation and report |
| 5. Three-opportunity MVP | Returns and reconciliation analysis, ranking, overlap handling, full graph/detail/report UI | Three opportunities with expected baselines, scores, and assumptions; no disconnected UI fixtures |
| 6. Review and resilience | Persisted feedback, stable identities, failed-run/retry behavior, empty/error states | Reload retains review state; provider failure is actionable; completed runs remain coherent |
| 7. Demo readiness | Responsive polish, deterministic reset, setup/troubleshooting docs, complete verification | Clean-environment reproduction and browser walkthrough meet every MVP completion gate |

Milestone 4 is deliberately narrow: complete the first working chain before expanding the dashboard or adding more integrations. Domain checks should accompany each module rather than being postponed to the final milestone.

## Decisions to confirm during implementation

- **Stack:** Next.js/TypeScript/PostgreSQL/Drizzle is the proposed default; record the selected versions, package manager, and rationale once scaffolded.
- **AI provider:** select one provider/model for the live demo behind an adapter; document required environment variables, data handling, cost limits, and retry policy.
- **Execution:** choose a local bounded runner for the demo or a durable worker based on actual runtime/deployment limits.
- **Demo access:** decide whether the hackathon uses local execution or a private hosted environment. Authentication and access restrictions must match any hosting exposure.
- **Import limits and retention:** set concrete limits and deletion/reset behavior; real customer data needs a separate approved policy before onboarding.
- **Assumptions:** review illustrative ranking weights, feasibility, removability, costs, and review-load inputs. Record changes with a version and update expected results together.

Working product name, initial commercial vertical, pricing, and willingness to pay remain open. E-commerce is a proposed demonstration choice, not a validated market selection. Competitors named in the brief are research leads; no current competitive claims have been verified.

## After the hackathon

Validate the product with operations leaders before expanding scope. Test whether exports produce useful insight without monitoring, whether companies can provide sufficiently linked events, and whether recommendations lead to measurable outcomes and recurring value.

Possible later work includes read-only connectors, guided voluntary capture, stronger process correction, implementation outcome tracking, and production multi-tenant controls. Desktop observation, autonomous prototypes or deployment, workflow security, and cross-company benchmarks require separate product decisions and safeguards.

Secondary data products and isolated automation-validation concepts remain internal strategy topics. Any aggregation or secondary use requires explicit rights and privacy protections; raw customer or employee activity is not a freely resellable asset. These concepts do not belong in the initial public pitch.
