# WatanyBot SMSAPI OTP Plugin

Purpose:
WatanyBot can run an SMSAPI-compatible OTP provider internally without requiring the external SMSAPI engine.

Modes:

1. standalone
Generates and verifies OTP inside WatanyBot. Does not send WhatsApp messages.

2. whatsapp-local
Generates OTP inside WatanyBot and dispatches the message through a WhatsApp local gateway.

Local standalone test:

SMSAPI_PLUGIN_MODE=standalone
SMSAPI_OTP_SENDER_PHONE=+96181396332
SMSAPI_STANDALONE_EXPOSE_CODE=true
SMSAPI_REQUIRE_DISPATCH_SUCCESS=false

Local WhatsApp gateway test:

SMSAPI_PLUGIN_MODE=whatsapp-local
SMSAPI_OTP_SENDER_PHONE=+96181396332
WHATSAPP_LOCAL_GATEWAY_URL=http://localhost:3020
WHATSAPP_LOCAL_GATEWAY_SEND_PATH=/send
SMSAPI_STANDALONE_EXPOSE_CODE=true
SMSAPI_REQUIRE_DISPATCH_SUCCESS=false

Production:

SMSAPI_PLUGIN_MODE=whatsapp-local
SMSAPI_OTP_SENDER_PHONE=+96181396332
WHATSAPP_LOCAL_GATEWAY_URL=https://your-whatsapp-gateway.example.com
WHATSAPP_LOCAL_GATEWAY_SEND_PATH=/send
WHATSAPP_LOCAL_GATEWAY_API_KEY=replace-with-server-secret
SMSAPI_STANDALONE_EXPOSE_CODE=false
SMSAPI_REQUIRE_DISPATCH_SUCCESS=true

Production requirements:
- The external SMSAPI engine on port 3012 is not required.
- Real WhatsApp delivery requires a WhatsApp local gateway with an active logged-in session.
- The logged-in WhatsApp account must be the intended sender number: +96181396332.
- SMSAPI_STANDALONE_EXPOSE_CODE must be false in production.
- SMSAPI_REQUIRE_DISPATCH_SUCCESS should be true in production.
- In-memory OTP storage is acceptable for local smoke tests and single-process pilot deployments.
- For scaled production, move OTP storage to Redis or database persistence.

Routes:
GET /api/integrations/smsapi/otp/health
POST /api/integrations/smsapi/otp/start
POST /api/integrations/smsapi/otp/check
