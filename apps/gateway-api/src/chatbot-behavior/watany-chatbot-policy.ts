export type WatanyTone = "LEBANESE_SLANG" | "FORMAL_ARABIC" | "MIXED";

export type ChatbotBehaviorDecision = {
  shouldStartWithGreeting: boolean;
  greetingAr: string;
  tone: WatanyTone;
  rewrittenUserMessage: string;
  systemInstruction: string;
};

const greetingPatterns = [
  "مرحبا",
  "مرحبتين",
  "اهلا",
  "أهلا",
  "هلا",
  "سلام",
  "السلام عليكم",
  "صباح الخير",
  "مسا الخير",
  "مساء الخير",
  "bonjour",
  "hello",
  "hi",
  "hey"
];

function normalizeArabic(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

export function userStartedWithGreeting(message: string) {
  const normalized = normalizeArabic(message);
  return greetingPatterns.some((pattern) => normalized.startsWith(normalizeArabic(pattern)));
}

export function buildLebaneseGreeting(message: string) {
  const normalized = normalizeArabic(message);

  if (normalized.startsWith("صباح")) return "صباح النور، كيف فيني ساعدك اليوم؟";
  if (normalized.startsWith("مسا") || normalized.startsWith("مساء")) return "مسا النور، كيف فيني ساعدك؟";
  if (normalized.startsWith("السلام")) return "وعليكم السلام، أهلا وسهلا فيك. كيف فيني ساعدك؟";

  return "أهلا وسهلا فيك، كيف فيني ساعدك؟";
}

export function buildWatanyBehaviorDecision(message: string): ChatbotBehaviorDecision {
  const shouldStartWithGreeting = userStartedWithGreeting(message);
  const greetingAr = shouldStartWithGreeting ? buildLebaneseGreeting(message) : "";

  return {
    shouldStartWithGreeting,
    greetingAr,
    tone: "LEBANESE_SLANG",
    rewrittenUserMessage: message,
    systemInstruction: [
      "أنت مساعد موطني للمتقاعدين العسكريين وعائلاتهم.",
      "استعمل لهجة لبنانية بسيطة وقريبة من الناس في المحادثة العادية.",
      "إذا بدأ المستخدم بتحية، ابدأ دائماً برد تحية لبناني قصير قبل الإجابة.",
      "للمواضيع القانونية أو المالية أو الصحية، اشرح باللهجة اللبنانية لكن حافظ على دقة المصطلحات الرسمية.",
      "اعطِ جواباً واضحاً ومختصراً، واسأل سؤال متابعة واحد فقط عند الحاجة.",
      "لا تخمّن؛ إذا المعلومة غير موجودة في قاعدة المعرفة، قل إنك بحاجة إلى مرجع أو تحقق إداري."
    ].join("\n")
  };
}

export function applyGreetingToAnswer(userMessage: string, answer: string) {
  const decision = buildWatanyBehaviorDecision(userMessage);
  if (!decision.shouldStartWithGreeting) return answer;

  const trimmed = answer.trim();
  if (trimmed.startsWith(decision.greetingAr)) return trimmed;
  return `${decision.greetingAr}\n\n${trimmed}`;
}