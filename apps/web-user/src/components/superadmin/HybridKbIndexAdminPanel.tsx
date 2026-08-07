import { useEffect, useMemo, useState } from "react";
import { authHeaders, getCsrfToken } from "../../lib/auth";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./hybrid-kb-index-admin-panel.css";

type HybridKbIndexStatus = Readonly<{
  ok?: boolean;
  generatedAt?: string;
  recordCount?: number;
  categories?: Record<string, number>;
}>;

type HybridKbIndexRecord = Readonly<{
  id: string;
  title: string;
  category: string;
  relativePath: string;
  route?: string;
  keywords?: readonly string[];
  preview?: string;
}>;

type SearchResponse = Readonly<{
  ok?: boolean;
  results?: readonly HybridKbIndexRecord[];
}>;

const REFRESH_SECONDS = 60;

function adminMutationHeaders(): Record<string, string> {
  const csrfToken = getCsrfToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...authHeaders(),
  };

  if (csrfToken) {
    headers["x-csrf-token"] = csrfToken;
  }

  return headers;
}

function withAdminAuth(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...authHeaders(),
    },
  };
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return (await response.json()) as T;
}

export default function HybridKbIndexAdminPanel() {
  const [status, setStatus] = useState<HybridKbIndexStatus | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly HybridKbIndexRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryRows = useMemo(
    () => Object.entries(status?.categories ?? {}).sort((a, b) => b[1] - a[1]),
    [status],
  );

  async function refreshStatus() {
    try {
      setError(null);
      const next = await readJson<HybridKbIndexStatus>(
        "/api/admin/hybrid-kb-index/status",
        withAdminAuth(),
      );
      setStatus(next);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "Unable to load Hybrid KB index status");
    }
  }

  async function rebuildIndex() {
    setBusy(true);

    try {
      setError(null);
      const next = await readJson<HybridKbIndexStatus>(
        "/api/admin/hybrid-kb-index/rebuild",
        withAdminAuth({ method: "POST", headers: adminMutationHeaders(), body: "{}" }),
      );
      setStatus(next);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "Unable to rebuild Hybrid KB index");
    } finally {
      setBusy(false);
    }
  }

  async function searchIndex(nextQuery = query) {
    try {
      setError(null);
      const response = await readJson<SearchResponse>(
        `/api/hybrid-kb/index/search?q=${encodeURIComponent(nextQuery)}&limit=12`,
      );
      setResults(response.results ?? []);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "Unable to search Hybrid KB index");
    }
  }

  useEffect(() => {
    refreshStatus();
    const timer = globalThis.setInterval(refreshStatus, REFRESH_SECONDS * 1000);
    return () => globalThis.clearInterval(timer);
  }, []);

  // searchIndex intentionally omitted from deps; debounce on query only
  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      searchIndex(query);
    }, 350);

    return () => globalThis.clearTimeout(timer);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="hybrid-kb-index-admin-panel" data-hybrid-kb-index-admin-panel="true" dir="rtl">
      <div className="hybrid-kb-index-admin-panel__header">
        <div>
          <p className="hybrid-kb-index-admin-panel__eyebrow">Hybrid Chat Intelligence</p>
          <h2>فهرس موطني الهجين للمعرفة والخدمات</h2>
          <p>
            يربط قاعدة المعرفة، المعاملات، الأسئلة الشائعة، البيانات، وصفحات التطبيق ضمن فهرس واحد
            يستعمله Hybrid Chat وتراقبه لوحة السوبر أدمن.
          </p>
        </div>

        <button type="button" onClick={rebuildIndex} disabled={busy}>
          {busy ? "جاري التحديث..." : "إعادة بناء الفهرس"}
        </button>
      </div>

      {error ? <div className="hybrid-kb-index-admin-panel__error">{error}</div> : null}

      <div className="hybrid-kb-index-admin-panel__stats">
        <span>
          عدد السجلات: <strong>{status?.recordCount ?? "—"}</strong>
        </span>
        <span>
          آخر تحديث: <strong>{status?.generatedAt ? new Date(status.generatedAt).toLocaleString("ar-LB") : "—"}</strong>
        </span>
        <span>
          تحديث تلقائي كل: <strong>{REFRESH_SECONDS}s</strong>
        </span>
      </div>

      <div className="hybrid-kb-index-admin-panel__categories">
        {categoryRows.map(([name, count]) => (
          <span key={name}>
            {name}: {count}
          </span>
        ))}
      </div>

      <label className="hybrid-kb-index-admin-panel__search">
        بحث في الفهرس
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="مثال: معاش، إجراء، وظيفة، استشفاء"
        />
      </label>

      <div className="hybrid-kb-index-admin-panel__results">
        {results.map((record) => (
          <article key={record.id}>
            <strong>{record.title}</strong>
            <span>
              {record.category} · {record.relativePath}
            </span>
            {record.route ? <em>{record.route}</em> : null}
            {record.preview ? <p>{record.preview}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
