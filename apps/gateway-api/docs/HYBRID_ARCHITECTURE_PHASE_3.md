# Watany — Hybrid Architecture Phase 3

> Date: 2026-05-12
> Status: PLANNING
> Prerequisite: Phase 2 ACCEPTED (RC-grade, maturity 92–95%)
> Owner: architecture
> UI source: attached mobile design screenshot (2026-05-12)

---

## Executive context

Phase 2 delivered a real orchestration layer:

- Gateway deterministic routing (`hybrid-route-engine.ts`)
- Shared CTA contract across frontend/backend
- Service flow engine (salary, recruitment, phonebook, procedures)
- Community with real threading and messaging
- Session-scoped chat history
- Admin runtime controls
- 26 regression test files

Phase 3 closes the remaining gap between **correct architecture** and **compelling product**.

The gap is not structural correctness. It is **messaging sophistication and observability**.

---

## UI design analysis (2026-05-12 screenshot)

The attached mobile design confirms and extends the Phase 3 scope. Key observations:

### Home screen (الرئيسية) — confirmed design

```
Header:  موطني —
Welcome: مرحباً بك في موطني — كيف يمكني مساعدتك اليوم؟

2×2 quick actions:
  احسب راتبي   |
  ابحث عن معاملة | أو شي آخر

Live session banner (prominent, with real data):
  🔴 مباشر الآن
  جلسة مباشرة حول قانون التقاعد الجديد — اليوم 6:00 م
  [انضم الآن]

أحدث الإعلانات section + عرض الكل:
  [جديد] بدء دفع معاشات التقاعد — 2025/05/20

خدمات سريعة (4 icons):
  القوانين | الطبابة | التطويع | المنح

Bottom tabs: الرئيسية | المجتمع | الخدمات | المستندات | حسابي
```

**Gaps vs `HomeScreen.tsx` current state:**
- Live session banner is a static placeholder pointing to community — not fed from gateway API
- Announcements section is static — not fed from `GET /api/community/announcements`
- Quick service icons differ from design (design: القوانين, الطبابة, التطويع, المنح)
- No personalized welcome using profile name

### Services screen (جميع الخدمات) — confirmed taxonomy

Design shows a **categorized panel** with 6 sections × 4 services = 24 entries.
Current `ServicesScreen.tsx` has a **flat searchable list** of 7 flows with no category grouping.

| Category | Services in design | Current state |
|----------|-------------------|---------------|
| الرواتب والمعاشات | احسب راتبي, الاستعلام عن الدفعات, **بدلات وتعويضات**, **سلف وقروض** | salary + payment only |
| المعاملات والإجراءات | إجراءات ومعاملات, **نماذج وطلبات**, **متابعة المعاملات**, **شكاوى واقتراحات** | procedures only |
| التطويع والتجنيد | التعاميم, شروط التطويع, أماكن التقديم, **الاستعلام عن الطلب** | jobs page only |
| **الخدمات الصحية** | **المستشفيات**, **الطبابة العسكرية**, **المواعيد الطبية**, **الاستفسار عن الأدوية المتوفرة** | NOT IMPLEMENTED |
| القوانين والحقوق | القوانين والأنظمة, ****, **التناوي و**, **** | search page only |
| دليل الجهات | دليل الأرقام, المؤسسات الرسمية, **البنوك والمصارف**, جهات أخرى | phonebook only |
| أخرى | الإعدادات, الإشعارات, المساعدة, حول التطبيق | settings + notifications |

Bold = **not yet implemented in current codebase**. Count: 12 missing service entries + 1 missing category (health).

### Hybrid route engine gaps from UI taxonomy

The design's service taxonomy implies new routing domains not covered by `hybrid-route-engine.ts`:

| Missing domain | Terms to add | Target module |
|----------------|-------------|---------------|
| Health services | مستشفى, طبيب, موعد, دواء, طبابة, علاج | `health` (new module) |
| Loans & advances | سلف, قرض, قروض, اقتراض, استدانة | `loans` (new module) |
| Complaints | شكوى, شكاوى, اقتراح, تظلم | `complaints` (new module) |
| Transaction tracking | متابعة معاملة, حالة الطلب, وصل, أين طلبي | `cases` (existing, extend) |
| Allowances | بدل, تعويض, علاوة, مكافأة | `salary` (extend existing) |

---

## Phase 3 goals

| # | Goal | Current state | Target | Source |
|---|------|---------------|--------|--------|
| 1 | Real-time community messaging | Thread-based, poll/state refresh | WebSocket / SSE live delivery | Phase 2 gap |
| 2 | Voice notes | Not implemented | Record → upload → playback | Phase 2 gap |
| 3 | Rich attachments | Not implemented | Images, PDFs, procedure cards, audio | Phase 2 gap |
| 4 | Live session integration | Static home banner + unlinked | Home banner from API + thread invite | Phase 2 gap + **UI design** |
| 5 | Cross-flow assistant memory | Shallow, 7 modules only | Intent bridging + 3 new domains | Phase 2 gap + **UI design** |
| 6 | Community moderation | Not implemented | Mute, ban, delete, pin, report, lock | Phase 2 gap |
| 7 | Telemetry / observability | Not implemented | CTA clicks, handoff, drop-off | Phase 2 gap |
| 8 | Retire duplicate gateway routes | Flagged in Phase 2 | Steps 3a–3g from decomposition map | Phase 2 gap |
| **9** | **Home dashboard — live data** | Static placeholders | Live banner + announcements from gateway API | **UI design** |
| **10** | **Service taxonomy expansion** | 7 flat flows, no categories | 6 categorized sections, 24 services, 3 new modules | **UI design** |

---

## Work packages

---

### WP-1 — Real-time community messaging

**Motivation:** Thread-based polling feels like a forum. Elderly veterans expect WhatsApp-style immediate delivery.

**Current infrastructure:**

- `apps/gateway-api/src/ws/` has `events.ts`, `media-ws.ts`, `features-ws.ts`, `admin-ws.ts`
- WebSocket plugin is already registered (`bootstrap/plugins.ts`)
- Community store at `src/community/service.ts` is in-memory with full thread/message model

**Work items:**

| ID | Task | File(s) |
|----|------|---------|
| 1.1 | Add `community-ws.ts` — broadcast new messages to group channel subscribers | `src/ws/community-ws.ts` (new) |
| 1.2 | Emit `community:message` event on every `POST /api/community/groups/:id/threads/:tid/messages` | `src/routes/community.ts` |
| 1.3 | Emit `community:thread_created` event on `POST /api/community/groups/:id/threads` | same |
| 1.4 | Frontend `GroupChatsPage.tsx` subscribes to WS channel and appends messages without full reload | `apps/web-user/src/pages/GroupChatsPage.tsx` |
| 1.5 | Add typing indicator events: `community:typing_start` / `community:typing_stop` | WS layer |
| 1.6 | Add presence: `community:member_online` / `community:member_offline` on WS connect/disconnect | WS layer |
| 1.7 | Message delivery state: `sending` → `sent` → `delivered` (no read receipts until WP-3) | frontend state |
| 1.8 | Regression test: WS message broadcast after REST post | `src/tests/community-ws.test.ts` (new) |

**Acceptance:** A message posted in Group A appears in all open Group A tabs within 500ms without page refresh.

---

### WP-2 — Voice note support

**Motivation:** Core for elderly veterans who prefer speaking over typing. Already flagged in product brief.

**Current infrastructure:**

- `src/ws/media-ws.ts` exists (likely stub)
- `src/routes/` has no audio upload endpoint
- `apps/api-backend` (FastAPI) could handle transcription via Whisper if available

**Work items:**

| ID | Task | File(s) |
|----|------|---------|
| 2.1 | `POST /api/community/groups/:id/threads/:tid/voice` — multipart upload, store blob ref | `src/routes/community.ts` |
| 2.2 | Gateway stores audio file reference in message row (in-memory: buffer ref; production: object storage URL) | `src/community/service.ts` |
| 2.3 | `GET /api/community/voice/:voiceId` — serve audio with correct MIME type | new route |
| 2.4 | Optional transcription proxy: gateway `POST /api/community/voice/:voiceId/transcribe` → Python `/transcribe` | new route |
| 2.5 | Frontend recorder component: hold-to-record, waveform preview, send/cancel | `apps/web-user/src/components/VoiceRecorder.tsx` (new) |
| 2.6 | Frontend audio player component: waveform bar, timestamp, playback speed | `apps/web-user/src/components/VoicePlayer.tsx` (new) |
| 2.7 | Message model: `kind: "voice"` with `voice_url`, `duration_s`, `transcript?` fields | `src/community/service.ts` |
| 2.8 | Regression: upload returns playable URL, duration present | `src/tests/community-voice.test.ts` (new) |

**Acceptance:** User holds mic button, releases, sees waveform, taps send. Message appears in thread with playback bar. Other members can play it.

---

### WP-3 — Rich attachments

**Motivation:** Documents, procedure cards, and images are the primary content veterans exchange.

**Work items:**

| ID | Task | File(s) |
|----|------|---------|
| 3.1 | `POST /api/community/groups/:id/threads/:tid/attachments` — multipart, returns attachment ref | `src/routes/community.ts` |
| 3.2 | Attachment kinds: `image`, `pdf`, `procedure_card`, `audio` (reuses WP-2 voice) | `src/community/service.ts` |
| 3.3 | Procedure card attachment: gateway auto-generates card when user shares a procedure ID | `src/community/service.ts` |
| 3.4 | `GET /api/community/attachments/:id` — serve file or redirect to procedure preview | new route |
| 3.5 | Frontend attachment picker: image from gallery, PDF from files, procedure card from search | `apps/web-user/src/components/AttachmentPicker.tsx` (new) |
| 3.6 | Frontend image lightbox in thread view | `GroupChatsPage.tsx` |
| 3.7 | Frontend PDF preview card: title, page count, download button | `apps/web-user/src/components/AttachmentCard.tsx` (new) |
| 3.8 | Frontend procedure card: title, summary, CTA button → opens `ProceduresPage` | same |
| 3.9 | Message delivery read receipts (requires WS WP-1): `community:message_read` event | WS layer |
| 3.10 | Regression: attachment upload + retrieval + procedure card generation | `src/tests/community-attachments.test.ts` (new) |

**Acceptance:** Veteran can share a procedure form directly from ProceduresPage into a community thread. Recipients see the card and can open the form preview.

---

### WP-4 — Live session integration

**Motivation:** Live sessions exist as a feature but are not connected to community threads or the assistant. The UI design also requires the **home dashboard banner** to pull real session data from the gateway instead of being a static placeholder.

**Current state:**
- `src/community/service.ts` has `SEED_LIVE_SESSIONS` and live session model
- Community groups have `live_session?` field
- `HomeScreen.tsx` has a static "مباشر الآن" card that always navigates to community — not data-driven

**UI design requirement (confirmed from screenshot):**
```
Home banner when a session is active:
  🔴 مباشر الآن  (badge)
  جلسة مباشرة حول قانون التقاعد الجديد
  اليوم 6:00 م
  [انضم الآن]  → join_url
```
The banner must be hidden when no session is active and replaced with a default promotional card.

**Work items:**

| ID | Task | File(s) |
|----|------|---------|
| 4.1 | `GET /api/community/sessions/active` — return current active session(s) with title, host, start_time, join_url | `src/routes/community.ts` |
| 4.2 | `POST /api/community/groups/:id/sessions` — create live session, pin to group | same |
| 4.3 | Auto-post system message to group thread on session start: "بدأت جلسة مباشرة — انضم الآن" | `src/community/service.ts` |
| 4.4 | Session invite CTA in thread message: `type: "join_session"` with `session_url` | CTA contract |
| 4.5 | `POST /api/community/sessions/:id/end` — archive session, post summary message | `src/routes/community.ts` |
| 4.6 | Assistant `join_session` CTA type wired in `cta-generator.ts` for active sessions | `src/hybrid/cta-generator.ts` |
| 4.7 | `HomeScreen.tsx` — replace static "مباشر الآن" card with data-driven banner: poll `GET /api/community/sessions/active` on mount, render banner if active, hide if none | `apps/web-user/src/components/HomeScreen.tsx` |
| 4.8 | Frontend session invite card in thread: title, host, duration, join button | `GroupChatsPage.tsx` |
| 4.9 | WS event `community:session_started` / `community:session_ended` — push to all connected clients so home banner updates live without poll | `src/ws/community-ws.ts` |
| 4.10 | Regression: session created → `GET /active` returns it → home banner data populated → system message posted → invite card in thread | `src/tests/community-sessions.test.ts` (new) |

**Acceptance:** Admin creates a live session. Home dashboard banner immediately shows real title, time, and join button. All group thread members see a pinned invite card (via WS). Clicking join opens the session. When session ends, banner disappears.

---

### WP-5 — Cross-flow assistant memory + new routing domains

**Motivation:** When a user transitions salary → assistant → follow-up, the assistant loses context. Additionally, the UI design's service taxonomy (WP-10) introduces 3 new modules (`health`, `loans`, `complaints`) that need routing coverage in `hybrid-route-engine.ts`.

**Current infrastructure:**

- `src/hybrid/hybrid-route-engine.ts` covers: salary, payment, recruitment, phonebook, procedure, laws, community, support (8 domains)
- `src/routes/history.ts` has session-scoped history (Phase 2)
- No intent bridging between module exits and re-entry
- Missing keyword lists: health, loans, complaints, transaction tracking, allowances

**Work items:**

| ID | Task | File(s) |
|----|------|---------|
| 5.1 | Add `context_frame` to session history entries: `{module, intent, resolved_entity}` | `src/routes/history.ts` |
| 5.2 | On module exit (salary/recruitment/procedures/health), post a `context_frame` marker to history | route handlers |
| 5.3 | `hybrid-route-engine.ts`: read last `context_frame` from history when routing ambiguous follow-ups | `src/hybrid/hybrid-route-engine.ts` |
| 5.4 | Context frame TTL: clear frame after 10 minutes of inactivity or explicit "شيء آخر" | routing logic |
| 5.5 | `suggestion-engine.ts`: surface module-aware CTAs when context_frame is active | `src/hybrid/suggestion-engine.ts` |
| 5.6 | **New term lists** — add to `hybrid-route-engine.ts`: | same |
| | `HEALTH_TERMS = ["مستشفى", "طبيب", "موعد", "دواء", "طبابة", "علاج", "عيادة", "مشفى"]` → `health` module | |
| | `LOAN_TERMS = ["سلف", "قرض", "قروض", "اقتراض", "استدانة", "سلفة"]` → `loans` module | |
| | `COMPLAINT_TERMS = ["شكوى", "شكاوى", "اقتراح", "تظلم", "مشكلة معاملة", "مخالفة"]` → `complaints` module | |
| | `TRACKING_TERMS = ["متابعة معاملة", "حالة الطلب", "وصل طلبي", "أين طلبي", "وين طلبي"]` → extend `cases` | |
| | `ALLOWANCE_TERMS = ["بدل", "علاوة", "مكافأة", "تعويضات"]` → extend `salary` | |
| 5.7 | Add `WatanyModule` variants: `"health"`, `"loans"`, `"complaints"` to `@watany/types` | `packages/shared/src/types.ts` or equivalent |
| 5.8 | Add `contextFollowupDecision` branches for `health`, `loans`, `complaints` modules | `src/hybrid/hybrid-route-engine.ts` |
| 5.9 | Regression: salary follow-up routes to salary; health query routes to health; loan query routes to loans | `chat-relevance-regression.test.ts` |

**Acceptance:** (a) User asks about salary → navigates away → asks "وش الزيادة؟" → routes to salary. (b) User asks "وين أروح للمستشفى" → routes to `health` module. (c) User asks "بدي أقدم شكوى" → routes to `complaints` module.

---

### WP-6 — Community moderation tools

**Motivation:** Without moderation, community degrades. Required before any real user launch.

**Work items:**

| ID | Task | File(s) |
|----|------|---------|
| 6.1 | `POST /api/community/groups/:id/members/:uid/mute` — time-limited mute | `src/routes/community.ts` |
| 6.2 | `DELETE /api/community/groups/:id/members/:uid` — remove member (ban) | same |
| 6.3 | `DELETE /api/community/groups/:id/threads/:tid/messages/:mid` — delete message | same |
| 6.4 | `POST /api/community/groups/:id/threads/:tid/messages/:mid/pin` — pin message | same |
| 6.5 | `POST /api/community/groups/:id/threads/:tid/messages/:mid/report` — flag for admin review | same |
| 6.6 | `POST /api/community/groups/:id/threads/:tid/lock` — prevent new messages | same |
| 6.7 | Admin moderation queue: `GET /api/admin/community/reports` | `src/routes/admin-community.ts` (new) |
| 6.8 | `PATCH /api/admin/community/reports/:id` — resolve report (dismiss / delete / ban) | same |
| 6.9 | WS event `community:message_deleted` — remove message from active views without reload | WS layer |
| 6.10 | Frontend: long-press menu in thread → report / delete (own) / pin (moderator) | `GroupChatsPage.tsx` |
| 6.11 | Regression: muted user cannot post, banned user is removed from member list | `src/tests/community-moderation.test.ts` (new) |

**Acceptance:** Admin can delete any message and ban any user from the admin panel. The deletion propagates live to all open thread views.

---

### WP-7 — Telemetry and observability

**Motivation:** Cannot improve what cannot be measured. Required for Phase 4 product decisions.

**Work items:**

| ID | Task | File(s) |
|----|------|---------|
| 7.1 | `POST /api/telemetry/cta_click` — record CTA interactions: `{cta_type, cta_target, session_id, timestamp}` | `src/routes/telemetry.ts` (new) |
| 7.2 | `POST /api/telemetry/handoff` — record module handoffs: `{from, to, success, session_id}` | same |
| 7.3 | `POST /api/telemetry/session_end` — record session metrics: `{turns, modules_visited, duration_s}` | same |
| 7.4 | In-memory telemetry store (SQLite-backed in production) with rolling 24h window | `src/db/telemetry.ts` (new) |
| 7.5 | `GET /api/admin/telemetry/summary` — aggregated metrics for admin dashboard | `src/routes/admin-telemetry.ts` (new) |
| 7.6 | Frontend: fire telemetry events from `api.ts` wrapper on CTA click and module enter | `apps/web-user/src/lib/api.ts` |
| 7.7 | Admin dashboard panel: top CTAs, handoff success rate, avg session turns, drop-off by module | `apps/web-admin/` |
| 7.8 | Regression: telemetry POST accepted, summary returns aggregated counts | `src/tests/telemetry.test.ts` (new) |

**Acceptance:** After 24 hours of usage, admin can see: which CTAs are clicked most, which module transitions succeed, and where users drop off.

---

### WP-8 — Retire duplicate gateway routes (decomposition map steps 3a–3g)

**Motivation:** Flagged in Phase 2 decomposition map. Dead code and duplicate routes accumulate maintenance debt.

**Work items:**

| ID | Task | Status | File(s) |
|----|------|--------|---------|
| 8.1 | Delete `routes/forms.ts` | 3a — no prerequisites | `src/routes/forms.ts` |
| 8.2 | Audit: confirm frontend does not call `GET /api/salary` directly | 3b — frontend audit | `apps/web-user/src/lib/api.ts` |
| 8.3 | Retire `salary-inline.ts` salary routes; proxy to Python `/api/v2/salary` | 3c — after 8.2 | `src/routes/salary-inline.ts` |
| 8.4 | Retire `kb-vnext.ts` search; redirect `/api/kb/search` → `/api/v2/search` | 3d — schema compat check | `src/routes/kb-vnext.ts` |
| 8.5 | Delete `routes/salary.ts` (pre-existing duplicate) | 3e — no prerequisites | `src/routes/salary.ts` |
| 8.6 | Audit `advanced.ts` stubs vs real Python endpoints | 3f — compare responses | `src/routes/advanced.ts` |
| 8.7 | Integration tests for all proxied routes before any retirement | 3g — prerequisite for 8.3/8.4 | `src/tests/proxy-routes.test.ts` |

**Acceptance:** Zero dead route files. All salary and KB search traffic proxied to Python with parity-verified responses.

---

### WP-9 — Home dashboard: live data (UI design alignment)

**Motivation:** The UI design confirms the home screen must be data-driven. Currently `HomeScreen.tsx` has a static "مباشر الآن" card that always renders and always navigates to community, and a static announcements section. These must pull from the gateway.

**UI design requirements (confirmed from screenshot):**
- Live session banner: visible only when a session is active; shows real topic, time, join button with "مباشر الآن" pulsing badge
- Announcements section: shows "أحدث الإعلانات" with "عرض الكل" link, "جديد" badge for recent entries, date
- Quick services section: icons for القوانين, الطبابة, التطويع, المنح (currently icons differ from design)
- Personalized welcome: "مرحباً بك في موطني" (can use profile name once logged in)

**Current state of `HomeScreen.tsx`:**
- `QUICK_ACTIONS` array hardcoded with: الراتب, المنح, التطويع, الطبابة, القوانين, الهاتف (6 items, wrong order vs design's 4)
- `LATEST_UPDATES` array is fully static text, not API-driven
- The "مباشر الآن" card is a static `<article>` with no session data

**Work items:**

| ID | Task | File(s) |
|----|------|---------|
| 9.1 | `GET /api/community/sessions/active` (shared with WP-4.1) — returns `{id, title, host, start_time, join_url} | null` | `src/routes/community.ts` |
| 9.2 | `GET /api/community/announcements?limit=3` — returns recent pinned announcements with `is_new` flag (new = posted within 48h) | `src/routes/community.ts` |
| 9.3 | `HomeScreen.tsx` — fetch active session on mount; render data-driven banner when session exists, hide (or show default promotional card) when null | `apps/web-user/src/components/HomeScreen.tsx` |
| 9.4 | `HomeScreen.tsx` — fetch recent announcements on mount; render `أحدث الإعلانات` section with real title, body, date, `جديد` badge | same |
| 9.5 | `HomeScreen.tsx` — reorder `QUICK_ACTIONS` to match design: القوانين, الطبابة, التطويع, المنح (4 icons, 2×2 grid) | same |
| 9.6 | `HomeScreen.tsx` — welcome section uses profile display name if available from `useUser()` | same |
| 9.7 | `api.ts` — add `getActiveSessions()` and `getRecentAnnouncements(limit)` client methods | `apps/web-user/src/lib/api.ts` |
| 9.8 | Loading and error states for both fetches (skeleton cards, no layout shift) | `HomeScreen.tsx` |
| 9.9 | Regression: `GET /api/community/announcements` returns correct shape; `GET /api/community/sessions/active` returns null when no session | `src/tests/community-sessions.test.ts` |

**Acceptance:** Opening the home screen when a live session is active shows the real session title and time with "انضم الآن" button. The announcements section shows real data from the gateway with "جديد" badge for recent entries. When no session is active, the live banner slot shows the default promotional card.

---

### WP-10 — Service taxonomy expansion (UI design alignment)

**Motivation:** The UI design shows a **categorized services panel** with 6 category headers and 24 service entries. Current `ServicesScreen.tsx` has 7 flat service flows with no category grouping. 12 specific services from the design are completely missing. The `hybrid-route-engine.ts` has no routing coverage for health, loans, or complaints.

**Design's service taxonomy (6 categories × 4 items):**

```
الرواتب والمعاشات:
  احسب راتبي          → salary       (EXISTS)
  الاستعلام عن الدفعات → payment       (EXISTS)
  بدلات وتعويضات      → salary/allowances (NEW)
  سلف وقروض           → loans        (NEW MODULE)

المعاملات والإجراءات:
  إجراءات ومعاملات    → procedures   (EXISTS)
  نماذج وطلبات        → procedures   (redirect to forms tab, EXISTS partial)
  متابعة المعاملات    → cases        (EXISTS, extend)
  شكاوى واقتراحات     → complaints   (NEW MODULE)

التطويع والتجنيد:
  التعاميم     → jobs         (EXISTS)
  شروط التطويع        → jobs         (EXISTS partial)
  أماكن التقديم       → jobs         (EXISTS partial)
  الاستعلام عن الطلب  → jobs         (NEW — application status lookup)

الخدمات الصحية:        (ENTIRE CATEGORY NEW)
  المستشفيات          → health
  الطبابة العسكرية    → health
  المواعيد الطبية     → health
  الاستفسار عن الأدوية المتوفرة    → health

القوانين والحقوق:
  القوانين والأنظمة   → search/laws  (EXISTS)
       → search/laws  (NEW — veterans rights sub-section)
  التناوي و → search/laws  (NEW)
        → search/laws  (NEW)

دليل الجهات:
  دليل الأرقام        → phonebook    (EXISTS)
  المؤسسات الرسمية    → phonebook    (EXISTS)
  البنوك والمصارف     → phonebook    (NEW sub-category)
  جهات أخرى           → phonebook    (EXISTS)
```

**Work items:**

| ID | Task | File(s) |
|----|------|---------|
| 10.1 | `ServicesScreen.tsx` — restructure from flat list to 6 grouped category sections with section headers matching design | `apps/web-user/src/components/ServicesScreen.tsx` |
| 10.2 | Add `category` field to `ServiceFlow` type and group by category in render | same |
| 10.3 | Add missing salary sub-entries: بدلات وتعويضات, سلف وقروض (both initially navigate to salary page with focus param) | same |
| 10.4 | Add missing transaction entries: متابعة المعاملات (→ cases), شكاوى واقتراحات (→ complaints page/modal) | same |
| 10.5 | Add missing recruitment entries: الاستعلام عن الطلب (→ jobs page with status tab) | same |
| 10.6 | Add entire health category: المستشفيات, الطبابة العسكرية, المواعيد الطبية, الاستفسار عن الأدوية المتوفرة (all → phonebook/health filtered or KB search) | same |
| 10.7 | Add legal sub-entries: , التناوي و,  (all → search with pre-filled query) | same |
| 10.8 | Add directory sub-entry: البنوك والمصارف (→ phonebook with bank filter) | same |
| 10.9 | `hybrid-route-engine.ts` — add `HEALTH_TERMS`, `LOAN_TERMS`, `COMPLAINT_TERMS` keyword lists and new module decisions | `src/hybrid/hybrid-route-engine.ts` |
| 10.10 | `hybrid-route-engine.ts` — add `health`, `loans`, `complaints` to `WatanyModule` union and `moduleIntentMap` | same |
| 10.11 | `cta-generator.ts` — add CTAs for health (`phone_lookup` to hospital), loans (`open_service_flow` to loans info), complaints (`open_service_flow` to complaint form) | `src/hybrid/cta-generator.ts` |
| 10.12 | `GET /api/community/announcements` (WP-9.2) doubles as the "أخرى" section's notifications data source | shared |
| 10.13 | `apps/web-user/src/pages/` — stub pages for new modules: complaints form page (`ComplaintsPage.tsx`), health directory page (`HealthPage.tsx`) | new pages |
| 10.14 | Register new routes in `AppShell.tsx`: `/complaints`, `/health` | `src/components/AppShell.tsx` |
| 10.15 | Regression: `hybrid-route-engine` routes health/loan/complaint queries correctly | `src/tests/chat-relevance-regression.test.ts` (new assertions) |
| 10.16 | Regression: `ServicesScreen` renders all 6 categories with correct item counts | `src/tests/service-taxonomy.test.ts` (new) |

**Acceptance:** ServicesScreen shows 6 category headers matching the UI design. Health category has 4 entries. Routing "أين أروح للمستشفى" → `health` module. Routing "بدي أقدم شكوى" → `complaints` module. All existing service flows still work.

---

Phase 3 is not sequential. Work packages are grouped by dependency:

```
PARALLEL GROUP A (no blockers — immediate start):
  WP-6  moderation          ← community CRUD, no WS dependency
  WP-8  route cleanup       ← housekeeping, no feature dependency
  WP-9  home dashboard      ← frontend + gateway API only, no WS
  WP-10 service taxonomy    ← frontend + route engine, no WS

PARALLEL GROUP B (independent backend + frontend):
  WP-5  cross-flow memory   ← backend routing + new modules (unblocks WP-10 routing)
  WP-7  telemetry           ← independent backend + frontend wiring

SEQUENTIAL (requires WP-1 WS foundation):
  WP-1  real-time WS        ← foundation for WP-2, WP-3, WP-4
  WP-1  → WP-2 voice notes  (uses community WS for delivery)
  WP-1  → WP-3 rich attachments (uses community WS for delivery)
  WP-1  → WP-4 live sessions (WS banner push + thread invite)
```

Recommended execution order:
1. **WP-8 + WP-9 + WP-10** (fast wins — housekeeping + UI alignment from design)
2. **WP-5 + WP-6** (backend domains + moderation CRUD in parallel)
3. **WP-7** (telemetry, independent)
4. **WP-1** (WebSocket foundation — unblocks WP-2, WP-3, WP-4)
5. **WP-2 + WP-3** (parallel, both on WP-1)
6. **WP-4** (on WP-1; home banner partial from WP-9 gateway API)

---

## Regression gates

Each WP must pass its own regression test before merge. End-of-Phase-3 gate:

```bash
# Full gateway regression (all 26 existing + new files)
pnpm --dir apps/gateway-api test --run

# Typecheck (frontend + gateway + packages)
pnpm -r typecheck

# Community WS smoke (WP-1, new)
pnpm --dir apps/gateway-api test --run src/tests/community-ws.test.ts

# Moderation smoke (WP-6, new)
pnpm --dir apps/gateway-api test --run src/tests/community-moderation.test.ts

# Telemetry smoke (WP-7, new)
pnpm --dir apps/gateway-api test --run src/tests/telemetry.test.ts

# Live sessions (WP-4, new) — includes GET /active and home banner data contract
pnpm --dir apps/gateway-api test --run src/tests/community-sessions.test.ts

# Cross-flow memory + new routing domains (WP-5 — extended existing suite)
pnpm --dir apps/gateway-api test --run src/tests/chat-relevance-regression.test.ts

# Service taxonomy gateway endpoints (WP-10, new)
pnpm --dir apps/gateway-api test --run src/tests/service-taxonomy.test.ts
```

All existing 26 test files must continue to pass.

---

## What Phase 3 does NOT include

To prevent scope creep:

- No new LLM model integration (existing AI layer is sufficient)
- No push notifications (system-level, defer to Phase 4)
- No payment processing changes (separate domain)
- No infrastructure migration (Docker/cloud, separate concern)
- No mobile app (web PWA only for Phase 3)
- No PostgreSQL migration for community store (in-memory store is fast enough for current user count)
- No actual backend for health appointments / pharmacy (WP-10 health category is a gateway route + KB lookup, not a medical system)

---

## Definition of done

Phase 3 is complete when:

1. Messages in community threads appear live without refresh (WP-1)
2. Voice notes can be recorded, sent, and played back in threads (WP-2)
3. Procedure cards can be shared as attachments in threads (WP-3)
4. Live session invites appear as thread messages AND home banner is data-driven from gateway (WP-4)
5. Salary/health/loan/complaint follow-ups route correctly from assistant (WP-5)
6. Admin can mute/ban/delete/pin/report in community (WP-6)
7. Admin telemetry dashboard shows CTA and handoff metrics (WP-7)
8. Dead salary and KB search routes retired (WP-8)
9. Home dashboard live session banner and announcements feed from gateway API (WP-9)
10. ServicesScreen shows 6-category taxonomy matching UI design; 3 new routing modules active (WP-10)
11. All regression tests pass
12. Typecheck clean

Architecture maturity target: **97–98%**
