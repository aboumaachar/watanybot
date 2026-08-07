# Circulars Domain Adapter

This folder contains the non-destructive circulars taxonomy and normalization adapter.

APEX constraints:
- Generated from an ASCII-only PowerShell script.
- Arabic strings are represented with JavaScript Unicode escapes.
- Existing records are not deleted.
- Unknown records map to `other` and `needsReview: true`.
- UI pages should consume the adapter instead of embedding taxonomy rules directly.