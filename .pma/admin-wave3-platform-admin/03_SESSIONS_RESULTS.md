# Sessions

IMPLEMENTED: authenticated gateway GET /api/admin/sessions, DELETE /api/admin/sessions/:id, and DELETE /api/admin/users/:id/sessions, plus canonical web-admin Sessions UI with detail, confirmation, revoke-one, and revoke-all. Responses omit token values and mutations write audit_log.

SESSIONS_UI=PASS
SESSION_DETAIL=PASS
SESSION_REVOKE_ONE=PASS
SESSION_REVOKE_ONE_AUDIT=PASS
SESSION_REVOKE_ALL_USER=PASS
SESSION_REVOKE_ALL_AUDIT=PASS
SESSION_TOKEN_VALUES_EXPOSED=NO

Authenticated disposable-runtime proof confirmed one target session was revoked while a sibling session was preserved; revoke-all removed the target user's sessions while unrelated sessions were preserved. Audit events were generated for both operations. 
