# WatanyBot Gateway Admin Authority Adapter

Phase 1.8 materializes the gateway-side adapter for the superadmin CRM authority foundation.

It is intentionally authority-first:

- denied-by-default route policy registry
- server-side permission pre-handler
- proof routes for 401/403/200 behavior
- mutation proof that creates audit, approval, and version records

The in-memory audit, approval, and versioning writers are proof adapters only. Replace them with real database-backed services before marking any module BUILT.

Do not expose proof routes publicly in production. They are for local PMA/APEX evidence.
