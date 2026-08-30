import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "../lib/api";
import { ManageableList, type ManageableListAdapter } from "../components/ManageableList";
import { executeBulkAction } from "../components/BulkActionFramework";

type CollectionKind = "official-services" | "ticker" | "ai-training" | "abusive-events" | "chat-inputs" | "answer-overrides" | "chat-sessions" | "crm-contacts" | "erm-assets" | "rules" | "news";
type CollectionRow = Record<string, unknown> & { id: string };

const definitions: Record<CollectionKind, { title: string; endpoint: string; responseKey: string; columns: readonly string[]; fields: readonly string[]; idField?: string }> = {
  "official-services": { title: "Official Services", endpoint: "/api/admin/official-services", responseKey: "items", columns: ["Name", "Category", "URL", "Status"], fields: ["name", "category", "sourceUrl", "lastHealthOk"] },
  ticker: { title: "Ticker Items", endpoint: "/api/admin/ticker/items", responseKey: "items", columns: ["Title", "Type", "Priority", "Start", "End"], fields: ["title", "type", "priority", "starts_at", "ends_at"] },
  "ai-training": { title: "AI Training", endpoint: "/api/admin/ai/training", responseKey: "examples", columns: ["Input", "Output", "Status", "Source"], fields: ["input", "output", "status", "source"] },
  "abusive-events": { title: "Abusive Events", endpoint: "/api/admin/abusive-events", responseKey: "events", columns: ["Actor", "Reason", "Created", "Status"], fields: ["actorId", "reason", "createdAt", "status"] },
  "chat-inputs": { title: "Chat Inputs", endpoint: "/api/admin/chat-inputs", responseKey: "items", columns: ["Input", "Intent", "Status", "Created"], fields: ["input", "intent", "status", "createdAt"] },
  "answer-overrides": { title: "Answer Overrides", endpoint: "/api/admin/answer-overrides", responseKey: "overrides", columns: ["Pattern", "Answer", "Active", "Source"], fields: ["matchPattern", "answer", "active", "sourceUrl"] },
  "chat-sessions": { title: "Chat Sessions", endpoint: "/api/admin/chat-sessions", responseKey: "sessions", columns: ["User", "Channel", "Messages", "Status"], fields: ["user_email", "channel", "message_count", "status"] },
  "crm-contacts": { title: "CRM Contacts", endpoint: "/admin-authority/crm/contacts", responseKey: "items", columns: ["Name", "Email", "Phone", "Organization"], fields: ["name", "email_id", "phone", "company_name"] },
  "erm-assets": { title: "ERM Assets", endpoint: "/api/admin/erm/assets", responseKey: "items", columns: ["Title", "Type", "Format", "File"], fields: ["title", "asset_type", "file_format", "file_name"] },
  rules: { title: "Content Filter Rules", endpoint: "/api/admin/rules", responseKey: "rules", columns: ["Name", "Pattern", "Severity", "Action", "Enabled"], fields: ["name", "pattern", "severity", "action", "enabled"] },
  news: { title: "News", endpoint: "/admin/news", responseKey: "__root", columns: ["Title", "Category", "Status", "Published"], fields: ["title", "category", "status", "published_at"] },
};

export default function UniversalCollectionPage({ kind }: Readonly<{ kind: CollectionKind }>) {
  const definition = definitions[kind];
  const [rows, setRows] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [bulkPending, setBulkPending] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const response = await adminFetch(definition.endpoint); const body = await response.json(); const values = definition.responseKey === "__root" ? body : body[definition.responseKey]; setRows((values ?? []).map((row: Record<string, unknown>) => ({ ...row, id: String(row[definition.idField ?? "id"] ?? "") })).filter((row: CollectionRow) => row.id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load collection"); }
    finally { setLoading(false); }
  }, [definition.endpoint]);
  useEffect(() => { void load(); }, [load]);
  const adapter: ManageableListAdapter<CollectionRow> = {
    featureId: kind === "rules" || kind === "news" ? `cms.${kind}` : `system.${kind}`,
    domain: kind === "rules" || kind === "news" ? "CMS" : "SYSTEM",
    title: definition.title,
    loadRows: async () => rows,
    getRowId: (row) => row.id,
    columns: definition.columns,
    selectionEnabled: true,
    onSelectionChange: setSelectedIds,
    renderRow: (row) => <>{definition.fields.map((field) => <td key={field}>{String(row[field] ?? "-")}</td>)}</>,
  };
  const bulkEnabled = kind === "ai-training" || kind === "rules" || kind === "news" || kind === "ticker";
  const bulkLabel = kind === "rules" || kind === "ticker" || kind === "ai-training" ? "Delete selected" : kind === "news" ? "Archive selected" : "Approve selected";
  const approveSelected = async () => {
    setBulkPending(true);
    try {
      await executeBulkAction({
        id: kind === "rules" ? "cms.rules.bulk_delete" : kind === "news" ? "cms.news.bulk_archive" : kind === "ticker" ? "cms.ticker.bulk_delete" : "cms.ai.bulk_delete",
        label: bulkLabel,
        requiredPermission: kind === "rules" || kind === "news" || kind === "ticker" || kind === "ai-training" ? "admin" : "admin.ai",
        executionMode: "perItem",
        payload: undefined,
        executeOne: async (id) => {
          if (kind === "rules") await adminFetch(`/api/admin/rules/${encodeURIComponent(id)}`, { method: "DELETE" });
          else if (kind === "news") await adminFetch(`/admin/news/${encodeURIComponent(id)}/actions/archive`, { method: "POST" });
          else if (kind === "ticker") await adminFetch(`/api/admin/ticker/items/${encodeURIComponent(id)}`, { method: "DELETE" });
          else await adminFetch(`/api/admin/ai/training/${encodeURIComponent(id)}`, { method: "DELETE" });
        },
        pending: true,
        successes: [],
        failures: [],
        partialFailure: false,
        refresh: load,
        auditContext: kind === "rules" ? "cms.rules" : kind === "news" ? "cms.news" : kind === "ticker" ? "cms.ticker" : "cms.ai",
      }, selectedIds);
      setSelectedIds([]);
    } finally {
      setBulkPending(false);
    }
  };
  let content = <div className="table-wrap"><ManageableList adapter={{ ...adapter, selectionEnabled: bulkEnabled }} rows={rows} onSelectionChange={setSelectedIds} /></div>;
  if (bulkEnabled) content = <>{selectedIds.length > 0 ? <button className="accent" onClick={() => void approveSelected()} disabled={bulkPending}>{bulkPending ? `${bulkLabel}...` : bulkLabel}</button> : null}{content}</>;
  if (loading) content = <p className="muted center">Loading...</p>;
  else if (rows.length === 0) content = <p className="muted center">No records found.</p>;
  return <section><div className="page-header"><h2>{definition.title}</h2><p className="muted">Canonical administrative collection.</p></div>{error ? <div className="alert">{error}</div> : null}{content}</section>;
}
