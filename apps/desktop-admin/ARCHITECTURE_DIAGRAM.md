# WatanyBot KB Management Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    ELECTRON DESKTOP ADMIN                        │
│                    (desktop-admin app)                           │
│                    Port: Standalone Desktop App                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  📊 Dashboard│  │  📚 KB Mgmt  │  │ 💎 KB Values │          │
│  │              │  │              │  │    Editor    │  ← NEW!  │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  🔧 Rules    │  │  📝 Salary   │  │  🎫 Tickets  │          │
│  │   Engine     │  │   Editor     │  │  & Cases     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  🤖 AI &     │  │  💰 Salary   │  │  🛒 Plugins  │          │
│  │   Learning   │  │  Calculator  │  │  & Market    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────┐                                               │
│  │  ⚙️ App Mgmt │                                               │
│  └──────────────┘                                               │
│                                                                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ HTTP/IPC
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FASTIFY GATEWAY API                            │
│                   (gateway-api)                                  │
│                   Port: 4000                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  API ENDPOINTS:                                                  │
│                                                                  │
│  GET    /api/admin/kb/rules          ← Get current KB config    │
│  PATCH  /api/admin/kb/rules          ← Update KB config         │
│  POST   /api/admin/kb/save           ← Persist to disk          │
│  POST   /api/admin/kb/reload         ← Hot-reload into memory   │
│  GET    /api/admin/kb/versions       ← List all versions        │
│  POST   /api/admin/kb/versions/...   ← Rollback to version      │
│  GET    /api/admin/kb/chunks         ← List RAG chunks          │
│  PATCH  /api/admin/kb/chunk/:id      ← Edit chunk text          │
│  POST   /api/salary/calc             ← Calculate salary         │
│                                                                  │
│  IN-MEMORY KB:                                                   │
│  - app.kb (runtime knowledge base)                              │
│  - app.kb.rankMeta (salary rules)                               │
│  - app.kb.salariesIndex (salary table)                          │
│  - app.kb.socialAids (pension rules) ← NEW!                     │
│                                                                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ File I/O
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FILE SYSTEM                                 │
│              (apps/gateway-api/kb_salaries_v2/)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📄 rankMeta.json                                                │
│  ├─ usdRate: 89500                                               │
│  ├─ familyAllowance: { wife: 60000, perChild: 33000 }           │
│  ├─ familyAllowanceAfterRaise: { wife: 2100000, ... }           │
│  ├─ ranks: [...]                                                 │
│  ├─ ornamentChoices: [...]                                       │
│  └─ socialAids:                                                  │
│      ├─ grant_12m: { type: "fixed", amount: 12000000 }          │
│      ├─ budget_2022: { type: "multiplier_with_caps", ... }      │
│      ├─ decree_11227: { type: "multiplier", ... }               │
│      ├─ decree_11227_2: { type: "multiplier_with_floor", ... }  │
│      └─ decree_13020: { type: "multiplier_with_floor", ... }    │
│                                                                  │
│  📁 versions/                                                    │
│  ├─ 2026-02-19_143022_rankMeta.json                             │
│  ├─ 2026-02-19_150315_rankMeta.json                             │
│  └─ ...                                                          │
│                                                                  │
│  📄 salariesByRank_*.json                                        │
│  📄 ornaments.json                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow: Editing Grant Amount

```
┌──────────────────────────────────────────────────────────────────────┐
│                          USER ACTION                                  │
│  1. Opens Electron → KB Values Editor                                │
│  2. Clicks Edit on "Fixed Grant" card                                │
│  3. Changes amount: 12000000 → 15000000                              │
│  4. Clicks ✓ Save                                                    │
│  5. Clicks 💾 Save All Changes                                       │
│  6. Clicks ⚡ Reload KB into Memory                                  │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      REACT STATE UPDATE                               │
│  tempValue.amount = 15000000                                         │
│  socialAids.grant_12m.amount = 15000000                              │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      API CALL (PATCH)                                 │
│  PATCH /api/admin/kb/rules                                           │
│  Body: {                                                             │
│    socialAids: {                                                     │
│      grant_12m: { type: "fixed", amount: 15000000 }                 │
│    }                                                                 │
│  }                                                                   │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    GATEWAY PROCESSING                                 │
│  1. Receives patch request                                           │
│  2. Updates kb.rankMeta.socialAids.grant_12m                         │
│  3. Writes to rankMeta.json                                          │
│  4. Creates version backup in versions/                              │
│  5. Returns success                                                  │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      FILE WRITE                                       │
│  apps/gateway-api/kb_salaries_v2/rankMeta.json                       │
│  {                                                                   │
│    ...                                                               │
│    "socialAids": {                                                   │
│      "grant_12m": {                                                  │
│        "type": "fixed",                                              │
│        "amount": 15000000  ← UPDATED                                 │
│      }                                                               │
│    }                                                                 │
│  }                                                                   │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      RELOAD INTO MEMORY                               │
│  POST /api/admin/kb/reload                                           │
│  1. Re-reads rankMeta.json from disk                                 │
│  2. Updates app.kb.rankMeta in-memory                                │
│  3. Salary calculator now uses 15M grant                             │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         RESULT                                        │
│  ✅ All pension calculations now include 15M LBP grant               │
│  ✅ Change persisted to disk                                         │
│  ✅ Change versioned (can rollback)                                  │
│  ✅ No restart required                                              │
└──────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

```
KBValuesEditorPage.tsx
├── State Management
│   ├── socialAids (grant, decrees)
│   ├── salaryConfig (USD rate, allowances)
│   ├── editingRule (current edit mode)
│   └── tempValue (temporary edit buffer)
│
├── UI Sections
│   ├── Page Header (title + subtitle)
│   ├── Controls Bar (save, reload, export)
│   ├── Social Aid Rules
│   │   ├── Fixed Grant Card (highlighted)
│   │   ├── Budget 2022 Card
│   │   ├── Decree 11227 Card
│   │   ├── Decree 11227-2 Card
│   │   └── Decree 13020 Card
│   ├── Salary Configuration
│   │   ├── USD Rate
│   │   ├── Family Allowance (Before)
│   │   └── Family Allowance (After)
│   ├── Version Control Section
│   └── Quick Actions
│
└── Functions
    ├── loadAllKBData()
    ├── saveAllChanges()
    ├── updateSocialAidValue()
    ├── updateSalaryConfigValue()
    ├── startEdit() / cancelEdit() / saveEdit()
    └── API integrations
```

## Security & Safety

```
┌─────────────────────────────────────────────┐
│          SAFETY MECHANISMS                  │
├─────────────────────────────────────────────┤
│                                             │
│  1. Validation                              │
│     └─ Type checking (numbers only)         │
│                                             │
│  2. Versioning                              │
│     └─ Every save = automatic backup        │
│                                             │
│  3. Rollback                                │
│     └─ Restore any previous version         │
│                                             │
│  4. Separate Edit Buffer                    │
│     └─ Changes isolated until confirmed     │
│                                             │
│  5. Hot-Reload                              │
│     └─ No restart = no downtime             │
│                                             │
│  6. Audit Trail                             │
│     └─ All changes logged with timestamp    │
│                                             │
└─────────────────────────────────────────────┘
```

---

**System Status**: ✅ Fully Operational  
**Last Updated**: February 20, 2026
