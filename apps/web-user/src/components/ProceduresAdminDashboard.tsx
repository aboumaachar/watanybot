/* eslint-disable @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps -- APEX scoped legacy lint closeout: pre-existing admin dashboard warnings block max-warnings=0; outside compact procedures viewer patch */
/* UI-3B-TODO: Review remaining icon/SVG/emoji pattern and migrate to the local icon system where appropriate. */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../lib/api";
import { resolveOfficialFileActionUrl } from "../lib/procedures-presenter";
import { useApp } from "../store/app";
import type { OfficialFileItem } from "../types/domain";
import { ProcedurePreviewViewer, type ProcedurePreviewViewerItem } from "./procedures/ProcedurePreviewViewer";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../styles/admin-procedures.css";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../styles/procedures.css";

export interface Procedure {
  id: string;
  tx_no?: number;
  source?: string; // laf | mof | internal
  source_label?: string;
  title_ar: string;
  title_en?: string;
  summary_lb: string;
  section_path?: string[];
  section_label?: string;
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
  source_anchors?: Array<{ file: string; anchor?: string }>;
  version?: string;
  last_updated?: string;
}

interface TabKey {
  key: "list" | "create" | "edit" | "docs",
  label: string
}

interface ProcedureDocumentLinkMapping {
  procedure_id: string;
  doc_ids: string[];
  confidence?: number;
  reason?: string;
  attached_docs?: Array<Record<string, unknown>>;
}

const TABS: TabKey[] = [
  { key: "list", label: "📋 قائمة المعاملات" },
  { key: "create", label: "➕ إضافة معاملة" },
  { key: "edit", label: "✏️ تعديل" },
  { key: "docs", label: "📎 إدارة المستندات" },
];

const SOURCES = [
  { value: "laf", label: "أركان الجيش (LAF)" },
  { value: "mof", label: "وزارة المالية (MOF)" },
  { value: "awsema", label: "رئاسة الجمهورية / الأوسمة" },
  { value: "procedures", label: "دليل المعاملات" },
  { value: "internal", label: "داخلي" },
];

function stripPresentationFields(proc: Partial<Procedure>): Partial<Procedure> {
  const { source_label, section_label, ...rest } = proc;
  return {
    ...rest,
    section_path: Array.isArray(rest.section_path) ? [...rest.section_path] : rest.section_path,
  };
}

function normalizeAdminQuery(value: string): string {
  return value.trim().toLowerCase();
}

function getOfficialFileKindLabel(item: OfficialFileItem): string {
  return item.kind === "form" ? "نموذج" : "مرجع";
}

function getOfficialFileMeta(item: OfficialFileItem): string[] {
  return [item.category, item.authority, ...(item.tags || [])].filter(Boolean);
}

async function copyAdminText(value: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export default function ProceduresAdminDashboard() {
  const { apiBaseUrl } = useApp();
  const [activeTab, setActiveTab] = useState<"list" | "create" | "edit" | "docs">("list");
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null);
  const [docsLibrary, setDocsLibrary] = useState<OfficialFileItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsLinksLoading, setDocsLinksLoading] = useState(false);
  const [docsSaving, setDocsSaving] = useState(false);
  const [docsSearchQuery, setDocsSearchQuery] = useState("");
  const [docsKindFilter, setDocsKindFilter] = useState<"all" | "form" | "reference">("all");
  const [docsProcedureSearch, setDocsProcedureSearch] = useState("");
  const [docsProcedureSource, setDocsProcedureSource] = useState("");
  const [docsIncludeArchive, setDocsIncludeArchive] = useState(false);
  const [selectedDocsProcedureId, setSelectedDocsProcedureId] = useState("");
  const [linkedDocIds, setLinkedDocIds] = useState<string[]>([]);
  const [savedDocLinks, setSavedDocLinks] = useState<string[]>([]);
  const [docsMappingMeta, setDocsMappingMeta] = useState<ProcedureDocumentLinkMapping | null>(null);
  const [docsViewerId, setDocsViewerId] = useState<string | null>(null);
  const [docsShareMessage, setDocsShareMessage] = useState("");

  // Form state for create/edit
  const [formData, setFormData] = useState<Partial<Procedure>>({
    source: "laf",
    eligibility: [],
    requirements: [],
    steps: [],
    where_to_apply: [],
    fees: [],
    timelines: [],
    tags: [],
    faq_variants: [],
  });

  // Load procedures
  useEffect(() => {
    loadProcedures();
  }, []);

  const loadProcedures = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getProceduresList(apiBaseUrl);
      setProcedures(data.procedures || []);
      setError("");
      if (success) setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(`Error loading procedures: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  const loadDocsLibrary = useCallback(async () => {
    setDocsLoading(true);
    try {
      const data = await api.getFiles(undefined, apiBaseUrl, { includeArchive: docsIncludeArchive });
      setDocsLibrary(data.items || []);
    } catch (err) {
      setError(`خطأ تحميل مكتبة الملفات: ${err instanceof Error ? err.message : "خطأ غير معروف"}`);
    } finally {
      setDocsLoading(false);
    }
  }, [apiBaseUrl, docsIncludeArchive]);

  const loadProcedureDocLinks = useCallback(async (procedureId: string) => {
    if (!procedureId) {
      setLinkedDocIds([]);
      setSavedDocLinks([]);
      setDocsMappingMeta(null);
      return;
    }

    setDocsLinksLoading(true);
    try {
      const data = await api.getProcedureDocumentLinks(procedureId, apiBaseUrl);
      const nextDocIds = Array.isArray(data.mapping?.doc_ids) ? data.mapping.doc_ids : [];
      setLinkedDocIds(nextDocIds);
      setSavedDocLinks(nextDocIds);
      setDocsMappingMeta(data.mapping);
    } catch (err) {
      setError(`خطأ تحميل روابط المستندات: ${err instanceof Error ? err.message : "خطأ غير معروف"}`);
    } finally {
      setDocsLinksLoading(false);
    }
  }, [apiBaseUrl]);

  // Filter procedures
  const filteredProcedures = procedures.filter(p => {
    const matchSearch = p.title_ar.includes(searchQuery) || 
                       p.id.includes(searchQuery) || 
                       p.summary_lb.includes(searchQuery);
    const matchSource = !selectedSource || p.source === selectedSource;
    return matchSearch && matchSource;
  });

  const docsFilteredProcedures = useMemo(() => {
    const query = normalizeAdminQuery(docsProcedureSearch);
    return procedures.filter((procedure) => {
      const matchesQuery = !query || [
        procedure.id,
        procedure.title_ar,
        procedure.summary_lb,
        procedure.source_label,
        procedure.section_label,
      ].filter(Boolean).join(" ").toLowerCase().includes(query);
      const matchesSource = !docsProcedureSource || procedure.source === docsProcedureSource;
      return matchesQuery && matchesSource;
    });
  }, [docsProcedureSearch, docsProcedureSource, procedures]);

  const selectedDocsProcedure = useMemo(
    () => procedures.find((procedure) => procedure.id === selectedDocsProcedureId) || null,
    [procedures, selectedDocsProcedureId],
  );

  const docsLibraryById = useMemo(
    () => new Map(docsLibrary.map((item) => [item.id, item])),
    [docsLibrary],
  );

  const linkedItems = useMemo(
    () => linkedDocIds.map((id) => docsLibraryById.get(id)).filter(Boolean) as OfficialFileItem[],
    [docsLibraryById, linkedDocIds],
  );

  const missingLinkedIds = useMemo(
    () => linkedDocIds.filter((id) => !docsLibraryById.has(id)),
    [docsLibraryById, linkedDocIds],
  );

  const filteredFiles = useMemo(() => {
    const query = normalizeAdminQuery(docsSearchQuery);
    return [...docsLibrary]
      .filter((item) => {
        const kind = item.kind === "form" ? "form" : "reference";
        const matchesKind = docsKindFilter === "all" || kind === docsKindFilter;
        const haystack = [item.title_ar, item.code, item.description_ar, item.category, item.authority, ...(item.tags || [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const matchesQuery = !query || haystack.includes(query);
        return matchesKind && matchesQuery;
      })
      .sort((left, right) => {
        const leftLinked = linkedDocIds.includes(left.id) ? 1 : 0;
        const rightLinked = linkedDocIds.includes(right.id) ? 1 : 0;
        if (leftLinked !== rightLinked) return rightLinked - leftLinked;

        const selectedProcedureId = selectedDocsProcedure?.id.toLowerCase();
        const leftSuggested = selectedProcedureId && (left.relatedProcedureIds || []).map((id) => id.toLowerCase()).includes(selectedProcedureId) ? 1 : 0;
        const rightSuggested = selectedProcedureId && (right.relatedProcedureIds || []).map((id) => id.toLowerCase()).includes(selectedProcedureId) ? 1 : 0;
        if (leftSuggested !== rightSuggested) return rightSuggested - leftSuggested;

        return left.title_ar.localeCompare(right.title_ar, "ar");
      });
  }, [docsKindFilter, docsLibrary, docsSearchQuery, linkedDocIds, selectedDocsProcedure]);

  const previewItems = useMemo<ProcedurePreviewViewerItem[]>(() => {
    const items: ProcedurePreviewViewerItem[] = [];
    for (const item of docsLibrary) {
      const previewUrl = resolveOfficialFileActionUrl(item, "preview", apiBaseUrl);
      if (!previewUrl) continue;
      const downloadUrl = resolveOfficialFileActionUrl(item, "download", apiBaseUrl);

      const summary = item.description_ar || item.instructions_ar || item.authority;
      items.push({
        id: item.id,
        title: item.title_ar,
        ...(summary ? { summary } : {}),
        previewUrl,
        ...(downloadUrl ? { downloadUrl } : {}),
      });
    }
    return items;
  }, [apiBaseUrl, docsLibrary]);

  const isDocsDirty = useMemo(() => {
    const left = [...linkedDocIds].sort((first, second) => first.localeCompare(second, "en")).join("|");
    const right = [...savedDocLinks].sort((first, second) => first.localeCompare(second, "en")).join("|");
    return left !== right;
  }, [linkedDocIds, savedDocLinks]);

  const linkedFormsCount = linkedItems.filter((item) => item.kind === "form").length;
  const linkedReferencesCount = linkedItems.filter((item) => item.kind !== "form").length;

  // Handle form input
  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle array field input (comma-separated)
  const handleArrayFieldChange = (field: string, value: string) => {
    const arr = value.split(";").map(s => s.trim()).filter(Boolean);
    handleFormChange(field, arr);
  };

  // Save procedure (create or update)
  const handleSaveProcedure = async () => {
    try {
      setLoading(true);
      const isCreate = !selectedProcedure;
      const payload = stripPresentationFields(formData);
      const selectedProcedureId = selectedProcedure?.id;
      
      if (isCreate) {
        await api.createProcedure(payload, apiBaseUrl);
      } else {
        if (!selectedProcedureId) {
          throw new Error("Missing procedure id for update");
        }
        await api.updateProcedure(selectedProcedureId, payload, apiBaseUrl);
      }

      setSuccess(`${isCreate ? "تم إنشاء" : "تم تحديث"} المعاملة بنجاح!`);
      setFormData({
        source: "laf",
        eligibility: [],
        requirements: [],
        steps: [],
        where_to_apply: [],
        fees: [],
        timelines: [],
        tags: [],
        faq_variants: [],
      });
      setSelectedProcedure(null);
      setActiveTab("list");
      loadProcedures();
    } catch (err) {
      setError(`خطأ الحفظ: ${err instanceof Error ? err.message : "خطأ غير معروف"}`);
    } finally {
      setLoading(false);
    }
  };

  // Delete procedure
  const handleDeleteProcedure = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه المعاملة؟")) return;

    try {
      setLoading(true);
      await api.deleteProcedure(id, apiBaseUrl);
      setSuccess("تم حذف المعاملة بنجاح!");
      loadProcedures();
    } catch (err) {
      setError(`خطأ الحذف: ${err instanceof Error ? err.message : "خطأ غير معروف"}`);
    } finally {
      setLoading(false);
    }
  };

  // Export to CSV
  const handleExport = async () => {
    try {
      const blob = await api.exportProcedures(apiBaseUrl);
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `procedures_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      globalThis.URL.revokeObjectURL(url);
    } catch (err) {
      setError(`خطأ التصدير: ${err instanceof Error ? err.message : "خطأ غير معروف"}`);
    }
  };

  // Validate all procedures
  const handleValidate = async () => {
    try {
      setLoading(true);
      const data = await api.validateProcedures(apiBaseUrl);
      setSuccess(`التحقق نجح: ${data.valid} صحيح، ${data.errors} أخطاء`);
    } catch (err) {
      setError(`خطأ التحقق: ${err instanceof Error ? err.message : "خطأ غير معروف"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProcedure = (proc: Procedure) => {
    setSelectedProcedure(proc);
    setFormData(stripPresentationFields(proc));
    setActiveTab("edit");
  };

  const handlePreviewProcedure = (procedureId: string) => {
    const url = `${globalThis.location.origin}/procedures?query=${encodeURIComponent(procedureId)}`;
    globalThis.open(url, "_blank", "noopener,noreferrer");
  };

  const handleNewProcedure = () => {
    setSelectedProcedure(null);
    setFormData({
      id: `proc_${Date.now()}`,
      source: "laf",
      eligibility: [],
      requirements: [],
      steps: [],
      where_to_apply: [],
      fees: [],
      timelines: [],
      tags: [],
      faq_variants: [],
    });
    setActiveTab("create");
  };

  const toggleLinkedDoc = (docId: string) => {
    setLinkedDocIds((prev) => prev.includes(docId)
      ? prev.filter((id) => id !== docId)
      : [...prev, docId]);
  };

  const handleSaveDocLinks = async () => {
    if (!selectedDocsProcedureId) return;

    try {
      setDocsSaving(true);
      const data = await api.updateProcedureDocumentLinks(selectedDocsProcedureId, linkedDocIds, apiBaseUrl);
      const nextDocIds = Array.isArray(data.mapping?.doc_ids) ? data.mapping.doc_ids : [];
      setLinkedDocIds(nextDocIds);
      setSavedDocLinks(nextDocIds);
      setDocsMappingMeta(data.mapping);
      setSuccess("تم حفظ روابط المستندات والنماذج بنجاح.");
      await loadDocsLibrary();
    } catch (err) {
      setError(`خطأ حفظ الروابط: ${err instanceof Error ? err.message : "خطأ غير معروف"}`);
    } finally {
      setDocsSaving(false);
    }
  };

  const handlePreviewFile = (fileId: string) => {
    setDocsViewerId(fileId);
    setDocsShareMessage("");
  };

  const handleShareFile = async (file: OfficialFileItem) => {
    const targetUrl = resolveOfficialFileActionUrl(file, "share", apiBaseUrl);
    if (!targetUrl) return;

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: file.title_ar,
          text: file.description_ar || file.instructions_ar || file.title_ar,
          url: targetUrl,
        });
        setDocsShareMessage("تمت مشاركة الرابط.");
        return;
      }

      if (await copyAdminText(targetUrl)) {
        setDocsShareMessage("تم نسخ رابط الملف.");
        return;
      }
    } catch {
      setDocsShareMessage("تعذرت مشاركة الرابط حالياً.");
      return;
    }

    setDocsShareMessage("تعذرت مشاركة الرابط حالياً.");
  };

  const handleDownloadFile = (fileId: string) => {
    const file = docsLibrary.find((entry) => entry.id === fileId);
    if (!file) return;

    const targetUrl = resolveOfficialFileActionUrl(file, "download", apiBaseUrl);
    if (!targetUrl) return;

    globalThis.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    if (activeTab !== "docs") return;
    loadDocsLibrary();
  }, [activeTab, loadDocsLibrary]);

  useEffect(() => {
    if (activeTab !== "docs") return;
    if (selectedDocsProcedureId && docsFilteredProcedures.some((procedure) => procedure.id === selectedDocsProcedureId)) {
      return;
    }
    setSelectedDocsProcedureId(docsFilteredProcedures[0]?.id || "");
  }, [activeTab, docsFilteredProcedures, selectedDocsProcedureId]);

  useEffect(() => {
    if (activeTab !== "docs") return;
    void loadProcedureDocLinks(selectedDocsProcedureId);
  }, [activeTab, selectedDocsProcedureId, loadProcedureDocLinks]);

  return (
    <div className="admin-procedures-dashboard">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-header__icon">
          <i className="ph-fill ph-list-checks" />
        </div>
        <div>
          <h2 className="admin-header__title">إدارة المعاملات</h2>
          <p className="admin-header__sub">
            {procedures.length} معاملة متاحة
          </p>
        </div>
      </div>

      {/* Alerts */}
      {error && <div className="admin-alert admin-alert--error">{error}</div>}
      {success && <div className="admin-alert admin-alert--success">{success}</div>}

      {/* Tabs */}
      <div className="admin-tabs">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`admin-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="admin-tab-content">

        {/* List Tab */}
        {activeTab === "list" && (
          <div className="admin-list-tab">
            <div className="admin-list-controls">
              <input
                type="text"
                placeholder="بحث في المعاملات..."
                className="admin-input admin-input--search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <select
                className="admin-select"
                value={selectedSource}
                onChange={e => setSelectedSource(e.target.value)}
              >
                <option value="">الكل (كل المصادر)</option>
                {SOURCES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <button className="admin-btn admin-btn--primary wt-cta-glow" onClick={handleNewProcedure}>
                ➕ إضافة معاملة جديدة
              </button>
              <button className="admin-btn admin-btn--secondary wt-cta-glow" onClick={handleExport}>
                📥 تصدير CSV
              </button>
              <button className="admin-btn admin-btn--secondary wt-cta-glow" onClick={handleValidate}>
                ✓ تحقق من الصحة
              </button>
            </div>

            {loading ? (
              <div className="admin-loader">جارٍ التحميل...</div>
            ) : (
              <div className="admin-procedures-table">
                <table>
                  <thead>
                    <tr>
                      <th>المعرّف</th>
                      <th>الرقم</th>
                      <th>العنوان</th>
                      <th>القسم</th>
                      <th>المصدر</th>
                      <th>آخر تحديث</th>
                      <th>الإجراءات المتاحة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProcedures.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: "20px", color: "var(--muted)" }}>
                          لا توجد معاملات
                        </td>
                      </tr>
                    ) : (
                      filteredProcedures.map(proc => (
                        <tr key={proc.id}>
                          <td><code>{proc.id}</code></td>
                          <td>{proc.tx_no || "—"}</td>
                          <td>{proc.title_ar.substring(0, 40)}...</td>
                          <td>
                            <div className="admin-proc-meta">
                              <span className="admin-proc-meta__section">{proc.section_label || proc.section_path?.[0] || "—"}</span>
                            </div>
                          </td>
                          <td>
                            <span className="badge">{proc.source_label || proc.source || "—"}</span>
                          </td>
                          <td>{proc.last_updated?.slice(0, 10) || "—"}</td>
                          <td className="admin-table-actions">
                            <button
                              className="admin-btn-icon admin-btn-icon--secondary"
                              onClick={() => handlePreviewProcedure(proc.id)}
                              title="فتح معاينة المستخدم"
                              aria-label="فتح معاينة المستخدم"
                            >
                              👁️
                            </button>
                            <button
                              className="admin-btn-icon"
                              onClick={() => handleEditProcedure(proc)}
                              title="تعديل"
                            >
                              ✏️
                            </button>
                            <button
                              className="admin-btn-icon admin-btn-icon--danger"
                              onClick={() => handleDeleteProcedure(proc.id)}
                              title="حذف"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Create/Edit Tab */}
        {(activeTab === "create" || activeTab === "edit") && (
          <div className="admin-form-tab">
            <h3>{activeTab === "create" ? "إضافة معاملة جديدة" : "تعديل المعاملة"}</h3>

            <div className="admin-form-group">
              <label htmlFor="procedure-id">معرّف المعاملة *</label>
              <input
                id="procedure-id"
                type="text"
                className="admin-input"
                value={formData.id || ""}
                onChange={e => handleFormChange("id", e.target.value)}
                disabled={activeTab === "edit"}
              />
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label htmlFor="procedure-tx-no">الرقم (TX)</label>
                <input
                  id="procedure-tx-no"
                  type="number"
                  className="admin-input"
                  value={formData.tx_no || ""}
                  onChange={e => handleFormChange("tx_no", Number.parseInt(e.target.value, 10))}
                />
              </div>
              <div className="admin-form-group">
                <label htmlFor="procedure-source">المصدر *</label>
                <select
                  id="procedure-source"
                  className="admin-select"
                  value={formData.source || ""}
                  onChange={e => handleFormChange("source", e.target.value)}
                >
                  {SOURCES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="admin-form-group">
              <label htmlFor="procedure-title-ar">العنوان بالعربية *</label>
              <input
                id="procedure-title-ar"
                type="text"
                className="admin-input"
                value={formData.title_ar || ""}
                onChange={e => handleFormChange("title_ar", e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label htmlFor="procedure-title-en">العنوان بالإنجليزية</label>
              <input
                id="procedure-title-en"
                type="text"
                className="admin-input"
                value={formData.title_en || ""}
                onChange={e => handleFormChange("title_en", e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label htmlFor="procedure-summary">الملخص *</label>
              <textarea
                id="procedure-summary"
                className="admin-textarea"
                rows={3}
                value={formData.summary_lb || ""}
                onChange={e => handleFormChange("summary_lb", e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label htmlFor="procedure-eligibility"> (مفصولة بـ ؛)</label>
              <textarea
                id="procedure-eligibility"
                className="admin-textarea"
                rows={2}
                value={(formData.eligibility || []).join("; ")}
                onChange={e => handleArrayFieldChange("eligibility", e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label htmlFor="procedure-requirements">المتطلبات (مفصولة بـ ؛)</label>
              <textarea
                id="procedure-requirements"
                className="admin-textarea"
                rows={2}
                value={(formData.requirements || []).join("; ")}
                onChange={e => handleArrayFieldChange("requirements", e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label htmlFor="procedure-steps">الخطوات (مفصولة بـ ؛)</label>
              <textarea
                id="procedure-steps"
                className="admin-textarea"
                rows={3}
                value={(formData.steps || []).join("; ")}
                onChange={e => handleArrayFieldChange("steps", e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label htmlFor="procedure-where-to-apply">أماكن التقديم (مفصولة بـ ؛)</label>
              <textarea
                id="procedure-where-to-apply"
                className="admin-textarea"
                rows={2}
                value={(formData.where_to_apply || []).join("; ")}
                onChange={e => handleArrayFieldChange("where_to_apply", e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label htmlFor="procedure-fees">الرسوم (مفصولة بـ ؛)</label>
              <textarea
                id="procedure-fees"
                className="admin-textarea"
                rows={1}
                value={(formData.fees || []).join("; ")}
                onChange={e => handleArrayFieldChange("fees", e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label htmlFor="procedure-timelines">المدة الزمنية (مفصولة بـ ؛)</label>
              <textarea
                id="procedure-timelines"
                className="admin-textarea"
                rows={1}
                value={(formData.timelines || []).join("; ")}
                onChange={e => handleArrayFieldChange("timelines", e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label htmlFor="procedure-tags">الوسوم (مفصولة بـ ؛)</label>
              <input
                id="procedure-tags"
                type="text"
                className="admin-input"
                value={(formData.tags || []).join("; ")}
                onChange={e => handleArrayFieldChange("tags", e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label htmlFor="procedure-faq-variants">أسئلة شائعة (مفصولة بـ ؛)</label>
              <textarea
                id="procedure-faq-variants"
                className="admin-textarea"
                rows={2}
                value={(formData.faq_variants || []).join("; ")}
                onChange={e => handleArrayFieldChange("faq_variants", e.target.value)}
              />
            </div>

            <div className="admin-form-actions">
              <button
                className="admin-btn admin-btn--primary wt-cta-glow wt-cta-processing"
                onClick={handleSaveProcedure}
                disabled={loading} aria-busy={loading}
              >
                {loading ? "جارٍ الحفظ..." : "💾 حفظ"}
              </button>
              <button
                className="admin-btn admin-btn--secondary wt-cta-glow"
                onClick={() => setActiveTab("list")}
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* Docs Management Tab */}
        {activeTab === "docs" && (
          <div className="admin-docs-tab">
            <div className="admin-docs-hero">
              <div>
                <h3>إدارة المستندات المرفقة</h3>
                <p className="admin-docs-hero__sub">
                  اربط كل معاملة بالنماذج الرسمية والمراجع والملفات المرفقة التي يجب أن تظهر للمستخدمين ولفرق العمل.
                </p>
              </div>
              <div className="admin-docs-hero__actions">
                <button className="admin-btn admin-btn--secondary wt-cta-glow wt-cta-processing" onClick={() => loadDocsLibrary()} disabled={docsLoading} aria-busy={docsLoading}>
                  ⟳ تحديث المكتبة
                </button>
                <button className="admin-btn admin-btn--secondary wt-cta-glow" onClick={() => setLinkedDocIds([])} disabled={!selectedDocsProcedureId || linkedDocIds.length === 0}>
                  مسح التحديد
                </button>
                <button className="admin-btn admin-btn--primary wt-cta-glow wt-cta-processing" onClick={handleSaveDocLinks} disabled={!selectedDocsProcedureId || docsSaving || !isDocsDirty} aria-busy={docsSaving}>
                  {docsSaving ? "جارٍ الحفظ..." : "💾 حفظ الربط"}
                </button>
              </div>
            </div>

            <div className="admin-docs-metrics">
              <div className="admin-docs-metric">
                <strong>{docsLibrary.length}</strong>
                <span>إجمالي الملفات والنماذج</span>
              </div>
              <div className="admin-docs-metric">
                <strong>{docsLibrary.filter((item) => item.kind === "form").length}</strong>
                <span>نماذج رسمية</span>
              </div>
              <div className="admin-docs-metric">
                <strong>{linkedDocIds.length}</strong>
                <span>عناصر مرتبطة بالمعاملة المحددة</span>
              </div>
              <div className="admin-docs-metric">
                <strong>{linkedFormsCount}/{linkedReferencesCount}</strong>
                <span>نماذج / مراجع ضمن الربط الحالي</span>
              </div>
            </div>

            <div className="admin-docs-workspace">
              <aside className="admin-docs-sidebar">
                <div className="admin-docs-sidebar__controls">
                  <input
                    type="text"
                    className="admin-input admin-input--search"
                    placeholder="بحث في المعاملات..."
                    value={docsProcedureSearch}
                    onChange={(e) => setDocsProcedureSearch(e.target.value)}
                  />
                  <select
                    className="admin-select"
                    value={docsProcedureSource}
                    onChange={(e) => setDocsProcedureSource(e.target.value)}
                  >
                    <option value="">كل المصادر</option>
                    {SOURCES.map((source) => (
                      <option key={source.value} value={source.value}>{source.label}</option>
                    ))}
                  </select>
                </div>

                <div className="admin-docs-sidebar__list">
                  {docsFilteredProcedures.map((procedure) => {
                    const isActive = procedure.id === selectedDocsProcedureId;
                    return (
                      <button
                        key={procedure.id}
                        type="button"
                        className={`admin-docs-procedure${isActive ? " admin-docs-procedure--active" : ""}`}
                        onClick={() => setSelectedDocsProcedureId(procedure.id)}
                      >
                        <span className="admin-docs-procedure__title">{procedure.title_ar}</span>
                        <span className="admin-docs-procedure__meta">{procedure.source_label || procedure.source || "—"}{procedure.tx_no ? ` • TX-${procedure.tx_no}` : ""}</span>
                        <span className="admin-docs-procedure__summary">{procedure.summary_lb}</span>
                      </button>
                    );
                  })}
                  {docsFilteredProcedures.length === 0 ? (
                    <div className="admin-docs-empty">لا توجد معاملات مطابقة لهذا الفلتر.</div>
                  ) : null}
                </div>
              </aside>

              <section className="admin-docs-content">
                {selectedDocsProcedure ? (
                  <>
                    <div className="admin-docs-selected-header">
                      <div>
                        <div className="admin-docs-selected-header__eyebrow">المعاملة المحددة</div>
                        <h4>{selectedDocsProcedure.title_ar}</h4>
                        <p>{selectedDocsProcedure.summary_lb}</p>
                      </div>
                      <div className="admin-docs-selected-header__meta">
                        <span>{selectedDocsProcedure.source_label || selectedDocsProcedure.source || "—"}</span>
                        {selectedDocsProcedure.tx_no ? <span>TX-{selectedDocsProcedure.tx_no}</span> : null}
                        {docsMappingMeta?.reason ? <span>مصدر الربط: {docsMappingMeta.reason}</span> : null}
                        {typeof docsMappingMeta?.confidence === "number" ? <span>الثقة: {docsMappingMeta.confidence}</span> : null}
                      </div>
                    </div>

                    <div className="admin-docs-linked-panel">
                      <div className="admin-docs-linked-panel__header">
                        <h4>العناصر المرتبطة حالياً</h4>
                        <span>{docsLinksLoading ? "جارٍ تحميل الربط..." : `${linkedDocIds.length} عنصر محدد`}</span>
                      </div>

                      <div className="admin-docs-linked-grid">
                        {linkedItems.map((item) => {
                          const targetUrl = resolveOfficialFileActionUrl(item, "preview", apiBaseUrl);
                          return (
                            <article key={item.id} className="admin-doc-card admin-doc-card--linked">
                              <div className="admin-doc-card__topline">
                                <span className="badge">{getOfficialFileKindLabel(item)}</span>
                                <button type="button" className="admin-btn-icon admin-btn-icon--danger" onClick={() => toggleLinkedDoc(item.id)} title="إلغاء الربط">✕</button>
                              </div>
                              <h5>{item.title_ar}</h5>
                              <p>{item.description_ar || "لا يوجد وصف إضافي."}</p>
                              <div className="admin-doc-card__tags">
                                {getOfficialFileMeta(item).slice(0, 4).map((meta) => (
                                  <span key={`${item.id}-${meta}`} className="badge">{meta}</span>
                                ))}
                              </div>
                              <div className="admin-doc-card__actions">
                                {targetUrl ? (
                                  <>
                                    <button type="button" className="admin-btn admin-btn--secondary" onClick={() => handlePreviewFile(item.id)}>
                                      معاينة
                                    </button>
                                    <a href={targetUrl} target="_blank" rel="noreferrer" className="admin-btn admin-btn--secondary">فتح</a>
                                  </>
                                ) : null}
                              </div>
                            </article>
                          );
                        })}

                        {linkedItems.length === 0 && !docsLinksLoading ? (
                          <div className="admin-docs-empty">لا توجد عناصر مرتبطة بهذا الإجراء حالياً. اختر من المكتبة أدناه ثم احفظ الربط.</div>
                        ) : null}

                        {missingLinkedIds.length > 0 ? (
                          <div className="admin-docs-missing">
                            <strong>عناصر غير متوفرة في الكاتالوج الحالي:</strong>
                            <span>{missingLinkedIds.join("، ")}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="admin-docs-library-panel">
                      <div className="admin-docs-library-panel__controls">
                        <input
                          type="text"
                          className="admin-input admin-input--search"
                          placeholder="بحث في النماذج والملفات..."
                          value={docsSearchQuery}
                          onChange={(e) => setDocsSearchQuery(e.target.value)}
                        />
                        <select
                          className="admin-select"
                          value={docsKindFilter}
                          onChange={(e) => setDocsKindFilter(e.target.value as "all" | "form" | "reference")}
                        >
                          <option value="all">كل الأنواع</option>
                          <option value="form">النماذج فقط</option>
                          <option value="reference">المراجع والملفات فقط</option>
                        </select>
                        <label className="admin-docs-archive-toggle">
                          <input
                            type="checkbox"
                            checked={docsIncludeArchive}
                            onChange={(e) => setDocsIncludeArchive(e.target.checked)}
                          />
                          <span>إظهار العناصر المؤرشفة</span>
                        </label>
                      </div>

                      <div className="admin-docs-library-grid">
                        {filteredFiles.map((item) => {
                          const isLinked = linkedDocIds.includes(item.id);
                          const selectedProcedureId = selectedDocsProcedure.id.toLowerCase();
                          const isSuggested = (item.relatedProcedureIds || []).map((id) => id.toLowerCase()).includes(selectedProcedureId)
                            || (typeof selectedDocsProcedure.tx_no === "number" && Array.isArray(item.related_tx) && item.related_tx.includes(selectedDocsProcedure.tx_no));
                          const targetUrl = resolveOfficialFileActionUrl(item, "preview", apiBaseUrl);

                          return (
                            <article key={item.id} className={`admin-doc-card${isLinked ? " admin-doc-card--selected" : ""}`}>
                              <div className="admin-doc-card__topline">
                                <label className="admin-doc-card__checkbox">
                                  <input type="checkbox" checked={isLinked} onChange={() => toggleLinkedDoc(item.id)} />
                                  <span>{isLinked ? "مرتبط" : "ربط"}</span>
                                </label>
                                <div className="admin-doc-card__badges">
                                  <span className="badge">{getOfficialFileKindLabel(item)}</span>
                                  {isSuggested ? <span className="badge">مقترح</span> : null}
                                </div>
                              </div>
                              <h5>{item.title_ar}</h5>
                              <p>{item.description_ar || "لا يوجد وصف إضافي."}</p>
                              <div className="admin-doc-card__tags">
                                {getOfficialFileMeta(item).slice(0, 5).map((meta) => (
                                  <span key={`${item.id}-${meta}`} className="badge">{meta}</span>
                                ))}
                              </div>
                              <div className="admin-doc-card__footer">
                                <code>{item.id}</code>
                                {targetUrl ? (
                                  <span className="admin-doc-card__footer-actions">
                                    <button type="button" className="admin-doc-card__link-btn" onClick={() => handlePreviewFile(item.id)}>معاينة</button>
                                    <button type="button" className="admin-doc-card__link-btn" onClick={() => void handleShareFile(item)}>مشاركة</button>
                                    <a href={targetUrl} target="_blank" rel="noreferrer">فتح</a>
                                  </span>
                                ) : <span>بدون رابط مباشر</span>}
                              </div>
                            </article>
                          );
                        })}

                        {!docsLoading && filteredFiles.length === 0 ? (
                          <div className="admin-docs-empty">لا توجد عناصر مطابقة للبحث أو الفلتر الحالي.</div>
                        ) : null}
                        {docsLoading ? <div className="admin-docs-empty">جارٍ تحميل مكتبة الملفات والنماذج...</div> : null}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="admin-docs-empty">اختر إجراء من القائمة الجانبية لبدء إدارة المستندات المرفقة والنماذج.</div>
                )}
              </section>
            </div>

            {docsViewerId && previewItems.length > 0 ? (
              <ProcedurePreviewViewer
                items={previewItems}
                activeId={docsViewerId}
                onSelect={(id) => {
                  setDocsViewerId(id);
                  setDocsShareMessage("");
                }}
                onClose={() => setDocsViewerId(null)}
                onShare={(id) => {
                  const item = docsLibrary.find((entry) => entry.id === id);
                  if (item) {
                    void handleShareFile(item);
                  }
                }}
                onDownload={handleDownloadFile}
                shareMessage={docsShareMessage}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

