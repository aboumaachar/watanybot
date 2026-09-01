# Sessions

IMPLEMENTED: authenticated gateway GET /api/admin/sessions, DELETE /api/admin/sessions/:id, and DELETE /api/admin/users/:id/sessions, plus canonical web-admin Sessions UI with detail, confirmation, revoke-one, and revoke-all. Responses omit token values and mutations write audit_log.

BLOCKED FOR RELEASE: no Sessions page UI or authenticated revoke proof yet.
