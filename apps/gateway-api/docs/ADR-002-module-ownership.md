# ADR-002: Module Ownership & Boundaries

| Field       | Value                                     |
|-------------|-------------------------------------------|
| Status      | Accepted                                  |
| Date        | 2026-03-10                                |
| Driver      | ADR-001 extraction created 25+ modules    |

## Module Map

### Foundation layer (no Fastify dependency)
| Module              | Exports                                 | Dependencies       |
|---------------------|-----------------------------------------|--------------------|
| `types/domain.ts`   | All domain types, role constants        | none               |
| `lib/config.ts`     | Env-var getters, path resolvers         | node:path, node:fs |
| `data/seed-data.ts` | Mock/seed data arrays                   | none               |
| `lib/helpers.ts`    | makeId, normalizeText, requireAuth, mappers | types/domain   |

### Service layer (stateful, no routes)
| Module                    | Exports                               | Dependencies          |
|---------------------------|---------------------------------------|-----------------------|
| `db/plugin-db.ts`         | initPluginDb(), createInMemoryPluginDb | better-sqlite3, seed-data |
| `lib/intent-classifier.ts`| classifySmallTalk(), load/get/set      | node:fs               |
| `lib/emotional.ts`        | computeEmotionalScore(), EMPATHY_*     | none                  |
| `lib/versioning.ts`       | createVersioningService()              | node:fs               |
| `lib/unrecognized.ts`     | logUnrecognizedInput(), clarify resp   | node:fs               |
| `lib/chat-service.ts`     | createChatService() factory            | undici, ai/, kb/      |
| `lib/voice-e2e.ts`        | createVoiceE2EService() factory        | node:fs, nodemailer   |

### Route layer (Fastify plugins)
| Module                     | Endpoints                          | Options/Deps        |
|----------------------------|------------------------------------|---------------------|
| `routes/profile.ts`        | GET/PATCH /api/profile, POST login | pluginDb            |
| `routes/history.ts`        | GET/POST /api/history              | pluginDb            |
| `routes/chat-sessions.ts`  | CRUD /api/chat-sessions            | pluginDb            |
| `routes/notifications.ts`  | CRUD /api/notifications            | pluginDb            |
| `routes/saved-chats.ts`    | CRUD /api/saved                    | pluginDb            |
| `routes/plugins.ts`        | /api/plugins/*, /api/admin/plugins | pluginDb            |
| `routes/ticker.ts`         | GET /api/ticker                    | pluginDb            |
| `routes/tx.ts`             | GET /api/tx/search, /api/tx/:id    | mockTx, mockDetail  |
| `routes/forms-inline.ts`   | GET /api/forms, POST /api/forms/*  | forms-catalog fns   |
| `routes/salary-inline.ts`  | GET /api/salary/*, POST /api/salary/calc | getKb()        |
| `routes/kb-v2-proxy.ts`    | 8 /api/v2/* proxy routes           | getPythonBase()     |
| `routes/kb-vnext.ts`       | 3 /api/kb-nodes/* routes           | kb-nodes fns        |
| `routes/admin-overview.ts` | GET /api/admin/overview             | health check deps   |
| `routes/chat.ts`           | POST /api/chat, /api/chat/stream   | chat service + deps |

### Pre-existing modules (unchanged)
18 route files, auth/, ai/, ws/, kb/, debug/, filters/, integrations/, procedures/, jobs/, disaster/

## Dependency Rules

1. **Foundation → nothing** (types, config, seed data)
2. **Service → Foundation only** (never import route modules)
3. **Routes → Services + Foundation** (via constructor options, not direct imports)
4. **server.ts → everything** (bootstrap wiring only)
