# Payload Authority

## Result

```text
PAYLOAD_PROJECT_FOUND=NO
PAYLOAD_COLLECTION_COUNT=0
PAYLOAD_CANONICAL_CONTENT_TYPES=NONE
```

A tracked-source search found no Payload CMS package, `@payloadcms` dependency, Payload config, collection definition, Postgres adapter setup, Payload Admin project, or Payload API exposure. The word `payload` in existing code refers to request/response or JSONB data, not the Payload CMS framework.

## Ownership decision

No audited content type is assigned to Payload. Creating a new Payload project or migrating records into one is outside Wave 4A and is prohibited by this lock. The allowed `PAYLOAD` canonical editor class therefore has a count of zero.

## Non-actions

- Do not scaffold a Payload project.
- Do not change collections or database schemas.
- Do not create a Payload import pipeline.
- Do not add a Payload editor to `apps/web-admin`.
- Do not reinterpret a JSON/JSONL field named `payload` as Payload CMS ownership.

## Transactional exclusion

```text
TRANSACTIONAL_TYPES_IN_PAYLOAD_TARGET=0
```

The following audited or adjacent data remains outside any Payload target: community messages and memberships, document uploads, chat sessions and messages, filter rules, chat input telemetry, abusive-event logs, AI training records, user identity/authentication data, applications, approvals, marketplace transactions, CRM/ERM operational records, and runtime audit logs.

If a future architectural review proposes Payload, it must be a new decision with concrete collection, adapter, lifecycle, migration, and delivery evidence. It cannot reopen this lock implicitly.
