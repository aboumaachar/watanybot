# Accessibility UX (Voice-First)

## Voice-first behavior

- New WhatsApp users default to voice-first mode.
- If you prefer text only, send: `كتابة فقط`.
- To mute voice guidance: `كتم` or `mute`.
- To re-enable voice guidance: `تشغيل الصوت` or `unmute`.

## Dictation flow

- Voice messages are transcribed when STT is enabled.
- If transcription fails, the bot asks for 1–2 keywords or a slower resend.

## Multimodal handling

- Images/Documents: The bot asks a single question to classify the document.
- Location: The bot confirms next steps with 3 options.

## Arabizi and garbled text

- If a message is unclear, the bot asks:
  - "هل تقصد (1) <candidate1> أم (2) <candidate2> ؟"

## TTS fallback

- If `TTS_ENABLED=true` and a provider is configured, replies can include audio.
- Otherwise, responses remain short text.
