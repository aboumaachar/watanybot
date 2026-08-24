# Persistence Gap Report

## Current Boundary

The current CMS document implementation is bound to the proven `public.documents` table. The repository reads and writes only these eight columns:

`id`, `user_id`, `name`, `kind`, `status`, `tags`, `file_path`, `updated_at`

The service validates the proven kind and storage-status values, starts creates as `pending`, maps storage status to the existing CMS lifecycle, and drops unsupported fields such as `slug`.

## Preserved Legacy Path

The existing `/api/documents` route remains backed by the legacy SQLite plugin store. Its extraction-metadata regression passed after the new CMS boundary was introduced. The two persistence paths are intentionally separate.

## Gaps

- No live CMS create or update was issued in this phase, so database write proof remains unexecuted.
- Attachment upload, file delivery, and general file preview are not part of the proven current contract. Preview is returned only for the established runtime upload path pattern.
- Slug, rich content, publication scheduling, and other fields outside the eight-column model are not persisted.
- Adding those fields requires a separately authorized schema and migration phase.
- Browser proof of the new admin workspace was not executed in this source-validation phase.

## Guardrail Result

No schema mutation, data mutation, migration, container lifecycle operation, deployment, commit, push, reset, clean, or checkout was executed. The implementation is source- and test-validated and is ready for the required source changeset freeze gate.
