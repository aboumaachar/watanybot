# Wave 1 Shell

Status: PASS

Canonical owner: `apps/web-admin`

Implemented the desktop-first grouped Superadmin shell, route-aware header and breadcrumbs, active navigation, collapsible sections, persistent compact preference, mobile drawer behavior, Escape/navigation close behavior, visible focus states, and responsive content layout. Existing route composition and feature pages remain unchanged. No database or feature persistence changes were made.

Validation: web-admin typecheck PASS; web-admin build PASS; focused authenticated shell regression PASS at mobile and desktop source mode. The existing audit package was not overwritten.
