# Audit / Approvals

IMPLEMENTED: AuditPage now sends server-side search/action/limit/offset and consumes authoritative totals with shared table/error/pagination states. Read-only authority audit and approval listing views are wired.

Approval approve/reject/cancel UI uses the existing decision endpoint with native confirmation and refresh-by-removal. Synthetic `users` approval was created, listed, opened, confirmed, approved, and removed from the pending queue. Authority audit side effects `admin.approval.approved` and `admin.users.changed` were observed. The authoritative policy is versioned and the resulting version side effect is PASS.
