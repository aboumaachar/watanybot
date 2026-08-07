import { useEffect, useMemo, useState } from "react";
import { adminFetch, getAdminErrorMessage } from "../lib/api";

type AnyRecord = Record<string, unknown>;

function asArray(input: unknown): AnyRecord[] {
  if (Array.isArray(input)) {
    return input.filter((item): item is AnyRecord => typeof item === "object" && item !== null);
  }
  return [];
}

function pickRows(payload: unknown, primaryKeys: string[]): AnyRecord[] {
  if (Array.isArray(payload)) return asArray(payload);
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;

  for (const key of primaryKeys) {
    const found = asArray(p[key]);
    if (found.length > 0) return found;
  }

  const fallbackKeys = ["items", "data", "rows", "results", "documents"];
  for (const key of fallbackKeys) {
    const found = asArray(p[key]);
    if (found.length > 0) return found;
  }

  return [];
}

export default function AdminProceduresPage() {
  const [procedures, setProcedures] = useState<AnyRecord[]>([]);
  const [procedureFiles, setProcedureFiles] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [proceduresRes, filesRes] = await Promise.all([
          adminFetch("/api/procedures"),
          adminFetch("/api/admin/procedures/files"),
        ]);

        const proceduresBody = await proceduresRes.json();
        const filesBody = await filesRes.json();

        if (mounted) {
          setProcedures(pickRows(proceduresBody, ["procedures"]));
          setProcedureFiles(pickRows(filesBody, ["files", "procedure_files"]));
        }
      } catch (err) {
        if (mounted) setError(getAdminErrorMessage(err, "Failed to load admin procedures."));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
  }, []);

  const proceduresCount = useMemo(() => procedures.length, [procedures]);
  const procedureFilesCount = useMemo(() => procedureFiles.length, [procedureFiles]);

  return (
    <div>
      <div className="page-header">
        <h2>Admin Procedures</h2>
        <p className="muted">source-backed procedures</p>
        <p className="muted">loaded procedure count: {proceduresCount}</p>
        <p className="muted">loaded procedure file count: {procedureFilesCount}</p>
      </div>

      {loading && <div className="muted">Loading procedures…</div>}
      {error && <div className="muted">{error}</div>}

      {!loading && !error && (
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="card span-6" style={{ minHeight: 220 }}>
            <h3>Procedures</h3>
            {proceduresCount === 0 ? (
              <p className="muted">No procedures returned.</p>
            ) : (
              <ul>
                {procedures.slice(0, 20).map((row, idx) => (
                  <li key={`p-${idx}`}>{String(row.title ?? row.name ?? row.id ?? `Procedure ${idx + 1}`)}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="card span-6" style={{ minHeight: 220 }}>
            <h3>Procedure Files</h3>
            {procedureFilesCount === 0 ? (
              <p className="muted">No procedure files returned.</p>
            ) : (
              <ul>
                {procedureFiles.slice(0, 20).map((row, idx) => (
                  <li key={`f-${idx}`}>{String(row.title ?? row.name ?? row.fileName ?? row.id ?? `File ${idx + 1}`)}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
