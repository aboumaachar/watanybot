import { useState, useEffect, useCallback } from "react";
import { adminFetch } from "../lib/api";

type KBNode = {
  id: number;
  title: string;
  category: string;
  content: string;
  source?: string;
  updated_at?: string;
};

export default function KBEditorPage() {
  const [nodes, setNodes] = useState<KBNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<KBNode | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = search ? `?q=${encodeURIComponent(search)}` : "";
      const res = await adminFetch(`/api/admin/kb${params}`);
      const body = await res.json();
      setNodes(body.nodes ?? []);
    } catch (err) {
      console.error("Failed to load KB nodes", err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  function selectNode(node: KBNode) {
    setSelected(node);
    setEditContent(node.content);
  }

  async function saveNode() {
    if (!selected) return;
    setSaving(true);
    try {
      await adminFetch(`/api/admin/kb/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify({ content: editContent }),
      });
      setNodes((prev) =>
        prev.map((n) => (n.id === selected.id ? { ...n, content: editContent } : n))
      );
      setSelected({ ...selected, content: editContent });
    } catch (err) {
      console.error("Save KB node failed", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Knowledge Base Editor</h2>
        <p className="muted">Browse and edit KB nodes. Changes are reflected in search immediately.</p>
      </div>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search KB by title or content…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <button className="ghost" onClick={load}>
          Refresh
        </button>
      </div>

      <div className="kb-editor-layout">
        {/* Node list */}
        <div className="kb-node-list">
          {loading && <div className="muted">Loading…</div>}
          {!loading && nodes.length === 0 && <div className="muted">No KB nodes found.</div>}
          {nodes.map((n) => (
            <button
              key={n.id}
              className={`kb-node-row ${selected?.id === n.id ? "active" : ""}`}
              onClick={() => selectNode(n)}
            >
              <div className="kb-node-title">{n.title || `Node #${n.id}`}</div>
              <div className="kb-node-meta">
                <span className="tag">{n.category}</span>
                {n.source && <span className="muted">{n.source}</span>}
              </div>
            </button>
          ))}
        </div>

        {/* Editor pane */}
        <div className="kb-editor-pane">
          {!selected && (
            <div className="muted center-msg">Select a node to view and edit its content.</div>
          )}
          {selected && (
            <>
              <div className="kb-editor-header">
                <h3>{selected.title || `Node #${selected.id}`}</h3>
                <span className="tag">{selected.category}</span>
              </div>
              <textarea
                className="kb-editor-textarea"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={20}
              />
              <div className="form-actions">
                <button className="accent" onClick={saveNode} disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </button>
                <button className="ghost" onClick={() => setEditContent(selected.content)}>
                  Discard
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
