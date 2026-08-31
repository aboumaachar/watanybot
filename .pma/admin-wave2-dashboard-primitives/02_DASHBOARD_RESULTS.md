# Dashboard Results

- Dashboard renders from `/api/admin/overview` and `/api/admin/plugins`.
- Backend-returned zero is rendered as `0`; absent values render `Unavailable`.
- Loading, error, and unavailable states are represented explicitly.
- Shortcut routes remain inside the `/superadmin/` basename.
- No fabricated KPIs, queues, channels, feedback, or playbook actions remain on the canonical home.
- Dashboard panel metadata is recorded in `apps/web-admin/src/dashboardPanelRegistry.ts`.
