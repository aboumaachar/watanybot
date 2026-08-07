# WatanyBot Mobile OS Architecture Contract

## Shell Ownership

`WatanyMobileShell` is the visual shell owner for citizen/user routes.

## App Boundary

`App.tsx` owns application bootstrap and router provider only.

`AppShell.tsx` owns route declaration and should not become an independent visual dashboard shell.

## User Route Rule

Citizen-facing pages must render as content modules inside `WatanyMobileShell`.

## Exclusions

Auth pages and superadmin/admin pages are intentionally excluded from the citizen Mobile OS shell unless a separate admin shell is created.

## Chat Rule

Chat components keep WhatsApp behavior, scroll, composer, and message logic. Chat surfaces may visually integrate with Mobile OS but must not be mass-rewritten with generic page wrappers.

## Navigation Rule

Only one citizen navigation system should be visible at a time:
- Mobile OS topbar/dock/drawer, or
- route-local functional controls

Legacy global nav components must become content-level or be retired after visual QA.
