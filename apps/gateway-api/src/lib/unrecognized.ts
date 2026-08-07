/**
 * Unrecognized input logging and clarify response generation.
 * Extracted from server.ts.
 */
import fs from "node:fs";
import path from "node:path";

export interface UnrecognizedEntry {
  ts: string;
  message: string;
  userId: string;
  channel: string;
  reason: string;
}

let _logPath = "";

export function initUnrecognizedLog(dataDir: string): void {
  _logPath = path.resolve(dataDir, "unrecognized_inputs.jsonl");
}

export function logUnrecognizedInput(entry: UnrecognizedEntry): void {
  if (!_logPath) return;
  try {
    const dir = path.dirname(_logPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(_logPath, JSON.stringify(entry) + "\n", "utf8");
  } catch (err) {
    console.warn("[unrecognized-log] Failed to write:", err);
  }
}

const _CLARIFY_RESPONSES = [
  "ما فهمت عليك منيح، فيك توضحلي أكتر شو قصدك؟ أنا بقدر ساعدك بمواضيع التقاعد والرواتب والطبابه والمعاملات.",
  "سؤالك ما وصلني واضح. فيك تحكيلي بطريقة تانية؟ أنا مساعدك بشؤون المتقاعدين العسكريين.",
  "معليش ما قدرت أفهم. حاول اسأل سؤال محدد — مثلاً عن الراتب التقاعدي أو معاملة معينة.",
];

export function getRandomClarifyResponse(): string {
  return _CLARIFY_RESPONSES[Math.floor(Math.random() * _CLARIFY_RESPONSES.length)];
}
