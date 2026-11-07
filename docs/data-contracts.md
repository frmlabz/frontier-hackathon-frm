# Data contracts

These are proposed implementation contracts. No parser, schema, or database exists yet.

## Activity event v1

Accept a UTF-8 CSV with the following column names or a JSON array of objects with the same fields. Durations are integer milliseconds; timestamps are ISO 8601 with an explicit UTC offset and normalize to UTC. CSV empty optional values normalize to null; JSON may use null or omit optional fields.

| Field | Required | Meaning |
| --- | --- | --- |
| `schema_version` | Yes | `1` |
| `event_id` | Yes | Stable event ID within its data source |
| `data_source_id` | Yes | Registered source in the selected organization |
| `actor_id` | Yes | Pseudonymous actor; a service actor is valid |
| `application` | Yes | Stable system identifier, such as `erp` |
| `activity` | Yes | Canonical action name, such as `order.entered` |
| `business_object_type` | Yes | For example `order`, `return`, or `invoice` |
| `business_object_id` | Yes | Explicit case correlation key within the organization and object type |
| `occurred_at` | Yes | Action start or observation timestamp |
| `completed_at` | No | Completion timestamp, if measured |
| `active_duration_ms` | No | Measured human touch time; null means unknown, zero means measured zero |
| `effort_kind` | Yes | `human`, `automated`, or `unknown` |
| `outcome` | No | `success`, `exception`, or `unknown` |

```json
[
  {
    "schema_version": 1,
    "event_id": "evt-order-001-erp-entry",
    "data_source_id": "demo-export",
    "actor_id": "actor-ops-01",
    "application": "erp",
    "activity": "order.entered",
    "business_object_type": "order",
    "business_object_id": "order-001",
    "occurred_at": "2026-10-05T09:00:00Z",
    "completed_at": "2026-10-05T09:02:00Z",
    "active_duration_ms": 120000,
    "effort_kind": "human",
    "outcome": "success"
  }
]
```

Organization identity comes from the authorized import context, not a trusted value in the upload. The importer attaches `organization_id`, `import_id`, `source_row_number`, `ingested_at`, and a normalized payload hash. Preserve the raw upload and its checksum separately under the same organization scope and retention policy.

## Import behavior

- Validate source membership, required fields, enums, timestamp offsets, nonnegative durations, and completion at or after occurrence. Where both endpoints exist, active duration cannot exceed elapsed duration.
- Reject ambiguous timestamps and malformed records. Return row-level reasons and accepted/rejected/duplicate/conflict totals. Valid rows may be imported; show that coverage is partial. Discovery operates only on accepted rows.
- Use `(organization_id, data_source_id, event_id)` for idempotency. An identical replay is a no-op. A changed payload under the same identity is a conflict; do not silently overwrite evidence.
- Record configured upload size and row limits, including useful errors. Final limits belong in the implemented setup docs.
- Do not infer a shared order, invoice, or ticket from similar names or nearby timestamps. Cross-source exports must supply a consistent canonical object key or an explicit validated mapping.
- Preserve unknown active effort as missing. Never convert elapsed waiting time to human effort or null to zero.

## Workflow reconstruction

For the MVP, group by `(organization_id, business_object_type, business_object_id)`. One object is one workflow instance; order events by `occurred_at`, then source/event identity for stable rendering. Timestamp ties do not establish causal order. Preserve that ambiguity in interpretation.

A step signature is `(application, activity)`. Group recurring step signatures into variants within each object type and build graph edges from observed adjacency. Keep instance/event memberships so every node, edge, variant, and metric is traceable. Repeated steps remain visible. This approach assumes one lifecycle per object; repeated independent lifecycles require a supplied lifecycle key before extending discovery.

Calculate:

- **Frequency:** distinct instances within the stated observation window.
- **Elapsed duration:** latest known completion (or occurrence if completion is absent) minus earliest occurrence, labeled with endpoint coverage.
- **Human active effort:** sum of measured human durations, with coverage counts. Unknown durations and automated actions do not contribute to measured human effort.
- **Transition gap:** next start minus previous completion when both endpoints are available; otherwise unknown. Overlaps are concurrency, not negative waiting time.
- **Variants and exceptions:** sequence membership and explicit exception outcomes, with denominators.

Summed event effort represents person-time. Overlapping events for the same actor can double-count effort; flag and exclude ambiguous overlaps from savings calculations until resolved. Do not claim every elapsed gap is a removable bottleneck. The fictional fixture uses sequential, nonoverlapping human work.

## Persistent entities and relationships

| Entity | Minimum responsibility |
| --- | --- |
| Organization, Department, Actor | Scope and pseudonymous process participants; department optional in MVP |
| DataSource, Import | Source identity, upload checksum, normalization version, validation summary |
| ActivityEvent, BusinessObject | Immutable accepted observations and explicit case links |
| AnalysisRun | Frozen input membership, versions, stage, outcome, and timestamps |
| Workflow, WorkflowStep, WorkflowInstance | Discovered structures, variants, constituent event IDs, review state |
| WorkflowMetric | Value, unit, window, denominator, coverage, calculation version, evidence membership |
| Opportunity, Recommendation | Stable issue identity, proposed change, feasibility, confidence, review status, run version |
| EvidenceReference | Organization/run-scoped links to events, instances, or metrics |
| ROIEstimate | Inputs, units, assumption sources, formula version, range, calculated outputs |
| Feedback | Target identity/version, confirmation/dismissal/correction, reason, timestamp |
| ImplementationOutcome | Future measured outcomes, separate from estimates; not needed for the initial demo |

An opportunity describes the issue; its recommendation describes a proposed remedy. A stable issue key derived from workflow identity and detection rule supports deduplication and feedback continuity. A new analysis creates a version of the finding, not a second independent savings claim for the same work.

## Evidence and confidence

Every opportunity must link to at least one measured metric and its supporting events or instances. Record `observed`, `inferred`, or `assumed` on inputs/claims, plus source, unit, window, and derivation where relevant. Derived deterministic metrics remain distinct from AI interpretations.

The model may cite only evidence supplied to that run. Reject unknown IDs, evidence from another organization/run, and unsupported numerical claims. Store a sample for readable inspection and full membership for recomputation; a sample alone is not the calculation denominator.

Confidence is a separate qualitative assessment (`low`, `medium`, `high`) with reasons covering data completeness, case-link reliability, and inference strength. It is not an accuracy probability. Synthetic ground truth validates the pipeline; it does not establish real-world recommendation accuracy.
