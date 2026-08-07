import { randomUUID } from "node:crypto";
import type { KbChunk, KbCitation, KbFact, KbImportCategory } from "./types";

function normalizeText(input: string): string {
  return String(input || "")
    .replace(/\r\n/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function detectLanguage(text: string, hint?: string): string {
  if (hint) return hint;
  if (/[\u0600-\u06ff]/.test(text)) return "ar";
  return "en";
}

export function detectCategory(text: string, hint?: string): KbImportCategory {
  const h = String(hint || "").toLowerCase();
  if (h.includes("recruit") || h.includes("tatwee3") || h.includes("t تطويع")) return "recruitment_announcements";
  if (h.includes("payment") || h.includes("grant") || h.includes("salary")) return "payment_intelligence";
  if (h.includes("procedure") || h.includes("request")) return "procedures_requests";
  const t = text.toLowerCase();
  if (/تطويع|تطوع|recruitment|candidate|application deadline/.test(t)) return "recruitment_announcements";
  if (/معاش|راتب|منحة|payment|grant|salary|entitlement/.test(t)) return "payment_intelligence";
  if (/مستند|افادة|وثيقة|document|certificate/.test(t)) return "documents_certificates";
  if (/استشفاء|طبابة|مستشفى|health|hospital/.test(t)) return "healthcare_hospitalization";
  if (/طلب|معاملة|procedure|request/.test(t)) return "procedures_requests";
  return "unknown_needs_review";
}

function extractTags(text: string, category: KbImportCategory): string[] {
  const tags = new Set<string>([category]);
  if (/تطويع|recruit/i.test(text)) tags.add("tatwee3");
  if (/deadline|مهلة|آخر موعد|اخر موعد/i.test(text)) tags.add("deadline");
  if (/مستند|document|id|هوية/i.test(text)) tags.add("documents");
  if (/هاتف|phone|tel|contact/i.test(text)) tags.add("contact");
  return Array.from(tags).slice(0, 12);
}

function splitChunks(text: string, maxChars = 1200): string[] {
  const cleaned = normalizeText(text);
  if (!cleaned) return [];
  const paragraphs = cleaned.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs.length ? paragraphs : [cleaned]) {
    if ((current + "\n\n" + p).length > maxChars && current) {
      chunks.push(current.trim());
      current = p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.slice(0, 80);
}

export function buildKbDraft(input: {
  jobId: string;
  sourceLabel: string;
  sourceUrl?: string;
  assetId?: string;
  text: string;
  categoryHint?: string;
  languageHint?: string;
  extractionConfidence?: number;
}): { cleanedText: string; detectedCategory: KbImportCategory; detectedLanguage: string; confidence: number; citations: KbCitation[]; facts: KbFact[]; chunks: KbChunk[] } {
  const cleanedText = normalizeText(input.text);
  const detectedCategory = detectCategory(cleanedText, input.categoryHint);
  const detectedLanguage = detectLanguage(cleanedText, input.languageHint);
  const confidence = Math.max(0.1, Math.min(0.98, input.extractionConfidence || (cleanedText.length > 80 ? 0.75 : 0.35)));
  const citation: KbCitation = {
    id: randomUUID(),
    jobId: input.jobId,
    sourceLabel: input.sourceLabel,
    sourceUrl: input.sourceUrl,
    assetId: input.assetId,
    pageNumber: 1,
    extractedAt: new Date().toISOString(),
    confidence,
  };
  const tags = extractTags(cleanedText, detectedCategory);
  const factText = cleanedText.length > 1800 ? `${cleanedText.slice(0, 1800)}...` : cleanedText;
  const fact: KbFact = {
    id: randomUUID(),
    jobId: input.jobId,
    category: detectedCategory,
    title: detectedCategory === "recruitment_announcements" ? "Recruitment announcement draft" : "Imported KB draft",
    cleanText: factText,
    rawText: input.text,
    language: detectedLanguage,
    confidence,
    citationId: citation.id,
    tags,
    visibility: "admin_review",
  };
  const chunks: KbChunk[] = splitChunks(cleanedText).map((text) => ({
    id: randomUUID(),
    jobId: input.jobId,
    category: detectedCategory,
    text,
    citationId: citation.id,
    tags,
    tokenEstimate: Math.ceil(text.length / 4),
  }));
  return { cleanedText, detectedCategory, detectedLanguage, confidence, citations: [citation], facts: [fact], chunks };
}