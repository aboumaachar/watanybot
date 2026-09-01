# Users / Access

IMPLEMENTED: server-side search, role/status query parameters, page size/offset, authoritative total count, URL-backed filters/page, safe confirmation for role/status actions, visible mutation errors, detail drawer, and administrator-focused route reusing UsersPage.

PROVEN: authenticated mutation Playwright, disposable fixture database, and last-admin/self-protection guards. `user.status_change` records in authoritative `audit_log` include target `10000000-0000-0000-0000-000000000004` transitions to `suspended` and `active`; final target state is `active`.
