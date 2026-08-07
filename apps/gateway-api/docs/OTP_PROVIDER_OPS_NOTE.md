# OTP Provider Ops Note

Status visibility for the OTP provider is log-based in this phase.

- Startup: the gateway logs `OTP provider configured` with `otpProvider`, `smsProvider`, `whatsappMode`, and `whatsappAccountNumber`.
- Request success: the gateway logs `OTP request sent` with masked phone number plus current daily phone/IP counters.
- Request failure: the gateway logs `OTP request send failed` and `OTP request cleanup failed after provider error` without logging the OTP code.
- Cooldown and limits: the gateway logs `OTP request blocked by resend cooldown`, `OTP request blocked by daily phone limit`, and `OTP request blocked by daily IP limit`.
- Verification audit: `audit_log` records `otp.verify.success` and `otp.verify.failed` with the phone number and failure reason.
- Approved dev WhatsApp simulation logs `[OTP:whatsapp:simulate]` with a JSON payload containing `accountNumber`, `to`, and the OTP text body.

Suggested operational checks:

```sql
SELECT action, COUNT(*)
FROM audit_log
WHERE action IN ('otp.verify.success', 'otp.verify.failed')
  AND created_at >= date_trunc('day', now())
GROUP BY action;
```

```sql
SELECT COUNT(*)::int AS daily_sends
FROM phone_otps
WHERE created_at >= date_trunc('day', now());
```

Required production environment variables for Twilio SMS:

```env
OTP_PROVIDER=sms
SMS_PROVIDER=twilio
SMS_ACCOUNT_SID=
SMS_AUTH_TOKEN=
SMS_FROM=
OTP_TTL_MINUTES=10
OTP_MAX_ATTEMPTS=5
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_DAILY_LIMIT_PER_PHONE=10
OTP_DAILY_LIMIT_PER_IP=30
```

Required production environment variables for WhatsApp Cloud API:

```env
OTP_PROVIDER=whatsapp
WHATSAPP_OUTBOUND_MODE=live
WHATSAPP_ACCOUNT_NUMBER=
WHATSAPP_API_URL=https://graph.facebook.com/v17.0
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
OTP_TTL_MINUTES=10
OTP_MAX_ATTEMPTS=5
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_DAILY_LIMIT_PER_PHONE=10
OTP_DAILY_LIMIT_PER_IP=30
```

Approved local proof configuration for WhatsApp simulation:

```env
OTP_PROVIDER=whatsapp
WHATSAPP_OUTBOUND_MODE=simulate
WHATSAPP_ACCOUNT_NUMBER=+96181396332
WHATSAPP_TEST_RECEIVER_NUMBER=+9613156789
```

For live WhatsApp proof without writing secrets to disk, run [scripts/run-whatsapp-otp-live-proof.ps1](scripts/run-whatsapp-otp-live-proof.ps1) from a PowerShell terminal. It prompts for `WHATSAPP_API_TOKEN` directly in-terminal, sets process-only env overrides, stops any stale local gateway on port 8010, and runs the strict and delivery proof scripts against the live provider path. Use `WHATSAPP_ACCOUNT_NUMBER` as the sender account and `WHATSAPP_TEST_RECEIVER_NUMBER` or `-WhatsAppReceiverNumber` as the OTP recipient under proof.