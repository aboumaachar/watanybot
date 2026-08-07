import fs from "node:fs";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { normalizeArabic } from "@watany/shared/arabic";
import { SEED_CONTACTS } from "../disaster/seed.js";

interface DirectoryRoutesOptions {
  repoRootPath: string;
}

type DirectoryPhone = {
  label_lb?: string;
  number?: string;
};

type DirectoryPhonebookEntry = {
  id?: string;
  name_lb?: string;
  name_formal?: string;
  topics?: string[];
  domains?: string[];
  phones?: DirectoryPhone[];
  category?: string;
  subCategory?: string;
  source?: string;
  sourceReliability?: string;
  hours_lb?: string;
  handoff_lb?: string;
  priority?: number;
};

type DirectoryPhonebookFile = {
  entries?: DirectoryPhonebookEntry[];
};

type DirectorySearchEntry = {
  id: string;
  name: string;
  note?: string;
  phone?: string;
  phones: string[];
  searchTerms: string[];
  priority: number;
  category?: string;
  subCategory?: string;
  source?: string;
  sourceReliability?: string;
};

export type DirectorySearchResultItem = {
  id: string;
  name: string;
  phone?: string;
  note?: string;
  phones: string[];
  category?: string;
  subCategory?: string;
  source?: string;
  sourceReliability?: string;
};

const LEGACY_DIRECTORY_ENTRIES: DirectorySearchEntry[] = [
  {
    id: "legacy-military-hospital",
    name: "المستشفى العسكري",
    note: "المستشفى العسكري المركزي",
    phone: "01-820000",
    phones: ["01-820000"],
    searchTerms: ["المستشفى العسكري", "المستشفى العسكري المركزي", "استشفاء", "طبابة", "طوارئ"],
    priority: 100,
  },
  {
    id: "legacy-retirement",
    name: "دائرة التقاعد",
    note: "دائرة التقاعد/الرواتب",
    phone: "01-612200",
    phones: ["01-612200"],
    searchTerms: ["دائرة التقاعد", "الرواتب", "معاش", "تقاعد", "دفتر تقاعد"],
    priority: 100,
  },
  {
    id: "legacy-veterans-affairs",
    name: "مديرية شؤون المحاربين القدامى",
    note: "متابعة شؤون المحاربين القدامى",
    phone: "01-612000",
    phones: ["01-612000"],
    searchTerms: ["مديرية شؤون المحاربين القدامى", "محاربين قدامى", "رعاية", "قدامى"],
    priority: 95,
  },
  {
    id: "welfare-social-affairs-device",
    name: "جهاز الرعاية والشؤون الاجتماعية للعسكريين القدامى",
    note: "المساعدات المالية والمدرسية والمحروقات وزيارات الشهداء",
    phone: "01-288047",
    phones: ["01-288047", "01-288408"],
    searchTerms: [
      "جهاز الرعاية والشؤون",
      "الرعاية والشؤون الاجتماعية",
      "شؤون العسكريين القدامى",
      "قسم الرعاية",
      "رعاية الاجتماعية",
      "المساعدات المدرسية",
      "قسائم المحروقات",
      "مساعدة اجتماعية",
    ],
    priority: 96,
  },
  {
    id: "legacy-hotline",
    name: "الخط الساخن",
    note: "خط مساعدة سريع",
    phone: "1515",
    phones: ["1515"],
    searchTerms: ["الخط الساخن", "مساعدة", "استعلام", "شكاوى"],
    priority: 90,
  },
  {
    id: "legacy-emergency",
    name: "الطوارئ",
    note: "النجدة العامة",
    phone: "112",
    phones: ["112"],
    searchTerms: ["الطوارئ", "نجدة", "112", "مساعدة طارئة"],
    priority: 110,
  },
];

const DIRECTORY_QUERY_NOISE = new Set(["رقم", "هاتف", "تلفون", "اتصال", "دليل", "رقمك"]);

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeKey(value: string): string {
  return normalizeArabic(normalizeText(value));
}

function getQueryTokens(value: string): string[] {
  return normalizeKey(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 || /^\d+$/.test(token))
    .filter((token) => !DIRECTORY_QUERY_NOISE.has(token));
}

function isUsablePhone(value?: string): value is string {
  return typeof value === "string" && value.trim().length > 0 && !/[xX]/.test(value);
}

function readPhonebookEntries(repoRootPath: string): DirectoryPhonebookEntry[] {
  const phonebookPath = path.join(repoRootPath, "watany_kb", "admin", "directory_phonebook_lb.json");

  try {
    const raw = fs.readFileSync(phonebookPath, "utf8");
    const parsed = JSON.parse(raw) as DirectoryPhonebookFile;
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

function mergeEntry(map: Map<string, DirectorySearchEntry>, entry: DirectorySearchEntry) {
  const key = normalizeKey(entry.name);
  const existing = map.get(key);

  if (!existing) {
    map.set(key, {
      ...entry,
      phones: Array.from(new Set(entry.phones)),
      searchTerms: Array.from(new Set(entry.searchTerms.filter(Boolean))),
    });
    return;
  }

  const phones = Array.from(new Set([...existing.phones, ...entry.phones].filter(Boolean)));
  const merged: DirectorySearchEntry = {
    ...existing,
    note: existing.note || entry.note,
    phone: existing.phone || entry.phone,
    phones,
    category: existing.category || entry.category,
    subCategory: existing.subCategory || entry.subCategory,
    source: existing.source || entry.source,
    sourceReliability: existing.sourceReliability || entry.sourceReliability,
    searchTerms: Array.from(new Set([...existing.searchTerms, ...entry.searchTerms].filter(Boolean))),
    priority: Math.max(existing.priority, entry.priority),
  };

  if (!merged.phone && phones.length > 0) {
    merged.phone = phones[0];
  }

  map.set(key, merged);
}

function buildDirectoryEntries(repoRootPath: string): DirectorySearchEntry[] {
  const map = new Map<string, DirectorySearchEntry>();

  for (const entry of readPhonebookEntries(repoRootPath)) {
    const name = normalizeText(entry.name_lb || entry.name_formal || "");
    if (!name) continue;

    const phones = (entry.phones || [])
      .map((item) => normalizeText(item.number || ""))
      .filter(isUsablePhone);

    mergeEntry(map, {
      id: entry.id || normalizeKey(name),
      name,
      note: normalizeText(entry.handoff_lb || entry.name_formal || entry.hours_lb || "") || undefined,
      phone: phones[0],
      phones,
      category: entry.category,
      subCategory: entry.subCategory,
      source: entry.source,
      sourceReliability: entry.sourceReliability,
      searchTerms: [
        name,
        entry.name_formal || "",
        entry.category || "",
        entry.subCategory || "",
        ...(entry.topics || []),
        ...(entry.domains || []),
        entry.handoff_lb || "",
        entry.hours_lb || "",
      ].map(normalizeText).filter(Boolean),
      priority: entry.priority || 50,
    });
  }

  for (const entry of LEGACY_DIRECTORY_ENTRIES) {
    mergeEntry(map, entry);
  }

  for (const contact of SEED_CONTACTS) {
    const phones = [contact.emergency_hotline, contact.primary_phone]
      .map((value) => normalizeText(value || ""))
      .filter(isUsablePhone);

    mergeEntry(map, {
      id: contact.id,
      name: normalizeText(contact.organization_name_ar),
      note: normalizeText(contact.service_provided_ar),
      phone: phones[0],
      phones,
      searchTerms: [
        contact.organization_name_ar,
        contact.service_provided_ar,
        contact.contact_type,
        contact.service_area,
        ...(phones || []),
      ].map(normalizeText).filter(Boolean),
      priority: Math.max(1, 100 - contact.priority_level),
    });
  }

  return Array.from(map.values()).sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name, "ar"));
}

function buildHaystack(entry: DirectorySearchEntry): string {
  return normalizeKey([entry.name, entry.note || "", ...entry.searchTerms, ...entry.phones].join(" "));
}

function entryMatchesQuery(entry: DirectorySearchEntry, query: string, queryTokens: string[]): boolean {
  const haystack = buildHaystack(entry);
  if (haystack.includes(query)) return true;
  if (queryTokens.length === 0) return false;
  return queryTokens.every((token) => haystack.includes(token));
}

function scoreEntry(entry: DirectorySearchEntry, query: string, queryTokens: string[]): number {
  const haystack = buildHaystack(entry);
  const normalizedName = normalizeKey(entry.name);
  let score = entry.priority;

  if (haystack.startsWith(query)) score += 100;
  else if (normalizedName.startsWith(query)) score += 80;
  else if (haystack.includes(query)) score += 20;

  if (queryTokens.length > 0) {
    const matchedTokens = queryTokens.filter((token) => haystack.includes(token));
    score += matchedTokens.length * 25;
    if (matchedTokens.length === queryTokens.length) {
      score += 10;
    }
  }

  return score;
}

export function searchDirectoryEntries(
  repoRootPath: string,
  rawQuery: string,
  limit = 20,
): DirectorySearchResultItem[] {
  const entries = buildDirectoryEntries(repoRootPath);
  const query = normalizeKey(rawQuery);
  const queryTokens = getQueryTokens(rawQuery);
  const resolvedLimit = Math.min(Math.max(limit, 1), 50);

  const matches = query
    ? entries
      .filter((entry) => entryMatchesQuery(entry, query, queryTokens))
      .sort((left, right) => scoreEntry(right, query, queryTokens) - scoreEntry(left, query, queryTokens) || left.name.localeCompare(right.name, "ar"))
    : entries;

  return matches.slice(0, resolvedLimit).map((entry) => ({
    id: entry.id,
    name: entry.name,
    phone: entry.phone,
    note: entry.note,
    phones: entry.phones,
    category: entry.category,
    subCategory: entry.subCategory,
    source: entry.source,
    sourceReliability: entry.sourceReliability,
  }));
}

export const directoryRoutes: FastifyPluginAsync<DirectoryRoutesOptions> = async (app, { repoRootPath }) => {
  app.get("/api/v2/directory/search", async (req) => {
    const limit = Math.min(Math.max(Number((req.query as { limit?: string }).limit || "20") || 20, 1), 50);

    return {
      results: searchDirectoryEntries(repoRootPath, String((req.query as { q?: string }).q || ""), limit),
    };
  });
};