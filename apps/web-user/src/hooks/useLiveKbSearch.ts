import { useEffect, useMemo, useRef, useState } from "react";
import { getDefaultApiBaseUrl } from "../lib/api-base";

export type LiveKbTagResult = {
  id: string;
  label?: string;
  labelAr?: string;
  category?: string;
  score?: number;
  aliases?: string[];
};

export type LiveKbDocumentResult = {
  id: string;
  title: string;
  kbId?: string;
  sourceUrl?: string;
  score?: number;
  rankingScore?: number;
  tags?: string[];
  sourceType?: string;
  sourceOrigin?: "feature" | "kb";
};

export type LiveKbSearchResponse = {
  query: string;
  normalizedQuery?: string;
  ambiguous?: boolean;
  tags: LiveKbTagResult[];
  documents: LiveKbDocumentResult[];
  suggestedQuestions: string[];
};

const EMPTY_RESULTS: LiveKbSearchResponse = {
  query: "",
  tags: [],
  documents: [],
  suggestedQuestions: [],
};

const SPOUSE_FALLBACK_DOCUMENTS: LiveKbDocumentResult[] = [
  {
    id: "fallback-spouse-pension-guide",
    title: "معاش الزوجة: شروط الاستحقاق والمستندات",
    kbId: "spouse_coverage",
    sourceUrl: "/faq?query=%D9%85%D8%B9%D8%A7%D8%B4%20%D8%A7%D9%84%D8%B2%D9%88%D8%AC%D8%A9",
    score: 100,
    tags: ["spouse_coverage", "family-dependents"],
    sourceType: "faq",
    sourceOrigin: "kb",
  },
  {
    id: "fallback-spouse-reallocation",
    title: "طلب إعادة تخصيص معاش تقاعدي - الزوجة",
    kbId: "spouse_coverage",
    sourceUrl: "/procedures?query=%D8%B7%D9%84%D8%A8%20%D8%A5%D8%B9%D8%A7%D8%AF%D8%A9%20%D8%AA%D8%AE%D8%B5%D9%8A%D8%B5%20%D9%85%D8%B9%D8%A7%D8%B4%20%D8%AA%D9%82%D8%A7%D8%B9%D8%AF%D9%8A%20-%20%D8%A7%D9%84%D8%B2%D9%88%D8%AC%D8%A9",
    score: 96,
    tags: ["spouse_coverage", "family-dependents"],
    sourceType: "procedure",
    sourceOrigin: "kb",
  },
  {
    id: "fallback-spouse-on-dependents",
    title: "تسجيل الزوجة على العاتق والمستندات المطلوبة",
    kbId: "spouse_coverage",
    sourceUrl: "/procedures?query=%D8%AA%D8%B3%D8%AC%D9%8A%D9%84%20%D8%A7%D9%84%D8%B2%D9%88%D8%AC%D8%A9%20%D8%B9%D9%84%D9%89%20%D8%A7%D9%84%D8%B9%D8%A7%D8%AA%D9%82",
    score: 94,
    tags: ["spouse_coverage", "family-dependents"],
    sourceType: "procedure",
    sourceOrigin: "kb",
  },
];

function hasDependentDaughterIntent(value: string): boolean {
  return /(الابنة|ابنة|بنت|daughter|dependent daughter)/i.test(value);
}

function hasSpouseCoverageIntent(value: string): boolean {
  return /(الزوجة|زوجة|زوجه|الأرملة|الارملة|أرملة|ارملة|spouse|wife|widow)/i.test(value);
}

function hasFamilyDependentIntent(value: string): boolean {
  return /(العاتق|عائلي|عائلية|اولاد|الأولاد|ولد|ابن|ابنة|بنت|زوجة|زوجه|family|dependent|dependents|spouse|wife|daughter)/i.test(value);
}

function buildLocalFallbackResults(query: string): LiveKbSearchResponse {
  if (hasSpouseCoverageIntent(query)) {
    return {
      query,
      tags: [
        { id: "spouse_coverage", label: "spouse_coverage", labelAr: "الزوجة والاستحقاقات العائلية", score: 99 },
        { id: "family-dependents", label: "family-dependents", labelAr: "العائلة على العاتق", score: 91 },
      ],
      documents: SPOUSE_FALLBACK_DOCUMENTS,
      suggestedQuestions: ["ما هي شروط معاش الزوجة؟", "ما هي المستندات المطلوبة للزوجة؟", "كيف أسجل الزوجة على العاتق؟"],
    };
  }

  if (hasDependentDaughterIntent(query)) {
    return {
      query,
      tags: [
        { id: "family-dependents", label: "family-dependents", labelAr: "العائلة على العاتق", score: 98 },
      ],
      documents: [
        {
          id: "fallback-dependent-daughter-faq",
          title: "حقوق الابنة على العاتق: الشروط والمستندات",
          kbId: "family-dependents",
          sourceUrl: "/faq?query=%D8%A7%D9%84%D8%A7%D8%A8%D9%86%D8%A9%20%D8%B9%D9%84%D9%89%20%D8%A7%D9%84%D8%B9%D8%A7%D8%AA%D9%82",
          score: 98,
          tags: ["family-dependents"],
          sourceType: "faq",
          sourceOrigin: "kb",
        },
        {
          id: "fallback-dependent-daughter-procedure",
          title: "إجراءات تسجيل الابنة ضمن المستفيدين",
          kbId: "family-dependents",
          sourceUrl: "/procedures?query=%D8%AA%D8%B3%D8%AC%D9%8A%D9%84%20%D8%A7%D9%84%D8%A7%D8%A8%D9%86%D8%A9",
          score: 94,
          tags: ["family-dependents"],
          sourceType: "procedure",
          sourceOrigin: "kb",
        },
        {
          id: "fallback-dependent-daughter-forms",
          title: "النماذج المطلوبة لمعاملة الابنة على العاتق",
          kbId: "family-dependents",
          sourceUrl: "/forms?query=%D8%A7%D9%84%D8%A7%D8%A8%D9%86%D8%A9%20%D8%B9%D9%84%D9%89%20%D8%A7%D9%84%D8%B9%D8%A7%D8%AA%D9%82",
          score: 90,
          tags: ["family-dependents"],
          sourceType: "document",
          sourceOrigin: "kb",
        },
      ],
      suggestedQuestions: ["ما هي شروط تسجيل الابنة على العاتق؟", "ما هي المستندات المطلوبة؟", "كيف أتابع المعاملة؟"],
    };
  }

  if (hasFamilyDependentIntent(query)) {
    return {
      query,
      tags: [{ id: "family-dependents", label: "family-dependents", labelAr: "العائلة على العاتق", score: 88 }],
      documents: [
        {
          id: "fallback-family-dependents-guide",
          title: "دليل المستفيدين على العاتق",
          kbId: "family-dependents",
          sourceUrl: "/faq?query=%D8%A7%D9%84%D8%B9%D8%A7%D8%AA%D9%82",
          score: 88,
          tags: ["family-dependents"],
          sourceType: "faq",
          sourceOrigin: "kb",
        },
      ],
      suggestedQuestions: ["من يحق له الاستفادة على العاتق؟", "ما المستندات المطلوبة؟"],
    };
  }

  return { ...EMPTY_RESULTS, query };
}

function getEnvValue(name: string): string {
  const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
  return meta.env?.[name] || "";
}

export function getHybridKbGatewayBaseUrl(preferredBaseUrl?: string): string {
  if (preferredBaseUrl?.trim()) {
    return preferredBaseUrl.trim().replace(/\/$/, "");
  }

  const configured = getEnvValue("VITE_GATEWAY_BASE_URL") || getEnvValue("VITE_API_BASE_URL");
  if (configured.trim()) {
    return configured.replace(/\/$/, "");
  }

  const defaultBaseUrl = getDefaultApiBaseUrl();
  if (defaultBaseUrl.trim()) {
    return defaultBaseUrl.replace(/\/$/, "");
  }

  if (globalThis.window !== undefined) {
    const isLocal = globalThis.location.hostname === "localhost" || globalThis.location.hostname === "127.0.0.1";
    const isWebDevPort = globalThis.location.port !== "8010";
    if (isLocal && isWebDevPort) {
      return "http://localhost:8010";
    }
  }

  return "";
}

function getVisibleLength(value: string): number {
  return value.replace(/\s+/g, "").length;
}

function isUnavailableLiveSearchError(message: string): boolean {
  return /HTTP 404/i.test(message) || /Unexpected token </i.test(message) || /not valid JSON/i.test(message);
}

export function useLiveKbSearch(input: string, limit = 8, minChars = 1, gatewayBaseUrl?: string) {
  const [results, setResults] = useState<LiveKbSearchResponse>(EMPTY_RESULTS);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestCounter = useRef(0);

  const visibleQuery = useMemo(() => input.trim(), [input]);
  const visibleLength = useMemo(() => getVisibleLength(visibleQuery), [visibleQuery]);
  const shouldSearch = visibleLength >= minChars;

  useEffect(() => {
    requestCounter.current += 1;
    const requestId = requestCounter.current;

    if (!shouldSearch) {
      setResults({ ...EMPTY_RESULTS, query: visibleQuery });
      setIsSearching(false);
      setError(null);
      return;
    }

    const abortController = new AbortController();
    const timeoutId = globalThis.setTimeout(async () => {
      try {
        setIsSearching(true);
        setError(null);
        const resolvedGatewayBaseUrl = getHybridKbGatewayBaseUrl(gatewayBaseUrl);
        const url = `${resolvedGatewayBaseUrl}/api/kb/live-search?q=${encodeURIComponent(visibleQuery)}&limit=${encodeURIComponent(String(limit))}`;
        const response = await fetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`live-search failed with HTTP ${response.status}`);
        }

        const payload = (await response.json()) as Partial<LiveKbSearchResponse>;
        if (requestId !== requestCounter.current) {
          return;
        }

        setResults({
          query: typeof payload.query === "string" ? payload.query : visibleQuery,
          normalizedQuery: payload.normalizedQuery,
          ambiguous: Boolean(payload.ambiguous),
          tags: Array.isArray(payload.tags) ? payload.tags : [],
          documents: Array.isArray(payload.documents)
            ? payload.documents.map((document) => ({
              ...document,
              sourceUrl: typeof document?.sourceUrl === "string" ? document.sourceUrl : undefined,
              sourceOrigin: "kb",
            }))
            : [],
          suggestedQuestions: Array.isArray(payload.suggestedQuestions) ? payload.suggestedQuestions : [],
        });

        if ((Array.isArray(payload.documents) ? payload.documents.length : 0) === 0) {
          const fallback = buildLocalFallbackResults(visibleQuery);
          if (fallback.documents.length > 0) {
            setResults(fallback);
          }
        }
      } catch (error_) {
        if (abortController.signal.aborted) {
          return;
        }
        const message = error_ instanceof Error ? error_.message : "live-search failed";
        const fallback = buildLocalFallbackResults(visibleQuery);
        setError(isUnavailableLiveSearchError(message) ? null : message);
        setResults(fallback.documents.length > 0 ? fallback : { ...EMPTY_RESULTS, query: visibleQuery });
      } finally {
        if (requestId === requestCounter.current) {
          setIsSearching(false);
        }
      }
    }, 60);

    return () => {
      globalThis.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [gatewayBaseUrl, limit, minChars, shouldSearch, visibleQuery]);

  return {
    query: visibleQuery,
    visibleLength,
    minChars,
    shouldSearch,
    results,
    tags: results.tags,
    documents: results.documents,
    suggestedQuestions: results.suggestedQuestions,
    isSearching,
    error,
  };
}