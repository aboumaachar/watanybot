export const WATANY_CHATBOT_FEATURE = "01_ai_chatbot_core" as const;

export const WATANY_CHATBOT_SCOPE_POLICY = {
  productName: "WatanyBot / موطني",
  audience: "Lebanese retired military personnel and their families",
  answerStyle: "Arabic-first, elderly-friendly, guided, short, and grounded in approved knowledge sources",
  safetyRule: "Do not guess variable legal/payment facts. Ask for clarification or escalate to admin-controlled knowledge when grounding is missing.",
} as const;

export const WATANY_MAIN_CHOICES = [
  "المعاشات والتعويضات",
  "الطبابة والاستشفاء",
  "المدارس والمنح",
  "القوانين والإجراءات",
  "او شي تاني",
] as const;

export type WatanyGroundingSource = {
  id: string;
  title: string;
  url?: string;
  excerpt?: string;
};

export type WatanyAnswerPolicyResult = {
  answer: string;
  grounded: boolean;
  sourceIds: string[];
  requiresAdminReview: boolean;
};

const ARABIZI_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\\b(ma3ach|maash|maeche|m3ash)\\b/gi, "معاش"],
  [/\\b(ta3wid|taawid|ta3widat|taawidat)\\b/gi, "تعويضات"],
  [/\\b(tebabe|tibabe|tababe|istichfa|estechfa)\\b/gi, "طبابة"],
  [/\\b(madrase|madaris|madrasiye|school grant|school grants)\\b/gi, "مدارس"],
  [/\\b(qanoun|qawanin|kanoon|kawanin|ijra2at|ijraat)\\b/gi, "قوانين وإجراءات"],
  [/\\b(moteqa3ed|moutakaed|moutaka3ed|retired military|veteran)\\b/gi, "متقاعد عسكري"],
];

const KEYBOARD_CONFUSION_REPLACEMENTS: Array<[string, string]> = [
  ["hgluhahj", "المعاشات"],
  ["hgjurdhhj", "التعويضات"],
  ["hgjfhfm", "الطبابة"],
  ["hgl]hvs", "المدارس"],
  ["hgr,hkdk", "القوانين"],
  ["hgh[vhxhj", "الإجراءات"],
];

export function normalizeWatanyUserInput(input: string): string {
  let output = input.normalize("NFKC").trim();
  for (const [pattern, replacement] of ARABIZI_REPLACEMENTS) {
    output = output.replace(pattern, replacement);
  }
  for (const [typedText, replacement] of KEYBOARD_CONFUSION_REPLACEMENTS) {
    output = output.split(typedText).join(replacement);
  }
  return output.replace(/\\s+/g, " ");
}

export function buildWatanySystemPrompt(extraInstruction = ""): string {
  const base = [
    "أنت وطني، مساعد رقمي مخصص للمتقاعدين العسكريين اللبنانيين وعائلاتهم.",
    "أجب بالعربية أولاً وبأسلوب واضح وقصير ومناسب لكبار السن.",
    "لا تقدّم إجابات عامة عندما يكون السؤال مرتبطاً بالمعاشات أو التعويضات أو الطبابة أو المدارس أو الإجراءات.",
    "اعتمد على قاعدة المعرفة والمصادر المعتمدة، وعند غياب المصدر قل ذلك بوضوح واقترح تحويل السؤال للإدارة.",
    "اعرض خيارات متابعة بسيطة، ويجب أن تشمل الخيارات: او شي تاني.",
  ];
  if (extraInstruction.trim().length > 0) {
    base.push(extraInstruction.trim());
  }
  return base.join("\\n");
}

export function buildGroundedWatanyAnswer(params: { question: string; sources: WatanyGroundingSource[]; draftedAnswer?: string }): WatanyAnswerPolicyResult {
  const sourceIds = params.sources.map((source) => source.id).filter(Boolean);
  const hasGrounding = sourceIds.length > 0;
  if (!hasGrounding) {
    return {
      answer: "ما لقيت مصدر موثوق كافي ضمن قاعدة المعرفة للإجابة بدقة. فيك تختار او شي تاني أو نرسل السؤال للإدارة للتأكيد.",
      grounded: false,
      sourceIds: [],
      requiresAdminReview: true,
    };
  }
  return {
    answer: params.draftedAnswer && params.draftedAnswer.trim().length > 0 ? params.draftedAnswer.trim() : "تم العثور على مصادر مرتبطة بسؤالك ضمن قاعدة المعرفة.",
    grounded: true,
    sourceIds,
    requiresAdminReview: false,
  };
}

export function getWatanyMainChoices(): string[] {
  return [...WATANY_MAIN_CHOICES];
}

export function assertWatanyFeature01Contract(): true {
  if (!WATANY_MAIN_CHOICES.includes("او شي تاني")) {
    throw new Error("Watany main choices must include او شي تاني.");
  }
  const prompt = buildWatanySystemPrompt();
  if (!prompt.includes("المتقاعدين العسكريين") || !prompt.includes("قاعدة المعرفة")) {
    throw new Error("Watany chatbot system prompt is missing required veteran/KB scope.");
  }
  const fallback = buildGroundedWatanyAnswer({ question: "ما هو وضعي؟", sources: [] });
  if (fallback.grounded || !fallback.requiresAdminReview) {
    throw new Error("Ungrounded Watany answers must require admin review.");
  }
  return true;
}
