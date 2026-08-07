import { useState, useEffect, useCallback } from "react";
import type { OfficialFileItem } from "../types/domain";

/* ── Types ────────────────────────────────────────────── */

export type ProcedureHit = {
  id: string;
  title_ar: string;
  summary_lb: string;
  tags: string[];
  score: number;
};

export type ProcedureDetail = {
  id: string;
  tx_no?: number;
  source?: string;
  title_ar: string;
  title_en?: string;
  summary_lb: string;
  legal_basis?: Array<{ source: string; articles?: string[]; note?: string; allows?: boolean }>;
  eligibility?: string[];
  requirements?: string[];
  steps?: string[];
  where_to_apply?: string[];
  fees?: string[];
  timelines?: string[];
  contacts?: string[];
  exceptions?: string[];
  faq_variants?: string[];
  tags?: string[];
  audience_scope?: string;
  content_tier?: string;
};

export type ProcDocRef = {
  id: string;
  title: string;
  url: string;
  source: string;
  kind?: string;
  preview?: boolean;
  download?: boolean;
  share?: boolean;
  preview_url?: string;
  download_url?: string;
  share_url?: string;
  file_format?: string;
  file_name?: string | null;
  description_lb?: string;
  exported_file_path?: string | null;
  asset_delivery_kind?: string | null;
  asset_delivery_note?: string | null;
  source_anchor?: string | null;
  link_kind?: string | null;
  actions?: {
    preview?: { enabled: boolean; url?: string; note?: string };
    download?: { enabled: boolean; url?: string; note?: string };
    share?: { enabled: boolean; url?: string; note?: string };
  };
};

export type ProcedureFileItem = OfficialFileItem;

/* ── API ──────────────────────────────────────────────── */

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

type ApiFetchError = Error & {
  status?: number;
  retryAfter?: string | null;
};

export function buildProcedureApiUrl(target: string): string {
  return target.startsWith("http") ? target : `${API}${target}`;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { credentials: "include" });
  if (!res.ok) {
    const error = new Error(`HTTP ${res.status}`) as ApiFetchError;
    error.status = res.status;
    error.retryAfter = res.headers.get("retry-after");
    throw error;
  }
  return res.json();
}

/* ── Hooks ────────────────────────────────────────────── */

export function useProcedureSearch() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ProcedureHit[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q?: string) => {
    const qq = (q ?? query).trim();
    if (!qq) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ items: ProcedureHit[] }>(
        `/api/v2/procedures/search?q=${encodeURIComponent(qq)}&limit=20`,
      );
      setItems(res.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  return { query, setQuery, items, loading, search };
}

export function useProceduresCatalog(limit = 200) {
  const [items, setItems] = useState<ProcedureHit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await apiFetch<{ items: ProcedureHit[] }>(
          `/api/v2/procedures?limit=${encodeURIComponent(String(limit))}`,
        );
        if (!cancelled) {
          setItems(res.items || []);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { items, loading };
}

export type ProcedureCatalogItem = {
  id: string;
  title_ar: string;
  summary_lb: string;
  title_clean?: string;
  summary_clean?: string;
  tags?: string[];
  record_kind?: "procedure" | "reference" | "notice" | "fragment";
  source_label?: string;
  section_label?: string;
};

export type ProcedureCatalogSection = {
  id: string;
  title: string;
  source: string;
  source_label: string;
  count: number;
  items?: ProcedureCatalogItem[];
  notice_items?: ProcedureCatalogItem[];
  procedure_items?: ProcedureCatalogItem[];
  reference_items?: ProcedureCatalogItem[];
};

export type ProcedureCatalogSource = {
  id: string;
  title: string;
  count: number;
};

export function useProcedureCatalog(dummy?: boolean) {
  const [sources, setSources] = useState<ProcedureCatalogSource[]>([]);
  const [sections, setSections] = useState<ProcedureCatalogSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await apiFetch<{
          sources?: ProcedureCatalogSource[];
          sections?: ProcedureCatalogSection[];
        }>("/api/v2/procedures/catalog");
        if (!cancelled) {
          setSources(res.sources || []);
          setSections(res.sections || []);
        }
      } catch {
        if (!cancelled) {
          setSources([]);
          setSections([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { sources, sections, loading };
}

export function useProcedureDetail(id: string | null, reloadToken = 0) {
  const [procedure, setProcedure] = useState<ProcedureDetail | null>(null);
  const [docs, setDocs] = useState<ProcDocRef[]>([]);
  const [files, setFiles] = useState<ProcedureFileItem[]>([]);
  const [flow, setFlow] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setProcedure(null);
      setDocs([]);
      setFiles([]);
      setFlow("");
      setError(null);
      setRetryAfter(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRetryAfter(null);

    (async () => {
      try {
        const [pRes, dRes, filesRes, flowRes] = await Promise.allSettled([
          apiFetch<{ procedure: ProcedureDetail }>(`/api/v2/procedures/${encodeURIComponent(id)}`),
          apiFetch<{ docs: ProcDocRef[] }>(`/api/v2/procedures/${encodeURIComponent(id)}/docs`),
          apiFetch<{ items: ProcedureFileItem[] }>(`/api/v2/files?procedureId=${encodeURIComponent(id)}&limit=50`),
          apiFetch<{ mermaid?: string }>(`/api/v2/procedures/${encodeURIComponent(id)}/flow`).catch(() => ({ mermaid: "" })),
        ]);
        if (cancelled) return;

        if (pRes.status !== "fulfilled" || !pRes.value?.procedure) {
          const procedureError = pRes.status === "rejected" ? pRes.reason as ApiFetchError : null;
          setProcedure(null);
          setDocs([]);
          setFiles([]);
          setFlow("");
          if (procedureError?.status === 429) {
            setError("rate_limited");
            setRetryAfter(procedureError.retryAfter || null);
          } else {
            setError("not_found");
          }
          return;
        }

        setProcedure(pRes.value.procedure);
        setDocs(dRes.status === "fulfilled" ? (dRes.value.docs || []) : []);
        setFiles(filesRes.status === "fulfilled" ? (filesRes.value.items || []) : []);
        setFlow(flowRes.status === "fulfilled" ? (flowRes.value.mermaid || "") : "");
      } catch {
        if (!cancelled) {
          setProcedure(null);
          setDocs([]);
          setFiles([]);
          setFlow("");
          setError("load_failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id, reloadToken]);

  return { procedure, docs, files, flow, loading, error, retryAfter };
}
