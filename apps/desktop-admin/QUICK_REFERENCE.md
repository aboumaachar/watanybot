# Quick Reference: KB Values Editor

## Access
**Electron Dashboard** → **💎 KB Values Editor** (3rd item in sidebar)

## Common Tasks

### Change Grant Amount (e.g., 12M → 15M LBP)
1. Click **💎 KB Values Editor**
2. Find blue **"Fixed Grant"** card
3. Click **Edit**
4. Change amount: `15000000`
5. Click **✓ Save**
6. Click **💾 Save All Changes**
7. Click **⚡ Reload KB into Memory**

**Done!** All pensions now use 15M grant.

---

### Update USD Rate
1. Go to **Salary Configuration** section
2. Change **USD Exchange Rate** input
3. Click **💾 Save All Changes**
4. Click **⚡ Reload KB into Memory**

---

### Modify Decree Multiplier
1. Find the decree card (e.g., "Decree 13020")
2. Click **Edit**
3. Change **Multiplier** or **Floor** value
4. Click **✓ Save**
5. Click **💾 Save All Changes**
6. Click **⚡ Reload KB into Memory**

---

## Important Values

| Value | Location | Default |
|-------|----------|---------|
| Grant 2025 | Social Aids → Fixed Grant | 12,000,000 LBP |
| USD Rate | Salary Config → USD Exchange Rate | 89,500 LBP |
| Family Allowance (Wife) | Salary Config → Before Raise | 60,000 LBP |
| Family Allowance (Wife After) | Salary Config → After Raise | 2,100,000 LBP |
| Budget 2022 Cap | Social Aids → Budget 2022 | 12,000,000 LBP |

---

## Button Quick Reference

| Button | Action |
|--------|--------|
| **💾 Save All Changes** | Write to disk (rankMeta.json) |
| **🔄 Reload Data** | Refresh from disk (discard unsaved) |
| **⚡ Reload KB into Memory** | Activate saved changes |
| **🔢 Recalculate All** | Recompute salary values |
| **💾 Export KB Snapshot** | Create backup |

---

## Workflow Pattern

```
Edit values → Save locally (✓) → Save All (💾) → Reload (⚡) → Verify
```

Always follow this sequence for changes to take effect.

---

## Rollback a Change

1. Go to **📚 KB Management** page
2. Click **Versions** section
3. Find the version before your change
4. Click **Rollback**
5. Click **⚡ Reload KB into Memory**

---

## Files Modified

All changes save to:
```
apps/gateway-api/kb_salaries_v2/rankMeta.json
```

Backups created automatically in:
```
apps/gateway-api/kb_salaries_v2/versions/
```

---

## Troubleshooting

**Changes not appearing?**
→ Click **⚡ Reload KB into Memory**

**Button grayed out?**
→ Gateway not running. Start it:
```powershell
cd apps/gateway-api
node --env-file=.env --import tsx src/server.ts
```

**Values reverted?**
→ You didn't click "Save All Changes" before reload

---

## API Endpoints (for integrations)

```http
GET    /api/admin/kb/rules         # Get current values
PATCH  /api/admin/kb/rules         # Update values
POST   /api/admin/kb/save          # Persist to disk
POST   /api/admin/kb/reload        # Hot-reload into memory
```

---

**Version**: 1.0.0  
**Last Updated**: Feb 2026
