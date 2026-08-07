# WATANY MOBILE DESIGN SYSTEM

## Production UX Baseline (Hybrid Architecture)

**Status: FROZEN — Design contract before Phase 3 engineering**
**Date: May 2026**

---

# 1. DESIGN PHILOSOPHY

Watany is **not**:

* a chatbot with extra pages
* a dashboard web app compressed into mobile
* a government portal clone
* a document browser

Watany **is**:

```
Veteran-first mobile service platform
+
AI assistant
+
community platform
+
service execution app
```

Core rule:

```
If the user wants to talk  → conversation UX
If the user wants to do    → service UX
If the user wants quick info → lookup UX
```

---

# 2. UX MODES

## Mode A — Smartphone Native App

Use for:

* salary
* procedures
* payments
* grants
* documents
* recruitment
* phonebook
* laws
* complaints
* tracking
* health

Behavior:

```
cards
launcher icons
structured flows
step forms
bottom CTA
guided navigation
```

---

## Mode B — WhatsApp Mode

Use for:

* community groups
* support
* assistant conversations
* live session discussions

Behavior:

```
chat rows
message bubbles
typing
unread
timestamps
voice notes
attachments
reply threads
```

---

## Mode C — Lookup Mode

Use for:

* phone numbers
* payment dates
* article lookup
* quick yes/no answers
* status checks

Behavior:

```
inline answer
fast CTA actions
minimal friction
```

---

# 3. INFORMATION ARCHITECTURE

Bottom navigation locked:

```
الرئيسية
المجتمع
الخدمات
المستندات
حسابي
```

No additions without architecture review.

---

# 4. HOME SCREEN

Purpose:

```
Immediate orientation
Immediate help
Immediate action
```

NOT: feature dump.

---

## Home Structure

### Header

Compact only:

```
burger | logo | search | notifications | profile
```

No sticky secondary bar.

---

### Assistant Helper Strip

Compact:

```
كيف أساعدك؟
[  ]
```

Small. Not dominant. Assistant assists — does not dominate.

---

### Quick Actions

Maximum: **8 tiles**

Recommended set:

```
احسب راتبي      الدفعات
المنح           التطويع
الطبابة         القوانين
الدليل          ابحث عن معاملة
```

Grid: **4 × 2**

---

### Live Strip

Compact — single row only:

```
🔴 مباشر الآن  |  جلسة قانون التقاعد  |  6:00 مساء  |  [ انضم ]
```

Not a giant card.

---

### Announcements

Maximum: **2–3 items**

Each item:

```
badge | title | date | CTA
```

---

### Community Preview

WhatsApp-style row:

```
مجتمع المتقاعدين
3 رسائل جديدة · آخر رسالة... · 09:14
```

---

# 5. COMMUNITY UX

Must feel like WhatsApp.

---

## Community List

Rows only. Each row:

```
avatar | group name | last message | timestamp | unread badge
```

No dashboard cards.

---

## Community Thread

Required elements:

```
header
message bubbles
timestamps
composer
attachment
voice note
reply
pinned messages
```

---

## Admin Announcements

Distinct official style — `إعلان رسمي`

Actions:

```
قراءة التفاصيل | مشاركة | أو شي تاني
```

---

# 6. SERVICES UX

Purpose: Structured service discovery.

Design model: **App launcher** — NOT text catalog.

---

## Category Structure

Accordion only. Collapsed by default.

### المالية والمستحقات

```
الراتب | الدفعات | المنح | بدلات وتعويضات | سلف وقروض
```

### المعاملات والإجراءات

```
الإجراءات | متابعة المعاملات | النماذج | المستندات
```

### الصحة والرعاية

```
الطبابة العسكرية | مراكز صحية | تغطية صحية | طلبات طبية
```

### القوانين والحقوق

```
القوانين |  |  | الاستحقاقات
```

### التطويع والتسجيل

```
التعاميم |  | التقديم | النتائج
```

### الدليل والجهات

```
المستشفيات | الجهات الرسمية | الخدمات | المصارف
```

### التقارير والشكاوى

```
شكاوى | اقتراحات | بلاغات | متابعة الشكوى
```

### 

```
 الفني | المساعدة | التواصل
```

---

# 7. DOCUMENTS UX

Simple library — not complex dashboard.

Sections:

```
saved | official docs | downloads | shared | recent
```

Actions:

```
preview | download | share
```

---

# 8. CTA DOCTRINE

Universal. Every answer must include next actions.

**Mandatory last action: `أو شي تاني`** — always present.

Examples:

| Context | CTAs |
|---------|------|
| Salary | تعديل · مقارنة · حفظ · **أو شي تاني** |
| Procedure | المستندات · تحميل · ابدأ المعاملة · **أو شي تاني** |
| Phonebook | اتصال · مشاركة · ابحث ثانية · **أو شي تاني** |

---

# 9. VISUAL RULES

## Typography

Arabic first.

| Element | Size |
|---------|------|
| Body minimum | 17–20px |
| Button text | 18px+ |
| Labels | 14px minimum |

## Touch Targets

| Element | Minimum |
|---------|---------|
| Buttons | 56px height |
| Icons / tiles | 44px tap area |
| Tab bar items | 56px height |

## Contrast

High contrast mandatory. Elder-friendly.

## Icons

Clear. Recognizable. Consistent family (Phosphor Icons).

## Spacing

Generous. Avoid cramped layouts. Prefer whitespace over density.

---

# 10. DO NOT DO

Never:

```
floating sticky bars
dashboard card overload
tiny icons
desktop compressed layouts
giant text catalogs
duplicate navigation
assistant dominance
hidden gestures
tiny CTA buttons
dense scrolling catalogs
```

---

# 11. ROUTING UX

Hybrid routing (`conversation` / `service` / `lookup`) must remain **backend-governed**.

Frontend must not guess the mode.

The gateway's hybrid route engine resolves intent → mode → context.

---

# 12. ELDERLY USABILITY RULE

Every screen must pass:

> **Can a retired military user with low digital literacy complete this without explanation?**

If no → redesign.

Specific requirements:

* No hidden gestures
* No icon-only buttons (always labeled)
* No error messages without recovery action
* No destructive actions without confirmation
* Back navigation always visible

---

# 13. IMPLEMENTATION ORDER

### Phase A — Design Tokens

CSS variables freeze: colors, spacing, typography scale, border-radius, shadows.

### Phase B — Home

Compact hero + 4×2 quick grid + live strip + announcements + community preview row.

### Phase C — Services Launcher

Icon grid + search filter + category accordion.

### Phase D — Community WhatsApp UX

Chat rows + thread view + composer + admin announcement style.

### Phase E — Documents

Library view + preview + download + share.

### Phase F — Accessibility QA

Color contrast audit · touch target audit · screen reader audit · font scale test.

---

# 14. FINAL PRODUCT FEEL

Watany should feel like:

```
WhatsApp
+
Banking app
+
Government services app
+
Veteran support assistant
```

Combined cleanly. No mode should feel foreign to a smartphone user.

---

*This document is the frozen UX contract. Changes require explicit architecture review.*
