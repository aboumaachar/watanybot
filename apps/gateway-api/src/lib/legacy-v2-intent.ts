import fs from "node:fs";
import path from "node:path";

type StringArrayMap = Record<string, string[]>;
type RouterConfig = {
  request_types?: StringArrayMap;
  domains?: StringArrayMap;
  menu?: unknown[];
};
type IntentDefinition = {
  name: string;
  required_slots?: string[];
  slot_questions_lb?: Record<string, string>;
};
type IntentsConfig = { intents?: IntentDefinition[] };
type LexiconConfig = { lb_to_formal?: Record<string, string> };
type LegacyData = { router: RouterConfig; intents: IntentsConfig; lexicon: LexiconConfig };

export type LegacyV2IntentContext = { slots_filled?: Record<string, unknown> };
export type LegacyV2IntentResult = {
  intent: string;
  domain: string;
  request_type: string;
  urgency: string;
  slots_filled: Record<string, unknown>;
  slots_missing: string[];
  next_question_lb: string;
  confidence: number;
  menu: unknown[];
  normalized_text: string;
};

const AR_NUM = "٠١٢٣٤٥٦٧٨٩";
const EN_NUM = "0123456789";
const URGENCY_KEYWORDS: Record<string, string[]> = {
  high: ["ضروري", "مستعجل", "فوراً", "بكرا آخر يوم", "نهائي", "مستعجلة", "ضرورة", "عاجل"],
  medium: ["مهلة", "خلال شهر", "قبل", "لازم"],
  normal: [],
};

const SLOT_PATTERNS: Record<string, Array<[RegExp, string]>> = {
  service_branch: [
    [/(جيش|القوات المسلحة|LAF|laf)/, "الجيش اللبناني"],
    [/(قوى الأمن|أمن داخلي|ISF|isf)/, "قوى الأمن الداخلي"],
    [/(أمن عام|المديرية العامة)/, "الأمن العام"],
    [/(أمن الدولة)/, "أمن الدولة"],
    [/(جمرك|جمارك)/, "الجمارك"],
  ],
  beneficiary: [
    [/(زوجت?ي?|مرتي|زوجة)/, "الزوجة"],
    [/(ابن|ولد|ولاد|أولاد)/, "أبناء"],
    [/(بنت|بنات)/, "بنات"],
    [/(والد|أبو|أبي|بيّي)/, "الوالد"],
    [/(والدة|أم|إمي)/, "الوالدة"],
    [/(إل[كي]|أنا|لحالي)/, "أنا"],
  ],
  aid_type: [
    [/(مدرس|جامع|دراس)/, "مدرسية"],
    [/(مرض|طبي|صحي|استشفاء|دواء)/, "مرضية"],
    [/(اجتماعي|عائلي|زواج|وفاة|مولود)/, "اجتماعية"],
  ],
};

let cachedData: (LegacyData & { dir: string }) | null = null;

function readJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
  return JSON.parse(raw) as T;
}

export function getLegacyV2IntentDataCandidates(basePath = process.cwd()): string[] {
  return [
    path.resolve(basePath, "../api-backend/data/kb_v2"),
    path.resolve(basePath, "apps/api-backend/data/kb_v2"),
  ];
}
export function resolveLegacyV2IntentDataDir(candidates = getLegacyV2IntentDataCandidates()): string | null {
  for (const candidate of candidates) {
    const required = ["router.json", "intents.json", "lexicon.json"];
    if (required.every((name) => fs.existsSync(path.join(candidate, name)))) return candidate;
  }
  return null;
}

function loadData(dataDir?: string): LegacyData {
  const dir = dataDir || resolveLegacyV2IntentDataDir();
  if (!dir) throw new Error("LEGACY_V2_INTENT_DATA_NOT_FOUND");
  if (cachedData?.dir === dir) return cachedData;
  const loaded = {
    dir,
    router: readJson<RouterConfig>(path.join(dir, "router.json")),
    intents: readJson<IntentsConfig>(path.join(dir, "intents.json")),
    lexicon: readJson<LexiconConfig>(path.join(dir, "lexicon.json")),
  };
  cachedData = loaded;
  return loaded;
}

function normalizeDigits(text: string): string {
  let out = text;
  for (let i = 0; i < AR_NUM.length; i += 1) out = out.split(AR_NUM[i]).join(EN_NUM[i]);
  return out;
}
function normalizeLb(text: string, lexicon: LexiconConfig): string {
  let out = (text || "").replace(/\u00a0/g, " ").replace(/\r/g, " ").trim();
  out = out.replace(/[ \t]+/g, " ");
  out = normalizeDigits(out);
  const replacements = Object.entries(lexicon.lb_to_formal || {}).sort((a, b) => b[0].length - a[0].length);
  for (const [key, value] of replacements) {
    if (key && out.includes(key)) out = out.split(key).join(value);
  }
  return out;
}

function keywordScore(text: string, keywords: string[]): number {
  let score = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword)) score += keyword.length >= 6 ? 2 : 1;
  }
  return score;
}

function detectDomain(text: string, rawText: string, router: RouterConfig): [string, number] {
  const combined = `${text} ${rawText}`;
  let best = "general";
  let bestScore = 0;
  for (const [domain, keywords] of Object.entries(router.domains || {})) {
    const score = keywordScore(combined, keywords);
    if (score > bestScore) {
      bestScore = score;
      best = domain;
    }
  }
  return [best, Math.min(bestScore / 5, 1)];
}

function detectRequestType(text: string, router: RouterConfig): string {
  let best = "info";
  let bestScore = 0;
  for (const [requestType, keywords] of Object.entries(router.request_types || {})) {
    const score = keywordScore(text, keywords);
    if (score > bestScore) {
      bestScore = score;
      best = requestType;
    }
  }
  return best;
}

function detectUrgency(text: string): string {
  for (const level of ["high", "medium"]) {
    if (URGENCY_KEYWORDS[level].some((keyword) => text.includes(keyword))) return level;
  }
  return "normal";
}
function extractSlots(text: string): Record<string, unknown> {
  const slots: Record<string, unknown> = {};
  for (const [slot, patterns] of Object.entries(SLOT_PATTERNS)) {
    for (const [pattern, value] of patterns) {
      if (pattern.test(text)) {
        slots[slot] = value;
        break;
      }
    }
  }
  return slots;
}

function findIntent(intents: IntentDefinition[], name: string): IntentDefinition | null {
  return intents.find((intent) => intent.name === name) || null;
}

function matchIntent(
  domain: string,
  requestType: string,
  slots: Record<string, unknown>,
  text: string,
  config: IntentsConfig,
): [string, { missing: string[]; slotQuestions: Record<string, string> }] {
  const intents = config.intents || [];
  let bestIntent: IntentDefinition | null = null;
  let bestScore = -1;
  const domainIntentMap: Record<string, string> = {
    pension: "pension_eligibility",
    severance: "pension_eligibility",
    survivors: "survivor_pension",
    medical: "renew_social_card",
    school: "aid_request",
    salary: "salary_compute",
    payments: "pension_eligibility",
  };
  const requestIntentMap: Record<string, string> = {
    problem: "complaint_appeal",
    phonebook: "directory_links",
    responsible: "directory_links",
    salary: "salary_compute",
  };

  if (["اعتراض", "اعترض", "شكوى", "شكوى رسمية"].some((keyword) => text.includes(keyword))) {
    requestIntentMap._override = "complaint_appeal";
  }
  if (["قديش معاشي", "بينحسب", "احتساب", "كيف بينحسب"].some((keyword) => text.includes(keyword))) {
    domainIntentMap._override = "salary_compute";
  }
  if (["توفي", "توفه", "توفى", "مات", "ميت", "ورثة"].some((keyword) => text.includes(keyword))) {
    domainIntentMap._override = "survivor_pension";
  }
  if (domainIntentMap._override) {
    bestIntent = findIntent(intents, domainIntentMap._override);
    if (bestIntent) bestScore = 10;
  }
  if (requestIntentMap._override) {
    const candidate = findIntent(intents, requestIntentMap._override);
    if (candidate) {
      bestIntent = candidate;
      bestScore = Math.max(bestScore, 11);
    }
  }
  if (bestScore < 3 && domainIntentMap[domain]) {
    const candidate = findIntent(intents, domainIntentMap[domain]);
    if (candidate) {
      bestIntent = candidate;
      bestScore = Math.max(bestScore, 3);
    }
  }
  if (bestScore < 4 && requestIntentMap[requestType]) {
    const candidate = findIntent(intents, requestIntentMap[requestType]);
    if (candidate) {
      bestIntent = candidate;
      bestScore = Math.max(bestScore, 4);
    }
  }
  if (!bestIntent) bestIntent = findIntent(intents, "other") || intents[0] || null;
  if (!bestIntent) return ["other", { missing: [], slotQuestions: {} }];

  const required = bestIntent.required_slots || [];
  const missing = required.filter((slot) => !(slot in slots));
  return [
    bestIntent.name,
    { missing, slotQuestions: bestIntent.slot_questions_lb || {} },
  ];
}

export function resolveLegacyV2Intent(
  userMessage: string,
  context: LegacyV2IntentContext | undefined,
  dataDir?: string,
): LegacyV2IntentResult {
  const raw = String(userMessage || "").trim();
  const { router, intents, lexicon } = loadData(dataDir);
  const text = normalizeLb(raw, lexicon);
  const [domain, domainConfidence] = detectDomain(text, raw, router);
  const requestType = detectRequestType(`${text} ${raw}`, router);
  const urgency = detectUrgency(text);
  const slots = extractSlots(text);
  const previousSlots = context?.slots_filled && typeof context.slots_filled === "object"
    ? context.slots_filled
    : {};
  for (const [key, value] of Object.entries(previousSlots)) {
    if (!(key in slots)) slots[key] = value;
  }

  const [intent, slotInfo] = matchIntent(domain, requestType, slots, text, intents);
  const nextQuestion = slotInfo.missing.length > 0
    ? slotInfo.slotQuestions[slotInfo.missing[0]] || `خبرني ${slotInfo.missing[0]}؟`
    : "";
  const confidence = Math.min(
    domainConfidence + (Object.keys(slots).length > 0 ? 0.15 : 0) + (requestType !== "info" ? 0.1 : 0),
    1,
  );

  return {
    intent,
    domain,
    request_type: requestType,
    urgency,
    slots_filled: slots,
    slots_missing: slotInfo.missing,
    next_question_lb: nextQuestion,
    confidence: Number(confidence.toFixed(2)),
    menu: Array.isArray(router.menu) ? router.menu : [],
    normalized_text: text,
  };
}
