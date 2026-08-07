# Watany Guided Help Canonical Adapter Browser Smoke

Check these routes manually:

1. `/salary`
2. `/school-aid`
3. `/school-grants`
4. `/market`
5. `/marketplace`
6. `/profile`
7. `/chat`
8. `/world-cup`
9. `/mcp/world-cup`

Expected alias memory:

- `/school-aid` and `/school-grants` share `schoolGrants`.
- `/market` and `/marketplace` share `marketplace`.
- `/world-cup` and `/mcp/world-cup` share `worldCup`.

Pass criteria:

- No blank popup.
- No duplicate popup for the same feature alias pair.
- Proceed navigates.
- Cancel stays.
- Remind later suppresses temporarily.
- Do not show suppresses permanently.
- Typecheck and lint pass.