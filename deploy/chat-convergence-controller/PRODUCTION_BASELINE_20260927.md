# WatanyBot Chat Convergence Production Baseline — 2026-09-27

Status: `GREEN`

Production release:
`/opt/watany/releases/chat-convergence-v1-20260927T133622Z-3635516`

Successful deployment evidence:
`/home/dcagent/watany-staging/chat-convergence-v1/evidence/chat-convergence-v1-20260927T133622Z-3635516`

Successful Apache WebSocket repair evidence:
`/home/dcagent/watany-staging/chat-convergence-v1/apache-ws-community-runs/ws-community-proxy-v1-20260927T133558Z-3625992`

Sealed authorities:
- Controller SHA-256: `35430ac792f2a8c781e0403e2b6b969d473a54be1926265015ed610bd54ad4d3`
- Launcher SHA-256: `fb5411edfd135aa1dcc0e9599d7b007deefcd8b82ca98cf15fd7dbc85f90069c`
- Package manifest SHA-256: `c9c88a5cd5f3b72b5cde5c9b53456af6b35b4f2a10e2aac61ef25790171401c8`
- Overlay manifest SHA-256: `fdc17dab8908fd83d31e045d1279ccaa7ec79e99bf381a1360ec3e6c5380c707`
- V11 ad runtime SHA-256: `a36012be984bd4efca1dc3f228c345cb5850e14acacf06bb243190e4ba1d086b`

Runtime authority:
- `/api/groups` => `404`
- `/api/community/groups` => `200`
- unauthenticated direct endpoints => `401`
- `/health` and `/ready` => `200`
- `wss://koudama.com/ws/community` opens and unauthenticated probe closes with `4001 Missing token`
- `/ops/` and `/ops/users/` remain `200`
