# AI Productivity Intelligence Platform

*You can't optimize what you can't see.*

An early-stage product for understanding how business work gets done, finding inefficiencies, and recommending practical improvements backed by evidence. The working product name is still TBD.

The initial audience is operations leaders at companies with approximately 30–500 employees, recurring administrative work, multiple business systems, and limited internal AI or process improvement expertise.

## Repository status

This repository currently contains project documentation only. There is no application, generated dataset, dependency setup, or runnable demo yet. Stack choices and delivery milestones below are implementation proposals, not completed capabilities.

The first implementation target is a complete vertical slice:

**Synthetic company data → event ingestion → process map → detected inefficiency → prioritized recommendation → executive report.**

## Documentation

| Document | Purpose |
| --- | --- |
| [Original project brief](docs/project-brief.md) | Full supplied vision, preserved as the source reference |
| [MVP scope and acceptance](docs/mvp.md) | User flow, boundaries, product requirements, and completion gates |
| [Architecture](docs/architecture.md) | Proposed stack, module boundaries, processing lifecycle, and trust controls |
| [Data contracts](docs/data-contracts.md) | Event format, ingestion rules, workflow model, and evidence provenance |
| [Scoring and ROI](docs/scoring-and-roi.md) | Deterministic calculations, ranking, assumptions, and reporting rules |
| [Demo and validation](docs/demo-and-validation.md) | Fictional company, independently checkable scenarios, and demo walkthrough |
| [Implementation roadmap](docs/roadmap.md) | Ordered milestones, dependencies, open decisions, and deferred work |

Read the MVP scope first, then the data contracts and demo plan before implementation. The detailed documents narrow the brief into a proposed hackathon build; they do not replace its broader vision.

## Product principles

- Surface opportunities proactively; the manager should not need to know what to investigate.
- Recommend the simplest effective improvement, including process changes and conventional integrations.
- Show evidence, confidence, and assumptions alongside every recommendation.
- Calculate metrics and ROI in code; use AI for interpretation and explanations.
- Distinguish active human effort from elapsed process time, and recovered capacity from cash savings.
- Use synthetic business data for the demo. Desktop monitoring is outside the MVP.
- Organize the product around **Overview → Process Explorer → Opportunities → Reports**, with opportunities at its center.

## Starting implementation

Follow the [roadmap](docs/roadmap.md) in order. Establish the application toolchain and document its actual install, environment, database, seed, development, and verification commands when milestone 1 is implemented. No setup commands are provided yet because no application tooling exists.

Internal concepts such as cross-company data assets and isolated automation validation belong in the planning documents, not in the initial customer pitch. Commercial pricing, differentiation, and willingness to pay remain hypotheses to validate.
