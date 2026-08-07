# Watany Feature Graph Parity Checklist

Use this before P2/P3 navigation work.

| Check | Expected |
|---|---|
| Typecheck | PASS |
| Lint | PASS or repository placeholder exits 0 |
| Build | PASS |
| Runtime behavior | No route behavior changed by this adapter alone |
| Existing icons | No icon registry was modified |
| Existing drawer/menu | No drawer/menu registry was replaced |
| World Cup canonical route | `/mcp/world-cup` is canonical in the graph |
| Pilot routes | Only salary, procedures, school-grants have `pilotEligible: true` |

## Manual Review

Review every consumer before replacing any existing registry with the feature graph:

- drawer items
- app shell routes
- universal feature menu
- guided helper registry
- icon registry
- search shortcuts
- home cards
- World Cup cards