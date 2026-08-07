# Guided Navigation Pilot — Browser Smoke Steps

1. Open the app shell and locate the guided navigation entry (or navigate to `/guided-navigation`).
2. Ensure Arabic labels render correctly and layout is RTL.
3. Tap the first choice `المعاش والحقوق` and verify it routes to `/salary` or the intended path.
4. Use `او شي تاني` to reach `تواصل مع الدعم` or `الأسئلة المتكررة`.
5. Verify keyboard navigation and screen-reader labels for the main button.
6. Confirm no console errors appear.
# Watany Guided Navigation Pilot Browser Smoke

## Scope

Pilot routes only:

- `/salary`
- `/procedures`
- `/school-grants`

## Browser Smoke Cases

| ID | Case | Expected |
|---|---|---|
| GNP-001 | Use `WatanyGuidedPilotLink` for `/salary`. | Navigates to `/salary`. |
| GNP-002 | Use `WatanyGuidedPilotLink` for `/procedures`. | Navigates to `/procedures`. |
| GNP-003 | Use `WatanyGuidedPilotLink` for `/school-grants`. | Navigates to `/school-grants`. |
| GNP-004 | Ctrl-click or middle-click a pilot link. | Browser default behavior is preserved. |
| GNP-005 | Try a non-pilot route such as `/marketplace`. | It is not treated as a pilot route. |
| GNP-006 | Inspect app startup. | No global click listener or App wrapper was added. |

## Evidence To Capture

- Route before click.
- Route after click.
- Screenshot of target page.
- Console confirmation that no global interception error exists.