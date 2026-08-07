import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { expandArabiziAliases } from "../../utils/normalize-arabizi";
import { buildSearchTokens, normalizeSearchText } from "../../utils/normalize-arabic";
import { getDefaultWatanyTags } from "./kb-tag-index.service";

export type KbIndexSourceType =
  | "law"
  | "procedure"
  | "faq"
  | "payment"
  | "salary"
  | "document"
  | "admin-override"
  | "json"
  | "markdown"
  | "text"
  | "unknown";

export type KbIndexRecord = {
  id: string;
  kbId?: string;
  label: string;
  title: string;
  category: string;
  sourceType: KbIndexSourceType;
  sourceUrl?: string;
  tags: string[];
  aliases: string[];
  suggestedQuestions: string[];
  content: string;
  sourcePath?: string;
  priority: number;
};

export type KbWeightedSearchHit = {
  record: KbIndexRecord;
  score: number;
  matchedFields: string[];
  matchedTerms: string[];
  excerpt: string;
};

export type KbIndexStats = {
  records: number;
  sources: number;
  generatedAt: string;
  sourceRoots: string[];
  categories: Record<string, number>;
  tags: Record<string, number>;
};

type BuildIndexResult = {
  records: KbIndexRecord[];
  stats: KbIndexStats;
};

let cachedIndex: BuildIndexResult | null = null;
let cachedAt = 0;
const CACHE_MS = 30_000;
const MAX_SCAN_FILES = 1500;
const MAX_FILE_BYTES = 600_000;
const IGNORED_SCAN_PATHS = /(?:^|[\\/])(node_modules|\.git|dist|build|coverage|\.next|\.turbo|logs|\.pma|backups)(?:[\\/]|$)/i;

function uniq(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function slugify(value: string): string {
  const normalized = normalizeSearchText(value).replace(/\s+/g, "-").replace(/[^\p{L}\p{N}\-_]+/gu, "");
  return normalized.slice(0, 90) || "record";
}

function normalizeArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniq(value.flatMap((entry) => normalizeArray(entry)));
  }
  if (typeof value === "string") {
    return uniq(value.split(/[;,،|]/g).map((entry) => entry.trim()).filter(Boolean));
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }
  return [];
}

function readObjectProperty(source: Record<string, unknown>, names: string[]): unknown {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(source, name)) {
      return source[name];
    }
  }
  return undefined;
}

function collectStrings(value: unknown, limit = 140): string[] {
  const out: string[] = [];
  const visit = (entry: unknown): void => {
    if (out.length >= limit) {
      return;
    }
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (trimmed) {
        out.push(trimmed);
      }
      return;
    }
    if (typeof entry === "number" || typeof entry === "boolean") {
      out.push(String(entry));
      return;
    }
    if (Array.isArray(entry)) {
      for (const item of entry) {
        visit(item);
      }
      return;
    }
    if (entry && typeof entry === "object") {
      for (const item of Object.values(entry as Record<string, unknown>)) {
        visit(item);
      }
    }
  };
  visit(value);
  return out;
}

function toSafeString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function readStringProperty(source: Record<string, unknown>, names: string[], fallback = ""): string {
  for (const name of names) {
    if (!Object.prototype.hasOwnProperty.call(source, name)) {
      continue;
    }
    const value = toSafeString(source[name]);
    if (value) {
      return value;
    }
  }
  return fallback;
}

function inferSourceType(pathOrCategory: string, explicit?: unknown): KbIndexSourceType {
  const value = normalizeSearchText([toSafeString(explicit), pathOrCategory].join(" "));
  if (/procedure|procedures|اجراء|إجراء|معاملة|طلب/.test(value)) return "procedure";
  if (/faq|سؤال|اسئله|اسئلة|أسئلة/.test(value)) return "faq";
  if (/payment|دفعه|دفعة|مساعده|مساعدة|منحه|منحة|school|مدرس/.test(value)) return "payment";
  if (/salary|pension|راتب|معاش|تعويض|حسم/.test(value)) return "salary";
  if (/law|legal|قانون|مرسوم|تعميم/.test(value)) return "law";
  if (/admin|override/.test(value)) return "admin-override";
  return "document";
}

function inferCategory(text: string): string {
  const value = normalizeSearchText(text);
  if (/مدرس|school|منح/.test(value)) return "school-grants";
  if (/طبابه|طبابة|health|hospital|medical/.test(value)) return "healthcare";
  if (/راتب|معاش|salary|pension|تعويض|حسم/.test(value)) return "salary";
  if (/دفع|دفعه|دفعة|payment/.test(value)) return "payments";
  if (/اجراء|إجراء|معامله|معاملة|procedure|document/.test(value)) return "procedures";
  if (/عاتق|زوجة|زوجه|ابن|ابنة|ابنه|بنت|ولد|اولاد|أولاد|عائلي/.test(value)) return "family-dependents";
  return "general";
}

function inferAliasesFromText(text: string): string[] {
  const normalized = normalizeSearchText(text);
  const aliases: string[] = [];
  if (/ابنة|ابنه|بنت|daughter/.test(normalized)) {
    aliases.push("الابنة", "ابنة", "البنت", "بنت", "daughter", "dependent daughter");
  }
  if (/ابن|ولد|اولاد|أولاد|children/.test(normalized)) {
    aliases.push("ابن", "ولد", "اولاد", "الأولاد", "children", "dependents");
  }
  if (/عاتق|dependent/.test(normalized)) {
    aliases.push("على العاتق", "افراد العائلة", "أفراد العائلة", "dependent", "dependents");
  }
  if (/زوجه|زوجة|wife|spouse/.test(normalized)) {
    aliases.push("زوجة", "الزوجة", "spouse", "wife");
  }
  if (/مدرس|school/.test(normalized)) {
    aliases.push("منح مدرسية", "مدارس", "مساعدة مدرسية", "school", "school grant");
  }
  if (/طبابه|طبابة|health/.test(normalized)) {
    aliases.push("طبابة", "استشفاء", "healthcare", "medical");
  }
  if (/راتب|معاش|salary|pension/.test(normalized)) {
    aliases.push("راتب", "معاش", "تعويض", "salary", "pension");
  }
  return uniq(aliases);
}

function makeExcerpt(content: string, query: string): string {
  const clean = content.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const normalizedContent = normalizeSearchText(clean);
  const normalizedQuery = normalizeSearchText(query);
  const index = normalizedQuery ? normalizedContent.indexOf(normalizedQuery) : -1;
  if (index <= 0) {
    return clean.slice(0, 220);
  }
  const start = Math.max(0, index - 80);
  return clean.slice(start, start + 260);
}

function createRecordFromObject(input: Record<string, unknown>, sourcePath: string, fallbackIndex: number): KbIndexRecord {
  const titleValue = readStringProperty(input, ["title", "label", "labelAr", "name", "question", "heading", "subject"]);
  const idValue = readStringProperty(input, ["id", "slug", "key", "code"]);
  const contentValue = readStringProperty(input, ["content", "body", "answer", "text", "description", "summary"]);
  const explicitTags = normalizeArray(readObjectProperty(input, ["tags", "tagIds", "keywords", "categories"]));
  const explicitAliases = normalizeArray(readObjectProperty(input, ["aliases", "synonyms", "alternateLabels", "keywords"]));
  const suggestedQuestions = normalizeArray(readObjectProperty(input, ["suggestedQuestions", "followUps", "questions"]));
  const allText = uniq([titleValue, contentValue, ...collectStrings(input)]).join(" ");
  const inferredCategory = inferCategory([allText, sourcePath].join(" "));
  const inferredAliases = inferAliasesFromText(allText);
  const title = readStringProperty(input, ["title", "label", "labelAr", "name", "question", "heading", "subject"], basename(sourcePath, extname(sourcePath)) || `KB record ${fallbackIndex}`);
  const category = readStringProperty(input, ["category", "sourceCategory", "domain"], inferredCategory);
  const sourceUrlValue = readObjectProperty(input, ["sourceUrl", "officialUrl", "url", "link", "route", "path"]);
  const sourceUrl = typeof sourceUrlValue === "string" && sourceUrlValue.trim().length > 0 ? sourceUrlValue.trim() : undefined;
  const tags = uniq([...explicitTags, category, inferredCategory, ...inferredAliases.slice(0, 4).map(slugify)]);
  return {
    id: idValue || `${slugify(title)}-${fallbackIndex}`,
    kbId: readStringProperty(input, ["kbId", "knowledgeBaseId", "sourceId"], slugify(category)),
    label: title,
    title,
    category,
    sourceType: inferSourceType([category, sourcePath, title].join(" "), readObjectProperty(input, ["sourceType", "type"])),
    sourceUrl,
    tags,
    aliases: uniq([...explicitAliases, ...inferredAliases]),
    suggestedQuestions,
    content: allText,
    sourcePath,
    priority: Number(readObjectProperty(input, ["priority", "weight", "rank"]) || 30)
  };
}

function createRecordFromText(text: string, sourcePath: string, fallbackIndex: number): KbIndexRecord {
  const firstHeading = text.split(/\r?\n/g).map((line) => line.replace(/^#+\s*/, "").trim()).find(Boolean);
  const title = firstHeading || basename(sourcePath, extname(sourcePath));
  const category = inferCategory([title, text, sourcePath].join(" "));
  const aliases = inferAliasesFromText([title, text].join(" "));
  return {
    id: `${slugify(title)}-${fallbackIndex}`,
    kbId: slugify(category),
    label: title,
    title,
    category,
    sourceType: extname(sourcePath).toLowerCase() === ".md" ? "markdown" : "text",
    tags: uniq([category, ...aliases.slice(0, 5).map(slugify)]),
    aliases,
    suggestedQuestions: [],
    content: text,
    sourcePath,
    priority: 20
  };
}

function getCandidateRoots(): string[] {
  const cwd = process.cwd();
  const envRoot = process.env.WATANY_KB_INDEX_ROOT || process.env.KB_INDEX_ROOT || "";
  return uniq([
    envRoot,
    resolve(cwd, "data"),
    resolve(cwd, "src", "data"),
    resolve(cwd, "kb"),
    resolve(cwd, "content"),
    resolve(cwd, "docs"),
    resolve(cwd, "..", "..", "data"),
    resolve(cwd, "..", "..", "kb"),
    resolve(cwd, "..", "..", "docs"),
    resolve(cwd, "..", "..", "apps", "gateway-api", "data")
  ]).filter((root) => root && existsSync(root));
}

function readEntriesSafe(path: string): string[] {
  try {
    return readdirSync(path).map((entry) => join(path, entry));
  } catch {
    return [];
  }
}

function readStatsSafe(path: string): ReturnType<typeof statSync> | null {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function isIndexableFile(path: string, size: number | bigint): boolean {
  const normalizedSize = typeof size === "bigint" ? Number(size) : size;
  return /\.(json|md|txt|csv)$/i.test(path) && normalizedSize <= MAX_FILE_BYTES;
}

function shouldSkipScanPath(path: string): boolean {
  return IGNORED_SCAN_PATHS.test(path);
}

function processScannedEntry(entry: string, stack: string[], files: string[], maxFiles: number): boolean {
  if (shouldSkipScanPath(entry)) {
    return false;
  }
  const info = readStatsSafe(entry);
  if (!info) {
    return false;
  }
  if (info.isDirectory()) {
    stack.push(entry);
    return false;
  }
  if (!info.isFile() || !isIndexableFile(entry, info.size)) {
    return false;
  }

  files.push(entry);
  return files.length >= maxFiles;
}

function walkFiles(root: string, maxFiles: number): string[] {
  const files: string[] = [];
  const stack = [root];

  while (stack.length && files.length < maxFiles) {
    const current = stack.pop();
    if (!current || shouldSkipScanPath(current)) continue;
    const entries = readEntriesSafe(current);
    for (const entry of entries) {
      if (processScannedEntry(entry, stack, files, maxFiles)) {
        break;
      }
    }
  }
  return files;
}

function recordsFromJsonFile(filePath: string, text: string, startIndex: number): KbIndexRecord[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const records: KbIndexRecord[] = [];
  const visit = (value: unknown): void => {
    if (records.length > 500) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (value && typeof value === "object") {
      const objectValue = value as Record<string, unknown>;
      const hasRecordShape = ["title", "label", "labelAr", "name", "question", "content", "answer", "text", "tags", "aliases"].some((key) =>
        Object.prototype.hasOwnProperty.call(objectValue, key)
      );
      if (hasRecordShape) {
        records.push(createRecordFromObject(objectValue, filePath, startIndex + records.length));
      } else {
        for (const child of Object.values(objectValue)) visit(child);
      }
    }
  };
  visit(parsed);
  if (records.length === 0 && parsed && typeof parsed === "object") {
    records.push(createRecordFromObject(parsed as Record<string, unknown>, filePath, startIndex));
  }
  return records;
}

function recordsFromFile(filePath: string, startIndex: number): KbIndexRecord[] {
  let text = "";
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    return [];
  }
  if (/\.json$/i.test(filePath)) {
    return recordsFromJsonFile(filePath, text, startIndex);
  }
  return [createRecordFromText(text, filePath, startIndex)];
}

function getSeedSourceType(category: string): KbIndexSourceType {
  if (category === "salary") {
    return "salary";
  }
  if (category === "procedures") {
    return "procedure";
  }
  return "document";
}

function createSeedRecords(): KbIndexRecord[] {
  return getDefaultWatanyTags().map((tag, index) => ({
    id: tag.id,
    kbId: tag.id,
    label: tag.label,
    title: tag.label,
    category: tag.category,
    sourceType: getSeedSourceType(tag.category),
    tags: uniq([tag.id, tag.category, tag.label, tag.labelAr, tag.labelEn || "", ...tag.aliases.map(slugify)]),
    aliases: uniq([...tag.aliases, ...inferAliasesFromText([tag.label, tag.labelAr, tag.labelEn || "", ...tag.aliases].join(" "))]),
    suggestedQuestions: tag.suggestedQuestions,
    content: [tag.label, tag.labelAr, tag.labelEn || "", tag.category, ...tag.aliases, ...tag.suggestedQuestions].join(" "),
    sourcePath: "seed:default-watany-tags",
    priority: Number(tag.priority || 50) + index / 100
  }));
}

function buildIndexNow(): BuildIndexResult {
  const records: KbIndexRecord[] = [];
  records.push(...createSeedRecords());
  const roots = getCandidateRoots();
  let fileCount = 0;
  for (const root of roots) {
    const files = walkFiles(root, Math.max(1, MAX_SCAN_FILES - fileCount));
    for (const file of files) {
      fileCount += 1;
      records.push(...recordsFromFile(file, records.length));
      if (fileCount >= MAX_SCAN_FILES) break;
    }
  }
  const dedup = new Map<string, KbIndexRecord>();
  for (const record of records) {
    const key = `${record.id}|${normalizeSearchText(record.title)}|${record.sourcePath || ""}`;
    if (!dedup.has(key)) dedup.set(key, record);
  }
  const finalRecords = Array.from(dedup.values());
  const categories: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};
  for (const record of finalRecords) {
    categories[record.category] = (categories[record.category] || 0) + 1;
    for (const tag of record.tags) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }
  return {
    records: finalRecords,
    stats: {
      records: finalRecords.length,
      sources: fileCount,
      generatedAt: new Date().toISOString(),
      sourceRoots: roots,
      categories,
      tags: tagCounts
    }
  };
}

export function getHybridKbIndex(forceRefresh = false): BuildIndexResult {
  const now = Date.now();
  if (!forceRefresh && cachedIndex && now - cachedAt < CACHE_MS) {
    return cachedIndex;
  }
  cachedIndex = buildIndexNow();
  cachedAt = now;
  return cachedIndex;
}

export function getHybridKbIndexStats(): KbIndexStats {
  return getHybridKbIndex(false).stats;
}

function weightedContains(haystack: string, needle: string, exactWeight: number, tokenWeight: number, fieldName: string, fields: string[], terms: string[]): number {
  if (!needle) return 0;
  let score = 0;
  if (haystack.includes(needle)) {
    score += exactWeight;
    fields.push(fieldName);
    terms.push(needle);
  }
  for (const token of buildSearchTokens(needle)) {
    if (token.length < 2) continue;
    if (haystack.includes(token)) {
      score += tokenWeight;
      fields.push(`${fieldName}:token`);
      terms.push(token);
    }
  }
  return score;
}

const ARABIC_QUERY_STOP_WORDS = new Set([
  "ما", "ماذا", "هي", "هو", "هل", "عن", "على", "في", "من", "الى", "إلى", "كيف", "متى", "و", "او", "أو", "الشروط", "شروط", "المطلوب", "مطلوب"
].map(normalizeSearchText));

function removeQueryStopWords(text: string): string {
  return buildSearchTokens(text)
    .filter((token) => token.length >= 2 && !ARABIC_QUERY_STOP_WORDS.has(token))
    .join(" ");
}

function hasDependentDaughterIntent(text: string): boolean {
  const normalized = normalizeSearchText(text);
  return /(ابنه|البنت|بنت|daughter)/.test(normalized);
}

function hasDependentFamilyIntent(text: string): boolean {
  const normalized = normalizeSearchText(text);
  return /(عاتق|عائلي|عائليه|اولاد|الاولاد|ولد|ابن|ابنه|بنت|زوجه|زوجة|family|dependent|dependents|spouse|wife|daughter)/.test(normalized);
}

function hasDependentRecordContext(text: string): boolean {
  const normalized = normalizeSearchText(text);
  return /(عاتق|عائلي|عائليه|افراد العائله|افراد العائلة|اولاد|الاولاد|الابنه|ابنه|بنت|زوجه|زوجة|تعويض عائلي|family|dependent|dependents|spouse|wife|daughter)/.test(normalized);
}

function hasSchoolGrantOnlyContext(text: string): boolean {
  const normalized = normalizeSearchText(text);
  return /(منح مدرسيه|منح مدرسية|school-grants|school grants|مدارس|مدرسي)/.test(normalized) && !hasDependentRecordContext(normalized);
}

function buildWeightedExpandedQueryTerms(query: string, normalizedQuery: string): string[] {
  const base = uniq([
    query,
    normalizedQuery,
    removeQueryStopWords(query),
    removeQueryStopWords(normalizedQuery),
    ...expandArabiziAliases(query),
    ...inferAliasesFromText(query)
  ]).map(normalizeSearchText).filter(Boolean);

  const extra: string[] = [];
  if (hasDependentDaughterIntent(query)) {
    extra.push("الابنه على العاتق", "ابنه على العاتق", "بنت على العاتق", "تعويض عائلي", "افراد العائله", "اولاد على العاتق", "dependent daughter");
  }
  if (/(عاتق|dependent|dependents)/.test(normalizeSearchText(query))) {
    extra.push("على العاتق", "افراد العائله", "تعويض عائلي", "family dependents");
  }
  return uniq([...base, ...extra.map(normalizeSearchText)]).filter((term) => term.length >= 2 && !ARABIC_QUERY_STOP_WORDS.has(term));
}

function domainIntentBoostAndPenalty(queryNormalized: string, recordHaystack: string, record: KbIndexRecord, fields: string[]): number {
  let score = 0;
  const recordIdentity = normalizeSearchText([
    record.id,
    record.kbId || "",
    record.label,
    record.title,
    record.category,
    record.sourceType,
    record.tags.join(" "),
    record.aliases.join(" ")
  ].join(" "));
  const fullRecord = normalizeSearchText(`${recordIdentity} ${recordHaystack}`);

  const dependentQuery = hasDependentFamilyIntent(queryNormalized);
  const daughterQuery = hasDependentDaughterIntent(queryNormalized);
  const dependentRecord = hasDependentRecordContext(fullRecord);
  const schoolOnlyRecord = hasSchoolGrantOnlyContext(recordIdentity) || hasSchoolGrantOnlyContext(fullRecord);

  if (daughterQuery && dependentRecord) {
    score += 140;
    fields.push("domain-rerank:dependent-daughter");
  } else if (dependentQuery && dependentRecord) {
    score += 95;
    fields.push("domain-rerank:dependent-family");
  }

  if (dependentQuery && /تعويض عائلي|افراد العائله|افراد العائلة|على العاتق/.test(fullRecord)) {
    score += 45;
    fields.push("domain-rerank:family-entitlement-exact");
  }

  if (dependentQuery && schoolOnlyRecord) {
    score -= 110;
    fields.push("domain-penalty:unrelated-school-grants");
  }

  if (daughterQuery && !dependentRecord && /(مدرسه|مدرسية|منح|school)/.test(fullRecord)) {
    score -= 80;
    fields.push("domain-penalty:daughter-query-school-only");
  }

  return score;
}
export function searchWeightedKbIndex(query: string, options: { limit?: number; forceRefresh?: boolean } = {}): KbWeightedSearchHit[] {
  const normalizedQuery = normalizeSearchText(query);
  const expandedTerms = buildWeightedExpandedQueryTerms(query, normalizedQuery);
  const limit = Math.max(1, Math.min(Number(options.limit || 8), 30));
  if (normalizedQuery.length < 2 && expandedTerms.length === 0) {
    return [];
  }
  const { records } = getHybridKbIndex(Boolean(options.forceRefresh));
  const hits: KbWeightedSearchHit[] = [];
  for (const record of records) {
    const label = normalizeSearchText(record.label);
    const title = normalizeSearchText(record.title);
    const category = normalizeSearchText(record.category);
    const tags = normalizeSearchText(record.tags.join(" "));
    const aliases = normalizeSearchText(record.aliases.join(" "));
    const content = normalizeSearchText(record.content);
    const all = [label, title, category, tags, aliases, content].join(" ");
    const matchedFields: string[] = [];
    const matchedTerms: string[] = [];
    let score = 0;
    for (const term of expandedTerms) {
      score += weightedContains(label, term, 100, 18, "label", matchedFields, matchedTerms);
      score += weightedContains(title, term, 80, 15, "title", matchedFields, matchedTerms);
      score += weightedContains(aliases, term, 90, 16, "aliases", matchedFields, matchedTerms);
      score += weightedContains(tags, term, 75, 13, "tags", matchedFields, matchedTerms);
      score += weightedContains(category, term, 55, 10, "category", matchedFields, matchedTerms);
      score += weightedContains(content, term, 35, 6, "content", matchedFields, matchedTerms);
    }
    score += domainIntentBoostAndPenalty(normalizedQuery, all, record, matchedFields);
    if (score > 0) {
      const priorityBoost = Math.min(Math.max(record.priority || 0, 0) / 12, 12);
      hits.push({
        record,
        score: Math.min(Math.round(score + priorityBoost), 100),
        matchedFields: uniq(matchedFields),
        matchedTerms: uniq(matchedTerms),
        excerpt: makeExcerpt(record.content, query)
      });
    }
  }
  hits.sort((left, right) => right.score - left.score || right.record.priority - left.record.priority || left.record.title.localeCompare(right.record.title));
  return hits.slice(0, limit);
}