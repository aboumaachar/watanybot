import { useEffect, useMemo, useState } from "react";
import { adminFetch, getAdminErrorMessage } from "../lib/api";

type AnyRecord = Record<string, unknown>;

function asArray(input: unknown): AnyRecord[] {
  if (Array.isArray(input)) {
    return input.filter((item): item is AnyRecord => typeof item === "object" && item !== null);
  }
  return [];
}

function pickRows(payload: unknown): AnyRecord[] {
  if (Array.isArray(payload)) return asArray(payload);
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;

  const keys = ["documents", "items", "data", "rows", "results"];
  for (const key of keys) {
    const found = asArray(p[key]);
    if (found.length > 0) return found;
  }

  return [];
}

export default function AdminDocumentsPage() {
  const [rows, setRows] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await adminFetch("/api/admin/documents");
        const body = await res.json();
        if (mounted) setRows(pickRows(body));
      } catch (err) {
        if (mounted) setError(getAdminErrorMessage(err, "Failed to load admin documents."));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
  }, []);

  const count = useMemo(() => rows.length, [rows]);

  return (
    <div>
      <div className="page-header">
        <h2>Admin Documents</h2>
        <p className="muted">source-backed documents</p>
        <p className="muted">loaded document count: {count}</p>
      </div>
      {loading && <div className="muted">Loading documents…</div>}
      {error && <div className="muted">{error}</div>}
      {!loading && !error && count === 0 && <div className="muted">No documents returned.</div>}
      {!loading && count > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 25).map((row, idx) => {
                const title = String(row.title ?? row.name ?? row.label ?? `Document ${idx + 1}`);
                const source = String(row.source ?? row.source_name ?? row.category ?? "--");
                return (
                  <tr key={`${title}-${idx}`}>
                    <td>{idx + 1}</td>
                    <td>{title}</td>
                    <td>{source}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
