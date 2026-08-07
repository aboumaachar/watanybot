# ENV_SECRET_HARDENING_REPORT.md

Date: 2026-05-12T17:43:22

## JWT_SECRET Findings

[
    {
        "File":  ".\\.env.production",
        "Key":  "JWT_SECRET",
        "Length":  45,
        "Weak":  false,
        "TemplateFile":  false
    },
    {
        "File":  ".\\apps\\gateway-api\\.env",
        "Key":  "JWT_SECRET",
        "Length":  50,
        "Weak":  false,
        "TemplateFile":  false
    },
    {
        "File":  ".\\apps\\api-backend\\.env.example",
        "Key":  "JWT_SECRET",
        "Length":  42,
        "Weak":  false,
        "TemplateFile":  true
    },
    {
        "File":  ".\\apps\\api-backend\\.env.source",
        "Key":  "JWT_SECRET",
        "Length":  42,
        "Weak":  false,
        "TemplateFile":  true
    }
]

## Required Action

- Any JWT_SECRET with Weak=true must be rotated before production.
- Never commit real production secrets.
- Use .env.production.example placeholders only.

## Generated

- apps/gateway-api/.env.production.example
