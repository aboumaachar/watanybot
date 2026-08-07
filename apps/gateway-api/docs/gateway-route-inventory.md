# Gateway Route Inventory

> Generated: 2026-05-10  
> Source: `apps/gateway-api/src/server.ts` (4,726 lines) + individual route files under `src/routes/`  
> Purpose: document every route family to guide the gateway decomposition plan.

---

## Summary

| Family | File | Routes | Auth |
|--------|------|--------|------|
| Diagnostics / Health | diagnostics.ts | 4 | None |
| Auth | auth (server.ts) | (see authRoutes) | JWT |
| Chat | chat.ts | streaming SSE | JWT |
| Salary | salary-inline.ts | 3 | None |
| KB v2 Proxy | kb-v2-proxy.ts | 7 | None |
| KB vNext (nodes) | kb-vnext.ts | 3 | None |
| KB Attachments | server.ts (inline) | 1 | None |
| Voice | voice.ts | 1+ | None |
| Voice E2E | voiceE2ERoutes | 1 | None |
| Voice Advanced | voiceAdvancedRoutes | - | - |
| MCP | mcp.ts | 3 | None |
| Elite | elite.ts | 8 | JWT |
| Advanced / v2 misc | advanced.ts | 5 | None |
| Profile | profile.ts | 3+ | JWT |
| History | history.ts | 1 | JWT |
| Chat Sessions | chat-sessions.ts | 1+ | JWT |
| Saved Chats | saved-chats.ts | 1 | JWT |
| Notifications | notifications.ts | 3 | JWT |
| Plugins | plugins.ts | 5 | Mixed |
| Forms | forms-inline.ts | 1 | None |
| Files / Documents | files.ts | 1 | None |
| FAQ | faq.ts | 1 | None |
| Ticker | ticker.ts | 1 | None |
| TX (mock) | tx.ts | 1 | None |
| Unified Search | unified-search.ts | 3 | None |
| Groups | groups.ts | 1 | None |
| Cases | cases.ts | 1 | JWT |
| Documents | documents.ts | 1 | JWT |
| Jobs | jobsRoutes | - | - |
| Disaster | disasterRoutes | - | - |
| Procedures | proceduresRoutes | - | - |
| Admin: Overview | admin-overview.ts | 1 | admin |
| Admin: AI | admin-ai.ts | 12 | admin |
| Admin: AI Runtime | admin-ai-runtime.ts | 3 | admin |
| Admin: AI Config | server.ts (inline) | 1 | admin |
| Admin: KB | admin-kb.ts | 19 | admin |
| Admin: KB Studio | admin-kb-studio.ts | 11 | admin |
| Admin: Rules | admin-rules.ts | 4 | admin |
| Admin: Users | admin-users.ts | 8 | admin |
| Admin: Ticker | admin-ticker.ts | 4 | admin |
| Admin: Dashboard | admin-dashboard.ts | 16 | admin |
| Admin: Features | admin-features.ts | 2 | admin |
| Admin: Web-User Settings | admin-web-user-settings.ts | 3 | admin |
| Admin: Payments | adminPaymentsRoutes | - | admin |
| Admin: Python probe | server.ts (inline) | 1 | admin |
| WebSocket: chat | adminWSRoutes | - | JWT |
| WebSocket: features | featuresWSRoutes | - | JWT |
| WebSocket: media | mediaWSRoutes | - | JWT |

---

## Route Details by Family

### Diagnostics / Health (`diagnostics.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check — returns `{ status: "ok" }` |
| GET | `/ready` | Readiness probe — checks KB + DB |
| GET | `/metrics` | Prometheus-style metrics |
| GET | `/` | Root welcome response |

---

### KB Attachments (inline `server.ts:277`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/kb/attachments/*` | Serve static KB attachment files |

---

### Salary (`salary-inline.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/salary` | Salary lookup (query params) |
| GET | `/api/salary/meta` | Salary metadata (tiers, categories) |
| POST | `/api/salary/calc` | Compute pension/salary (v4 calculator) |

---

### KB v2 Proxy (`kb-v2-proxy.ts`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v2/chat` | Chat completion via Python KB v2 |
| GET | `/api/v2/search` | RAG search via Python KB v2 |
| POST | `/api/v2/intent` | Intent detection |
| POST | `/api/v2/salary/compute` | Salary compute proxy |
| POST | `/api/v2/tickets` | Create ticket |
| GET | `/api/v2/tickets` | List tickets |
| GET | `/api/v2/diagnostics` | Python backend diagnostics |

---

### KB vNext / Nodes (`kb-vnext.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/kb-nodes/search` | Full-text + vector search over law nodes |
| GET | `/api/kb-nodes/stats` | Node counts, build metadata |
| GET | `/api/kb-nodes/list` | Paginated node listing |

---

### Voice (`voice.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/voice/health` | Voice service health |
| (more) | | TTS synthesis, cache warm-up (see voice.ts) |

---

### MCP (`mcp.ts`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/mcp` | MCP tool call (SSE stream) |
| GET | `/mcp` | SSE subscription |
| DELETE | `/mcp` | Close MCP session |

---

### Elite (`elite.ts`) — prefix `/api/elite`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/elite/profile` | Upsert user profile |
| GET | `/api/elite/profile/:userId` | Get user profile |
| POST | `/api/elite/feedback` | Submit feedback |
| GET | `/api/elite/feedback/stats` | Feedback statistics |
| POST | `/api/elite/interaction` | Log interaction |
| GET | `/api/elite/analytics` | User analytics |
| GET | `/api/elite/health-resources` | Crisis / mental health resources |
| POST | `/api/elite/crisis-report` | Report crisis event |

---

### Advanced / v2 Misc (`advanced.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v2/feedback/stats` | Feedback aggregate stats |
| GET | `/api/v2/kb/gaps` | KB gap analysis |
| GET | `/api/v2/kb/improvements` | KB improvement suggestions |
| GET | `/api/v2/analytics/summary` | Analytics summary |
| GET | `/api/v2/system/info` | System info |

---

### Profile (`profile.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/profile` | Get current user profile |
| POST | `/api/profile/logout` | Logout |
| (more) | | Profile updates, preference sync |

---

### History (`history.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/history` | Chat history for current user |

---

### Chat Sessions (`chat-sessions.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chat-sessions` | List chat sessions |

---

### Saved Chats (`saved-chats.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/saved` | List saved chat messages |

---

### Notifications (`notifications.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | List notifications |
| (PATCH/PUT) | `/api/notifications/:id` | Mark read |
| POST | `/api/notifications/clear` | Clear all notifications |

---

### Plugins (`plugins.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/plugins/jobs` | Job listings |
| GET | `/api/plugins/marketplace` | Marketplace listings |
| GET | `/api/plugins/emergency` | Emergency resources |
| GET | `/api/admin/plugins` | Admin plugin overview |

---

### Forms (`forms-inline.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/forms` | Forms catalog (with intent detection) |

---

### Files (`files.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v2/files` | File listing with procedure relations |

---

### FAQ (`faq.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v2/faq` | Frequently asked questions |

---

### Ticker (`ticker.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ticker` | Ticker items (news/announcements) |

---

### TX / Transactions (`tx.ts` — mock data)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tx/search` | Transaction search (mock) |

---

### Unified Search (`unified-search.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/search/unified` | Cross-resource unified search |
| GET | `/api/cache/stats` | Search cache statistics |
| POST | `/api/cache/clear` | Clear search cache |

---

### Groups (`groups.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/groups` | List groups |

---

### Cases (`cases.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cases` | List user cases |

---

### Documents (`documents.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/documents` | List user documents |

---

### Admin: Python Probe (inline `server.ts:367`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/python/probe` | Probe Python backend health |

---

### Admin: Overview (`admin-overview.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/overview` | High-level admin overview stats |

---

### Admin: AI Training (`admin-ai.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/ai/training` | List training items |
| POST | `/api/admin/ai/training` | Add training item |
| POST | `/api/admin/ai/training/:id/approve` | Approve item |
| POST | `/api/admin/ai/training/:id/reject` | Reject item |
| DELETE | `/api/admin/ai/training/:id` | Delete item |
| POST | `/api/admin/ai/training/import-feedback` | Import feedback as training data |
| GET | `/api/admin/ai/training/export` | Export training data |
| POST | `/api/admin/ai/training/publish` | Publish training dataset |
| POST | `/api/admin/ai/fine-tune` | Trigger fine-tune job |
| GET | `/api/admin/ai/feedback-queue` | Feedback queue |
| GET | `/api/admin/ai/feedback/:id` | Single feedback item |
| POST | `/api/admin/ai/feedback` | Submit feedback |
| POST | `/api/admin/ai/feedback/:id/approve` | Approve feedback |
| POST | `/api/admin/ai/feedback/:id/reject` | Reject feedback |
| DELETE | `/api/admin/ai/feedback/:id` | Delete feedback |

---

### Admin: AI Runtime (`admin-ai-runtime.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/ai-config` | Get AI runtime config |
| POST | `/api/admin/ai-config` | Update AI runtime config |
| POST | `/api/admin/ai/rebuild` | Trigger KB rebuild |

---

### Admin: KB (`admin-kb.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/kb` | KB entries listing |
| GET | `/api/admin/kb/rules` | KB rules |
| PATCH | `/api/admin/kb/rules` | Update KB rules |
| GET | `/api/admin/kb/salary-entries` | Salary entries |
| GET | `/api/admin/kb/salary-entry/:key` | Single salary entry |
| PATCH | `/api/admin/kb/salary-entry/:key` | Update salary entry |
| POST | `/api/admin/kb/save` | Persist KB edits |
| POST | `/api/admin/kb/reload` | Reload KB from disk |
| GET | `/api/admin/kb/runtime` | Runtime KB state |
| POST | `/api/admin/kb/runtime-reload` | Hot-reload KB runtime |
| POST | `/api/admin/kb/runtime-save` | Save runtime KB state |
| POST | `/api/admin/kb/recalculate` | Recalculate derived KB fields |
| GET | `/api/admin/kb/versions` | KB version history |
| POST | `/api/admin/kb/versions/rollback` | Rollback KB to version |
| GET | `/api/admin/kb/chunks` | RAG chunk listing |
| GET | `/api/admin/kb/chunk/:id` | Single RAG chunk |
| PATCH | `/api/admin/kb/chunk/:id` | Update RAG chunk |
| POST | `/api/admin/kb/chunks/save` | Save chunk edits |
| POST | `/api/admin/kb/chunks/reload` | Reload chunks from disk |

---

### Admin: KB Studio (`admin-kb-studio.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/kb-studio/sources` | List KB sources |
| POST | `/api/admin/kb-studio/sources/folder` | Add folder source |
| DELETE | `/api/admin/kb-studio/sources/folder` | Remove folder source |
| POST | `/api/admin/kb-studio/sources/url` | Add URL source |
| DELETE | `/api/admin/kb-studio/sources/url` | Remove URL source |
| GET | `/api/admin/kb-studio/manifest` | KB manifest |
| GET | `/api/admin/kb-studio/reports` | Build reports |
| POST | `/api/admin/kb-studio/scan` | Scan sources |
| POST | `/api/admin/kb-studio/ingest` | Ingest sources |
| POST | `/api/admin/kb-studio/export` | Export KB |
| POST | `/api/admin/kb-studio/rebuild` | Full KB rebuild |

---

### Admin: Rules (`admin-rules.ts`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/rules` | admin | List rules |
| POST | `/api/admin/rules` | admin | Create rule |
| PUT | `/api/admin/rules/:id` | admin | Update rule |
| DELETE | `/api/admin/rules/:id` | admin | Delete rule |

---

### Admin: Users (`admin-users.ts`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/users` | admin | List users |
| PUT | `/api/admin/users/:id/role` | admin | Change user role |
| PUT | `/api/admin/users/:id/status` | admin | Change user status |
| GET | `/api/admin/audit` | admin | Audit log |
| GET | `/api/admin/chat-sessions` | admin | All chat sessions |
| GET | `/api/admin/chat-sessions/:id/messages` | admin | Session messages |
| POST | `/api/admin/chat-messages/:id/flag` | moderator | Flag message |
| GET | `/api/admin/kpis` | admin | KPI dashboard |

---

### Admin: Ticker (`admin-ticker.ts`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/ticker/items` | admin | List ticker items |
| POST | `/api/admin/ticker/items` | admin | Create ticker item |
| DELETE | `/api/admin/ticker/items/:id` | admin | Delete ticker item |
| POST | `/api/admin/ticker/recompute-faq` | admin | Recompute FAQ from ticker |

---

### Admin: Dashboard (`admin-dashboard.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/dashboard` | Main dashboard stats |
| GET | `/api/admin/analytics/sessions` | Session analytics |
| GET | `/api/admin/analytics/sessions/:sessionId` | Single session analytics |
| GET | `/api/admin/experiments` | A/B experiments list |
| POST | `/api/admin/experiments` | Create experiment |
| GET | `/api/admin/experiments/:experimentId` | Get experiment |
| POST | `/api/admin/experiments/:experimentId/start` | Start experiment |
| POST | `/api/admin/experiments/:experimentId/pause` | Pause experiment |
| POST | `/api/admin/experiments/:experimentId/complete` | Complete experiment |
| GET | `/api/admin/kb/health` | KB health (dashboard) |
| GET | `/api/admin/kb/gaps` | KB gaps |
| GET | `/api/admin/kb/auto-faqs` | Auto-generated FAQs |
| GET | `/api/admin/feedback/stats` | Feedback stats |
| GET | `/api/admin/system/status` | System status |
| POST | `/api/admin/system/cleanup` | System cleanup |

---

### Admin: Features (`admin-features.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/features` | Feature flag listing |
| PUT | `/api/admin/features` | Update feature flags |

---

### Admin: Web-User Settings (`admin-web-user-settings.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/web-user/settings` | Get web-user settings (public) |
| GET | `/api/admin/web-user/settings` | Get web-user settings (admin) |
| PUT | `/api/admin/web-user/settings` | Update web-user settings |

---

## Decomposition Priority

Based on route count, domain isolation, and coupling:

| Priority | Family | Reason |
|----------|--------|--------|
| 1 | Salary | Fully self-contained, 3 routes, no shared state |
| 2 | KB vNext | No auth, pure read, clear interface |
| 3 | Voice | Own TTS cache, circuit-breaker needed |
| 4 | MCP | Independent protocol, own session store |
| 5 | Elite | Own in-memory store, clear domain |
| 6 | Forms + Files + FAQ | Static/read-heavy, low coupling |
| 7 | Admin: KB Studio | Complex but self-contained |
| 8 | Chat | Most complex; last to extract |

---

## Notes

- `server.ts` has 2 inline routes (KB attachments, Python probe) that should migrate to dedicated route files before decomposition.
- `forms.ts` and `forms-inline.ts` both register `GET /api/forms` — **route conflict**; `forms-inline.ts` is registered later and takes precedence. `forms.ts` is dead code and should be removed.
- `adminPaymentsRoutes`, `jobsRoutes`, `disasterRoutes`, `proceduresRoutes` are imported but their source files are not in `src/routes/` — verify location.
- WebSocket routes use `@fastify/websocket` and are registered after `app.register(websocket)` on line 510.
