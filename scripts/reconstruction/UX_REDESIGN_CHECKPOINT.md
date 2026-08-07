# UX Redesign — Resume Checkpoint

**Last updated:** 2026-03-02
**Reference docs:** `WATANYBOT_UX_REDESIGN_FRAMEWORK.md`, `QUICK_FIXES_START_NOW.md`, `BEFORE_AFTER_COMPARISON.md`

---

## STATUS SUMMARY

| Phase | Status | Notes |
|-------|--------|-------|
| **Phase 1: Design Tokens** | ✅ DONE | `--space-1`–`--space-6`, `--icon-sm/md/lg/xl`, `--touch-min/comfortable` added to `mobile.css :root`. Legacy aliases remapped. |
| **Phase 2: Navigation** | 🔶 PARTIAL | Search state vars in `TopMenu.tsx` but **no search input UI rendered**. No search CSS added. No breadcrumbs in `ScreenHeader.tsx`. |
| **Phase 3: Services Grid** | ⬜ NOT STARTED | Service cards need enlargement to 160px+, icon 64px. Grid gap already uses tokens. |
| **Phase 4: Chat Interface** | ⬜ NOT STARTED | Needs `max-width: 1200px` on messages, 32px message spacing, choice button styling. |
| **Phase 5: Modal System** | ⬜ NOT STARTED | Need premium modal CSS (gradient header, icon, animations). Update `PopupModal.tsx`. |
| **Phase 6: Touch Targets** | ⬜ NOT STARTED | Audit all buttons for ≥44px. Fix `.font-btn` (36px), `.menu-toggle` (40px). |
| **Phase 7: Mobile Optimization** | ⬜ NOT STARTED | `clamp()` font sizes, responsive grid breakpoints, safe-area insets. |
| **Phase 8: Testing** | ⬜ NOT STARTED | Test 375px/390px/768px/1200px viewports, RTL, dark mode. |

---

## RESUME INSTRUCTIONS

When resuming, say: **"Resume UX redesign from checkpoint"** and provide the three reference documents again.

### Phase 2 Remaining Tasks (pick up here):

#### 2.1 — Add search input to TopMenu.tsx
**File:** `apps/web-user/src/components/TopMenu.tsx`
**State already declared (lines ~30-31):**
```tsx
const [searchQuery, setSearchQuery] = useState('');
const [searchExpanded, setSearchExpanded] = useState(false);
```
**What to do:** Insert this JSX between the `menu-logo` div and `menu-actions` div:
```tsx
{/* Search Box */}
<div className={`tm-search ${searchExpanded ? 'expanded' : ''}`}>
  <input
    type="search"
    className="tm-search-input"
    placeholder="ابحث عن خدمة، نموذج، أو سؤال..."
    value={searchQuery}
    onChange={e => setSearchQuery(e.target.value)}
    onKeyDown={e => {
      if (e.key === 'Enter' && searchQuery.trim()) {
        onNavigate?.('search');
      }
    }}
  />
  <button className="tm-search-toggle" onClick={() => setSearchExpanded(!searchExpanded)}>
    <i className="ph ph-magnifying-glass" />
  </button>
</div>
```

#### 2.2 — Add search CSS to TopMenu.css
**File:** `apps/web-user/src/styles/TopMenu.css`
**Add after `.menu-logo` block (~line 57):**
```css
/* ─── SEARCH BOX ─────────────────────────────────────────────── */
.tm-search {
  flex: 1;
  max-width: 400px;
  position: relative;
  display: flex;
  align-items: center;
}

.tm-search-input {
  width: 100%;
  height: 44px;
  padding: 0 44px 0 var(--space-2);
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-radius: var(--r-full);
  font-size: 0.9rem;
  font-family: inherit;
  background: rgba(255, 255, 255, 0.12);
  color: white;
  outline: none;
  transition: all 0.3s;
}

.tm-search-input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.tm-search-input:focus {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.1);
}

.tm-search-toggle {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  font-size: 18px;
  transition: background 0.2s;
}

.tm-search-toggle:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Mobile: collapse to icon */
@media (max-width: 480px) {
  .tm-search {
    flex: 0;
    max-width: none;
  }
  .tm-search-input {
    width: 0;
    padding: 0;
    border: none;
    opacity: 0;
    transition: width 0.3s, opacity 0.3s, padding 0.3s;
  }
  .tm-search.expanded .tm-search-input {
    position: absolute;
    top: 56px;
    right: 0;
    left: 0;
    width: calc(100vw - 32px);
    margin: 0 auto;
    opacity: 1;
    padding: 0 44px 0 var(--space-2);
    background: var(--surface);
    color: var(--ink);
    border: 2px solid var(--stroke);
    z-index: 101;
    box-shadow: var(--shadow-md);
  }
  .tm-search.expanded .tm-search-input::placeholder {
    color: var(--placeholder);
  }
}
```

#### 2.3 — Add breadcrumbs to ScreenHeader.tsx
**File:** `apps/web-user/src/components/ScreenHeader.tsx`
**Add `breadcrumbs` prop and render below title:**
```tsx
type Props = {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  trailing?: React.ReactNode;
  breadcrumbs?: { label: string; onClick?: () => void }[];
};

export function ScreenHeader({ title, showBack, onBack, trailing, breadcrumbs }: Props) {
  return (
    <header className="screen-header" role="banner">
      {showBack ? (
        <button className="screen-header__back" onClick={onBack} aria-label="رجوع" title="رجوع">
          <i className="ph ph-arrow-right" />
        </button>
      ) : (
        <div className="screen-header__logo">🇱🇧</div>
      )}

      <div className="screen-header__center">
        <h1 className="screen-header__title">{title}</h1>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="screen-header__breadcrumbs" aria-label="المسار">
            {breadcrumbs.map((crumb, i) => (
              <span key={i}>
                {crumb.onClick ? (
                  <button className="breadcrumb-link" onClick={crumb.onClick}>{crumb.label}</button>
                ) : (
                  <span className="breadcrumb-current">{crumb.label}</span>
                )}
                {i < breadcrumbs.length - 1 && <i className="ph ph-caret-left breadcrumb-sep" />}
              </span>
            ))}
          </nav>
        )}
      </div>

      <div className="screen-header__trailing">{trailing}</div>
    </header>
  );
}
```

**CSS to add in `mobile.css` after `.screen-header__trailing`:**
```css
.screen-header__center {
  flex: 1;
  min-width: 0;
}

.screen-header__breadcrumbs {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 0.7rem;
  opacity: 0.8;
  margin-top: 2px;
}

.breadcrumb-link {
  color: inherit;
  opacity: 0.8;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.breadcrumb-link:hover {
  opacity: 1;
}

.breadcrumb-current {
  font-weight: 600;
}

.breadcrumb-sep {
  font-size: 10px;
  opacity: 0.5;
}
```

---

### Phase 3: Services Grid Redesign

**Files:** `apps/web-user/src/styles/mobile.css` (`.service-card` rules ~line 761), `apps/web-user/src/components/ServicesScreen.tsx`

**Changes needed:**
1. `.service-card` — increase `min-height: 160px`, padding to `var(--space-4)` (32px), gap to `var(--space-2)` (16px)
2. `.service-card__icon` — increase to `font-size: 2.5rem`, add 64px gradient circle background
3. `.services-grid` — desktop breakpoint: `repeat(3, 1fr)` at 768px, `repeat(4, 1fr)` at 1024px
4. Add hover: `transform: translateY(-4px); box-shadow: 0 12px 24px rgba(10, 92, 61, 0.15);`
5. In `ServicesScreen.tsx` — wrap icon in circle div: `<span className="service-card__icon-circle" style={{ background: svc.color }}>`

---

### Phase 4: Chat Interface Redesign

**Files:** `apps/web-user/src/styles/mobile.css`, `apps/web-user/src/styles/DecisionTree.css`

**Changes needed:**
1. `.chat-messages` — add `max-width: 1200px; margin: 0 auto;` for desktop readability
2. `.msg` — increase `margin-bottom` to `var(--space-3)` (24px)
3. `.msg-bubble` — increase padding to `var(--space-2) var(--space-2)` (16px)
4. Quick prompts — enlarge to card-like: min-height 80px, icon+title+desc+arrow layout
5. Decision tree nodes — match redesign's choice-button pattern (icon left, text center, arrow right)
6. `.chat-composer` — increase gap to `var(--space-2)`, padding to `var(--space-2) var(--space-2)`
7. `.composer-btn.send` — increase to 48px or `var(--touch-comfortable)` (56px)

---

### Phase 5: Modal System Enhancement

**Files:** New `apps/web-user/src/styles/modal-premium.css`, `apps/web-user/src/components/PopupModal.tsx`

**Changes needed:**
1. Create `modal-premium.css` with:
   - `.modal-premium .modal-header` — gradient header (`linear-gradient(135deg, #0A5C3D, #12996B)`), white text, 56px icon
   - `.modal-premium .modal-body` — padding `var(--space-4)`, max-height scrollable
   - `.modal-premium .modal-footer` — flex row with primary/secondary buttons
   - `.modal-premium .form-group/label/select/slider/radio-group` — styled form elements
   - `.modal-premium .result-card` — gradient background, large amount display
   - Animations: `fadeIn` + `modalSlide`
2. Update `PopupModal.tsx` — add `variant?: 'default' | 'premium'` prop, conditionally apply `.modal-premium` class
3. Import `modal-premium.css` in `App.tsx` or `PopupModal.tsx`

---

### Phase 6: Touch Target Audit

**Files:** `apps/web-user/src/styles/mobile.css`, `apps/web-user/src/styles/TopMenu.css`

**Changes needed:**
1. `.font-btn` — increase from 36px to 44px (`var(--touch-min)`)
2. `.menu-toggle` — increase from 40px to 44px
3. `.tm-icon-btn` — increase from 40px to 44px
4. `.quick-chip` — increase min-height to 44px
5. `.action-btn` — increase padding for 44px overall height
6. Add global rule: `button, a, [role="button"] { min-height: var(--touch-min); }`
7. `.icon + .icon` — add `margin-inline-start: var(--space-2)` (16px min gap)

---

### Phase 7: Mobile Optimization

**Files:** `apps/web-user/src/styles/mobile.css`, `apps/web-user/src/styles.css`

**Changes needed:**
1. Hero title: `font-size: clamp(1.2rem, 5vw, 1.5rem)`
2. Modal title: `font-size: clamp(1.1rem, 4vw, 1.5rem)`
3. `.services-grid` small screen: `@media (max-width: 359px) { grid-template-columns: 1fr }`
4. Remove background dot pattern on dark mode in `styles.css`
5. Verify `overflow-x: hidden` on `.app-shell` and `.app-content`
6. Safe-area: `padding-top: env(safe-area-inset-top)` on `.top-menu` and `.screen-header`

---

### Phase 8: Testing & Polish

1. Open Simple Browser at 375px width — verify all touch targets ≥44px, no horizontal overflow
2. Open at 390px width — verify services grid 2-col with proper gaps
3. Open at 768px width — verify 3-col grid, search visible in top nav
4. Open at 1200px+ — verify `max-width` constraints on chat and services
5. Verify RTL: all margins/paddings use logical properties or dir-aware rules
6. Run `pnpm -r typecheck` — ensure zero regressions
7. Dark mode: toggle `prefers-color-scheme: dark` — verify all new tokens have dark overrides

---

## KEY FILE LOCATIONS

| File | Purpose | Lines of Interest |
|------|---------|-------------------|
| `apps/web-user/src/styles/mobile.css` | Main mobile CSS (2165 lines) | `:root` tokens L1-80, chat L350-500, services L680-800 |
| `apps/web-user/src/styles/elite.css` | Premium overrides (794 lines) | Uses `!important` extensively |
| `apps/web-user/src/styles/TopMenu.css` | Top nav styles (474 lines) | No search CSS yet |
| `apps/web-user/src/components/TopMenu.tsx` | Top nav component (251 lines) | Search state L30-31, JSX needs input |
| `apps/web-user/src/components/ScreenHeader.tsx` | Screen header (32 lines) | Needs breadcrumbs prop |
| `apps/web-user/src/components/ServicesScreen.tsx` | Services grid (57 lines) | Already button-based |
| `apps/web-user/src/components/ChatScreen.tsx` | Chat screen (523 lines) | Decision tree + quick prompts |
| `apps/web-user/src/components/PopupModal.tsx` | Modal component | Needs premium variant |
| `apps/web-user/src/components/Modal.tsx` | Base modal (50 lines) | Foundation for enhancement |
| `apps/web-user/src/themes/design-system.css` | Design system (876 lines) | Layout/theme system |
| `apps/web-user/src/styles/DecisionTree.css` | Decision tree styles | Needs choice-button pattern |
| `apps/web-user/src/styles/forms.css` | Form styles | Reference for form elements |

## DESIGN REFERENCE

- Primary green: `#0A5C3D` → `#12996B` (gradient)
- Gold accent: `#D4AF37`
- 8px spacing grid: 8/16/24/32/40/48px
- Min touch target: 44px
- Comfortable touch: 56px
- Icon sizes: 24/32/48/64px
- Service card min: 160×160px
- Max content width: 1200px
- Font: Cairo (already loaded)
- Icons: Phosphor (already loaded)
