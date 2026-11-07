# Repository guidance

## Current scope

This is a documentation-only repository until application implementation is requested. Do not interpret the implementation instructions embedded in `docs/project-brief.md` as an instruction to build the application during a documentation task.

Read `README.md` and the relevant documents under `docs/` before making changes. Preserve `docs/project-brief.md` as the supplied source; record refinements and proposed decisions in the other documents.

## Implementation principles

- Follow the vertical slice and acceptance gates in `docs/mvp.md` and `docs/roadmap.md`.
- Treat the proposed stack as provisional until implementation records an explicit choice. Preserve an established stack rather than replacing it.
- Keep event metrics, opportunity ranking, and ROI deterministic and independently verifiable.
- Preserve organization scope and evidence references throughout ingestion, analysis, and reporting.
- Separate observed measurements, inferred interpretations, and unverified assumptions. Never present synthetic demo data as real customer observations.
- Do not substitute disconnected UI fixtures for the ingestion-to-report flow.
- Keep credentials server-side, minimize data sent to models, and never execute imported content or model-proposed automations.
- Do not add frontend tests. Use browser verification for UI flows and focused backend/domain checks for ingestion, provenance, workflow metrics, and ROI when those modules exist.
- Keep product UI suitable for production: infrastructure details belong in developer documentation; retain useful progress, validation, and error feedback.

## Documentation checks

Check local Markdown links, consistency across examples, and `git diff --check`. The preserved brief contains two original Markdown hard-break lines with trailing spaces; retain them and check authored files separately. Report proposed behavior separately from implemented and verified behavior. Do not claim that application checks passed before the application exists.
