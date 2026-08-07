# KB Values Editor — Full Power Control Panel

## Overview
The **KB Values Editor** is a comprehensive management interface in the Electron dashboard that provides complete control over all WatanyBot knowledge base configuration values. This includes:

- 💰 **Social Aid Rules** (pension multipliers, grants)
- 💵 **Salary Configuration** (USD rate, family allowances)
- 📊 **Business Rules** (ranks, degrees, ornaments)

## Key Features

### 1. Social Aid Rules Management
Edit all pension calculation rules and grants directly:

#### Fixed Grant (منحة مالية)
- **Default Value**: 12,000,000 LBP
- **Type**: Fixed amount
- **Use Case**: One-time grant for all ranks in 2025

**Example Edit**:
```
Original: 12,000,000 LBP
Updated:  15,000,000 LBP (if government increases grant)
```

#### Budget 2022
- **Multiplier**: 2x pension
- **Max Increase**: 12,000,000 LBP
- **Min Total**: 500,000 LBP
- **Excludes**: Family allowance & ornaments

#### Decree 11227 (18/04/2023)
- **Multiplier**: 4x pension
- **Excludes**: Family allowance & ornaments

#### Decree 11227-2 (21/9/2023)
- **Multiplier**: 3x pension
- **Floor**: 7,000,000 LBP minimum

#### Decree 13020 (28/02/2024)
- **Multiplier**: 3x pension
- **Floor**: 7,000,000 LBP minimum

### 2. Salary Configuration

#### USD Exchange Rate
- **Default**: 89,500 LBP
- **Impact**: Affects all salary calculations
- **Update Frequency**: As market changes

#### Family Allowance (Before Raise)
- **Wife**: 60,000 LBP
- **Per Child**: 33,000 LBP

#### Family Allowance (After Raise)
- **Wife**: 2,100,000 LBP
- **Per Child**: 1,160,000 LBP

### 3. Complete Workflow

#### Making Changes
1. Navigate to **KB Values Editor** (💎 icon in sidebar)
2. Locate the value you want to change
3. Click **Edit** button on the card
4. Modify values in the form
5. Click **✓ Save** to apply changes locally
6. Click **💾 Save All Changes** to persist to disk
7. Click **⚡ Reload KB into Memory** to activate immediately

#### Version Control
- All changes are automatically versioned
- Rollback available from **KB Management** page
- Each save creates a timestamped snapshot

## API Integration

The KB Values Editor uses these gateway endpoints:

```typescript
// Get current values
GET /api/admin/kb/rules
Response: {
  rules: { usdRate, familyAllowance, ... },
  socialAids: { budget_2022, decree_11227, grant_12m, ... }
}

// Update values
PATCH /api/admin/kb/rules
Body: { socialAids: { grant_12m: { amount: 15000000 } } }

// Save to disk
POST /api/admin/kb/save

// Reload into memory
POST /api/admin/kb/reload
```

## Real-World Example: Updating Grant Amount

**Scenario**: Government increases the fixed grant from 12M to 15M LBP in 2025.

### Steps:
1. **Open Electron Dashboard** → Click **KB Values Editor** (💎)
2. **Locate "Fixed Grant (منحة مالية)" card** (highlighted in blue)
3. **Click Edit button**
4. **Update amount**: Change `12000000` → `15000000`
5. **Click ✓ Save** (saves locally)
6. **Click 💾 Save All Changes** (persists to `rankMeta.json`)
7. **Click ⚡ Reload KB into Memory** (activates immediately)
8. **Verify**: Open Salary Calculator and test pension calculation

### Result:
- All pension calculations now include 15M grant
- Change is versioned and can be rolled back
- Web app immediately reflects new values
- No code changes or deployments needed

## Data Persistence

Values are stored in:
```
apps/gateway-api/kb_salaries_v2/rankMeta.json
```

Structure:
```json
{
  "usdRate": 89500,
  "familyAllowance": { "wife": 60000, "perChild": 33000 },
  "socialAids": {
    "grant_12m": { "type": "fixed", "amount": 12000000 },
    "budget_2022": { "type": "multiplier_with_caps", "multiplier": 2, ... },
    ...
  }
}
```

## Safety Features

1. **Validation**: All inputs are type-checked (numbers only)
2. **Versioning**: Every save creates a backup
3. **Rollback**: Restore previous values from versions table
4. **Hot-reload**: Changes apply without restarting servers
5. **Audit Trail**: All changes logged with timestamp

## Advanced: Adding New Rules

To add a new social aid rule:

1. **In KB Values Editor**:
   - Edit `socialAids` object
   - Add new rule with appropriate type

2. **Rule Types**:
   - `fixed`: Single amount (e.g., grant)
   - `multiplier`: Simple multiplier
   - `multiplier_with_floor`: Multiplier with minimum
   - `multiplier_with_caps`: Multiplier with min/max constraints

3. **Example — New 2026 Decree**:
```json
{
  "decree_2026": {
    "type": "multiplier_with_floor",
    "multiplier": 5,
    "base_excludes": ["family_allowance", "ornaments"],
    "floor": 10000000
  }
}
```

## Troubleshooting

### Changes Not Appearing
1. Check browser console for errors
2. Verify gateway is running (port 8010)
3. Click **Reload KB into Memory**
4. Hard refresh web app (Ctrl+Shift+R)

### Value Reverts After Save
- Check file permissions on `rankMeta.json`
- Verify gateway has write access to KB directory
- Check gateway logs for save errors

### Calculation Still Uses Old Value
- Must reload KB into memory after saving
- May need to restart gateway in some cases
- Clear browser cache if values are cached

## Future Enhancements

Planned features:
- [ ] Bulk import from Excel
- [ ] Direct SQLite database editor
- [ ] Real-time calculation preview
- [ ] Multi-user change approval workflow
- [ ] REST API key management for external integrations

## Support

For issues or questions:
- Check gateway logs: `apps/gateway-api/logs/`
- Verify KB file integrity: Run `watany_app_doctor.ps1`
- Rollback if needed: Use KB Versions table

---

**Last Updated**: February 2026  
**Version**: 1.0.0  
**Component**: desktop-admin/KB Values Editor
