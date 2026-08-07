import KBEditorPage from "./KBEditorPage";

export default function AdminKBStudioPage() {
  return (
    <div>
      <div className="page-header">
        <h2>KB Studio</h2>
        <p className="muted">Knowledge Base Studio</p>
        <p className="muted">Source-backed knowledge editor</p>
      </div>
      <KBEditorPage />
    </div>
  );
}
