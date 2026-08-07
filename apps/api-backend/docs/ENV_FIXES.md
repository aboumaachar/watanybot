# Environment Fixes (WhatsApp Readiness)

## Required WhatsApp env vars

Set these variables in your `.env` (or environment):

- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`

## Optional signature verification

- `WHATSAPP_APP_SECRET` (recommended if you validate webhook signatures)

## Example placeholders

```dotenv
WHATSAPP_TOKEN=YOUR_LONG_LIVED_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID=YOUR_PHONE_NUMBER_ID
WHATSAPP_VERIFY_TOKEN=YOUR_VERIFY_TOKEN
WHATSAPP_APP_SECRET=YOUR_APP_SECRET
```

## Where to get the values

- Meta Business Manager:
  - App Dashboard -> WhatsApp -> Getting Started
  - Find the Phone Number ID and generate an access token.
  - Set your Verify Token to match your webhook configuration.
  - App Secret is available under App Settings -> Basic.
