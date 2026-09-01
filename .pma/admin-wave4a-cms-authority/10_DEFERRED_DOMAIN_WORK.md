# Deferred Domain Work

These rows are intentionally outside editorial CMS completion. Deferral is an ownership decision, not an unmapped gap.

| Content type | Why it is deferred | Current owner to preserve | Future decision needed |
| --- | --- | --- | --- |
| Community | User-generated groups, messages, memberships, reports, moderation, and attachments are application data | Gateway PostgreSQL community service/routes | Operational retention, moderation history, and analytics only |
| AI training | Reviewable training examples and exports are internal model operations, not public editorial records | Gateway admin AI routes and configured JSONL | Define dataset governance, retention, provider handoff, and record history |
| Abusive events | Append-only moderation/telemetry events with no editorial lifecycle | Chat logger and internal admin API | Define retention, dismissal, purge, and audit policy |
| Chat inputs | Raw user input telemetry and question clusters support analytics/training | Chat logger and internal admin API | Define privacy, retention, and anonymization policy |
| Chat sessions | Runtime support sessions and messages have application state, not CMS publication | Gateway session route/store | Define access, retention, and moderation audit policy |
| Filter rules | Runtime moderation policy with enabled state and regex/action semantics | PostgreSQL `filter_rules` and admin rules route | Define rule versioning and rollback in an operational policy plane |
| ERM assets | Audit label has no implementation evidence and cannot identify a real content domain | None proven | Resolve the exact domain, source, persistence, editor, and delivery before any build |

Source-backed canonical Documents are no longer deferred: they are assigned to the external Payload collection with Gateway delivery/convergence work. Gateway operational document uploads remain excluded from that target because their UUID, storage, verification, and retention semantics are separate.

## Explicit exclusions

Gateway operational document uploads, users, authentication sessions, applications, approvals, marketplace transactions, job applications, CRM/ERM operational records, and runtime audit logs remain outside Payload and outside generic editorial CMS completion unless a separate architecture decision proves otherwise.

## Wave 4B stop condition

Do not convert any deferred row into a CMS record solely because a Web Admin list or status endpoint exists. A new authority decision is required if the domain becomes editorial, including a canonical ID, revision owner, publication/archive model, provenance, and delivery contract.
