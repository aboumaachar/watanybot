import { CalendarInput } from '../components/aided-input';
import { defaultFeatureFlags, type FeatureCategory, type FeatureId } from "@watany/shared/features";
import { useEffect, useMemo, useState, type ComponentType, type ReactElement, type SVGProps } from "react";
import { WatanyFluentIcon, type WatanyIconName } from "../components/icons/WatanyFluentIcon";
// MainHybridChatSurface removed from superadmin page (not needed in management dashboard)
import {
  Brain24Regular,
  Building24Regular,
  ClipboardCheckmark24Regular,
  Clipboard24Regular,
  DocumentText24Regular,
  Eye24Regular,
  Link24Regular,
  Megaphone24Regular,
  Open24Regular,
  Poll24Regular,
  Settings24Regular,
  ShieldCheckmark24Regular,
  Warning24Regular,
} from "../theme/watany-v4/legacyIconBridge";
import ProceduresAdminDashboard from "../components/ProceduresAdminDashboard";
import RecruitmentAdminPanel from "../components/admin/RecruitmentAdminPanel";
import OfficialServicesAdminPanel from "../components/admin/OfficialServicesAdminPanel";
import SurveyAdminPanel from "../components/admin/SurveyAdminPanel";
import TaxiMobilityAdminPanel from "../components/admin/TaxiMobilityAdminPanel";
import HybridKbIndexAdminPanel from "../components/superadmin/HybridKbIndexAdminPanel";
import { api } from "../lib/api";
import type { FormGovernanceSummary, FormListItem, FormReviewStatus } from "../lib/api";
import type { OfficialFileItem } from "../types/domain";
import { useApp } from "../store/app";
import { CATEGORY_LABELS, FEATURES, useFeatureFlags } from "../store/features";
import { FormViewer } from "../components/FormViewer";
import "../styles/superadmin.css";
import { useNavigate } from "react-router-dom";
import { FEATURE_AUDIT, SURFACE_LABELS } from "../lib/admin-feature-health";

import { SuperAdminCriticalDashboardShell } from "../components/superadmin/SuperAdminCriticalDashboardShell";
import { SuperAdminTaxiDashboardPreviewPanel } from "../components/superadmin/SuperAdminTaxiDashboardPreviewPanel";
type PaymentQuestion = {
  id: string;
  text: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type PaymentAnswer = {
  id: string;
  questionId: string;
  value: string;
  isActive: boolean;
  activateAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  createdBy: string;
};

type Announcement = {
  id: string;
  text: string;
  enabled: boolean;
  createdAt: string;
};

type AdminPaymentsDashboard = {
  questions: PaymentQuestion[];
  activeAnswers: PaymentAnswer[];
  scheduledAnswers: PaymentAnswer[];
  answers: PaymentAnswer[];
  announcements: Announcement[];
  activeAnnouncements: Announcement[];
};

type SuperAdminTabId = "control-center" | "payments" | "recruitment" | "procedures" | "forms" | "documents" | "official-services" | "taxi" | "voting" | "features" | "visibility" | "intelligence";

const SUPER_ADMIN_TABS: Array<{ id: SuperAdminTabId; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }> = [
  { id: "control-center", label: "مركز التحكم", icon: ShieldCheckmark24Regular },
  { id: "recruitment", label: "التعاميم", icon: Megaphone24Regular },
  { id: "procedures", label: "المعاملات", icon: ClipboardCheckmark24Regular },
  { id: "forms", label: "نماذج", icon: Clipboard24Regular },
  { id: "documents", label: "المستندات", icon: DocumentText24Regular },
  { id: "official-services", label: "الخدمات الرسمية", icon: Building24Regular },
  { id: "taxi", label: "التاكسي الموثوق", icon: ShieldCheckmark24Regular },
  { id: "voting", label: "الاستطلاعات", icon: Poll24Regular },
  { id: "features", label: "Feature Flags", icon: Settings24Regular },
  { id: "visibility", label: "مرئية الخدمات", icon: Eye24Regular },
  { id: "intelligence", label: "ذكاء الأسئلة", icon: Brain24Regular },
];

const EMPTY_DASHBOARD: AdminPaymentsDashboard = {
  questions: [],
  activeAnswers: [],
  scheduledAnswers: [],
  answers: [],
  announcements: [],
  activeAnnouncements: [],
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "غير محدد";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "غير محدد";
  return new Intl.DateTimeFormat("ar-LB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "غير محدد";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "غير محدد";
  return new Intl.DateTimeFormat("ar-LB", {
    dateStyle: "medium",
  }).format(parsed);
}

function getFormReviewStatusLabel(status?: FormReviewStatus): string {
  switch (status) {
    case "approved":
      return "معتمد";
    case "under_review":
      return "قيد المراجعة";
    case "needs_source":
      return "يحتاج مرجعاً";
    case "deprecated":
      return "متقادم";
    case "fallback_only":
      return "Fallback فقط";
    default:
      return "غير محدد";
  }
}

function getFormReviewStatusBadgeClass(status?: FormReviewStatus): string {
  switch (status) {
    case "approved":
      return "admin-payments-badge admin-payments-badge--active";
    case "under_review":
      return "admin-payments-badge admin-payments-badge--review";
    case "needs_source":
    case "fallback_only":
      return "admin-payments-badge admin-payments-badge--danger";
    case "deprecated":
    default:
      return "admin-payments-badge admin-payments-badge--muted";
  }
}

function getGovernanceIssueCount(summary: FormGovernanceSummary): number {
  return summary.blockingIssues.missingSourceCoverage.length
    + summary.blockingIssues.duplicates.length
    + summary.blockingIssues.missingGovernance.length
    + summary.blockingIssues.brokenActionUrls.length
    + summary.blockingIssues.approvedWithoutEvidence.length;
}

// getFormGovernanceNote removed — helper unused in current UI

function formatTags(raw: string): string[] {
  return raw
    .split(/[،,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toIsoOrNull(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function toDateTimeLocalValue(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const timezoneOffsetMs = parsed.getTimezoneOffset() * 60 * 1000;
  return new Date(parsed.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function questionLabel(question: PaymentQuestion): string {
  return question.text.trim() || question.id;
}

function answerStatus(answer: PaymentAnswer): { label: string; tone: "active" | "scheduled" | "muted" } {
  const now = Date.now();
  const activateAt = answer.activateAt ? Date.parse(answer.activateAt) : null;
  const expiresAt = answer.expiresAt ? Date.parse(answer.expiresAt) : null;

  if (!answer.isActive) {
    return { label: "مؤرشف", tone: "muted" };
  }
  if (activateAt && activateAt > now) {
    return { label: "مجدول", tone: "scheduled" };
  }
  if (expiresAt && expiresAt <= now) {
    return { label: "منتهي", tone: "muted" };
  }
  return { label: "نشط", tone: "active" };
}

/* ── Question Intelligence Panel (admin view of chat input data) ── */
type QCluster = { id: string; normalizedKey: string; count: number; lastSeen: string; samples: string[]; unanswered: boolean };
type AnswerOverride = { id: string; matchPattern: string; answer: string; active: boolean; createdAt: string };

function QuestionIntelligencePanel({ apiBaseUrl }: Readonly<{ apiBaseUrl: string }>) {
  const [recent, setRecent] = useState<{ id: string; message: string; ts: string; unanswered?: boolean }[]>([]);
  const [clusters, setClusters] = useState<QCluster[]>([]);
  const [unanswered, setUnanswered] = useState<QCluster[]>([]);
  const [override, setOverride] = useState({ pattern: "", answer: "" });
  const [overrides, setOverrides] = useState<AnswerOverride[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    // Load recent chat inputs
    fetch(`${apiBaseUrl}/admin/chat-inputs?limit=20`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.items && setRecent(d.items))
      .catch(() => {});
    // Load question clusters (most asked)
    fetch(`${apiBaseUrl}/admin/question-clusters?sort=count&limit=20`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.clusters && setClusters(d.clusters))
      .catch(() => {});
    // Load unanswered clusters
    fetch(`${apiBaseUrl}/admin/question-clusters?unanswered=true&limit=20`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.clusters && setUnanswered(d.clusters))
      .catch(() => {});
    // Load admin answer overrides
    fetch(`${apiBaseUrl}/admin/answer-overrides`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.overrides && setOverrides(d.overrides))
      .catch(() => {});
  }, [apiBaseUrl]);

  async function handleSaveOverride() {
    if (!override.pattern.trim() || !override.answer.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiBaseUrl}/admin/answer-overrides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ matchPattern: override.pattern, answer: override.answer, active: true }),
      });
      if (res.ok) {
        const d = await res.json();
        setOverrides(prev => [...prev, d.override]);
        setOverride({ pattern: "", answer: "" });
        setNotice("تم حفظ الإجابة الإدارية بنجاح");
        setTimeout(() => setNotice(null), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      className="superadmin-page-shell"
      dir="rtl"
      data-watany-feature="superadmin"
      data-route-owner="superadmin"
      data-route-content
      data-page-content
    >
      <div className="superadmin-page-shell__phone">
        <div className="sa-intelligence-panel" data-superadmin-dashboard="true" data-superadmin-full-width="true" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 20 }}>
          <HybridKbIndexAdminPanel />
          {notice ? <div className="sa-notice" style={{ background: "#d4edda", padding: 10, borderRadius: 6 }}>{notice}</div> : null}

          <section>
            <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>آخر الأسئلة (recent)</h3>
            {recent.length === 0 ? <p style={{ color: "#999", fontSize: 13 }}>لا توجد أسئلة مسجلة بعد</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {recent.slice(0, 10).map((q) => (
                  <div key={q.id} style={{ padding: "7px 10px", background: "#f5f5f5", borderRadius: 6, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                    <span>{q.message}</span>
                    {q.unanswered ? <span style={{ color: "#c0392b", fontSize: 11 }}>بلا جواب</span> : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>أسئلة بلا جواب (unanswered)</h3>
            {unanswered.length === 0 ? <p style={{ color: "#999", fontSize: 13 }}>لا توجد أسئلة بلا إجابة</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {unanswered.map((c) => (
                  <div key={c.id} style={{ padding: "7px 10px", background: "#fff3cd", borderRadius: 6, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                    <span>{c.samples[0] ?? c.normalizedKey}</span>
                    <span style={{ color: "#856404" }}>{c.count}×</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>إضافة إجابة إدارية (override)</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                type="text"
                placeholder="نمط السؤال (مثال: كيف أحسب راتبي)"
                value={override.pattern}
                onChange={(e) => setOverride((p) => ({ ...p, pattern: e.target.value }))}
                style={{ padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6, fontSize: 13 }}
              />
              <textarea
                placeholder="الإجابة المخصصة"
                value={override.answer}
                onChange={(e) => setOverride((p) => ({ ...p, answer: e.target.value }))}
                rows={3}
                style={{ padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6, fontSize: 13, resize: "vertical" }}
              />
              <button
                type="button"
                disabled={saving || !override.pattern.trim() || !override.answer.trim()}
                onClick={handleSaveOverride}
                style={{ padding: "8px 16px", background: "var(--accent, #0066cc)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}
              >
                {saving ? "جاري الحفظ…" : "حفظ الإجابة"}
              </button>
            </div>
            {overrides.some((o) => o.active) ? (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                {overrides.filter((o) => o.active).map((o) => (
                  <div key={o.id} style={{ padding: "7px 10px", background: "#e8f4fd", borderRadius: 6, fontSize: 12 }}>
                    <div style={{ fontWeight: 600 }}>{o.matchPattern}</div>
                    <div style={{ color: "#555", marginTop: 2 }}>{o.answer.slice(0, 80)}{o.answer.length > 80 ? "…" : ""}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section>
            <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>الأسئلة الأكثر تكراراً (question clusters)</h3>
            {clusters.length === 0 ? <p style={{ color: "#999", fontSize: 13 }}>لا توجد مجموعات بعد</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {clusters.slice(0, 10).map((c) => (
                  <div key={c.id} style={{ padding: "7px 10px", background: "#f5f5f5", borderRadius: 6, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                    <span>{c.samples[0] ?? c.normalizedKey}</span>
                    <span style={{ color: "#0066cc", fontWeight: 600 }}>{c.count}×</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function getPreviewUrl(item: any): string | null {
  return item.previewUrl || item.preview_url || item.url || item.downloadUrl || item.download_url || null;
}

function getDownloadUrl(item: any): string | null {
  return item.downloadUrl || item.download_url || item.url || null;
}

function renderFormsGovernanceSummaryStatus(summary: FormGovernanceSummary | null, isLoading: boolean): ReactElement | null {
  if (!summary && isLoading) {
    return <p className="admin-payments-empty">جاري تحميل ملخص الحوكمة…</p>;
  }
  if (!summary) {
    return <p className="admin-payments-empty">ملخص الحوكمة متاح فقط عند الاتصال بالبوابة المحدّثة.</p>;
  }
  return null;
}

function getVisibilityHealthClass(status: string): string {
  if (status === "warning") return "sa-visibility-card--warning";
  if (status === "blocked") return "sa-visibility-card--blocked";
  return "";
}

function getVisibilityHealthLabel(status: string): string {
  const statusLabels: Record<string, string> = { ok: "سليم", warning: "تحذير", blocked: "محجوب" };
  return statusLabels[status] ?? "غير معروف";
}

export default function SuperAdminPage() {
  const { apiBaseUrl, profile } = useApp();
  const { flags, setFlag } = useFeatureFlags();
  const navigate = useNavigate();

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    const prev = {
      htmlH: html.style.height, bodyH: body.style.height,
      htmlOv: html.style.overflow, bodyOv: body.style.overflow,
      rootH: root?.style.height ?? "", rootOv: root?.style.overflow ?? "",
    };
    html.style.height = "auto";
    html.style.overflow = "auto";
    body.style.height = "auto";
    body.style.overflow = "auto";
    if (root) { root.style.height = "auto"; root.style.overflow = "auto"; }
    return () => {
      html.style.height = prev.htmlH;
      html.style.overflow = prev.htmlOv;
      body.style.height = prev.bodyH;
      body.style.overflow = prev.bodyOv;
      if (root) { root.style.height = prev.rootH; root.style.overflow = prev.rootOv; }
    };
  }, []);

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".app-shell--admin");
    if (!shell) return;
    const prevH = shell.style.height;
    const prevOv = shell.style.overflow;
    shell.style.setProperty("height", "auto", "important");
    shell.style.setProperty("overflow", "visible", "important");
    return () => {
      shell.style.height = prevH;
      shell.style.overflow = prevOv;
    };
  }, []);
  const [activeTab, setActiveTab] = useState<SuperAdminTabId>("control-center");
  const [dashboard, setDashboard] = useState<AdminPaymentsDashboard>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [questionTags, setQuestionTags] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [answerValue, setAnswerValue] = useState("");
  const [activateAt, setActivateAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [announcementText, setAnnouncementText] = useState("");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingQuestionText, setEditingQuestionText] = useState("");
  const [editingQuestionTags, setEditingQuestionTags] = useState("");
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [editingAnswerQuestionId, setEditingAnswerQuestionId] = useState("");
  const [editingAnswerValue, setEditingAnswerValue] = useState("");
  const [editingAnswerActivateAt, setEditingAnswerActivateAt] = useState("");
  const [editingAnswerExpiresAt, setEditingAnswerExpiresAt] = useState("");
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [flagsSaving, setFlagsSaving] = useState(false);
  const [flagsError, setFlagsError] = useState<string | null>(null);
  const [flagsNotice, setFlagsNotice] = useState<string | null>(null);
  const [publishedFlagsAt, setPublishedFlagsAt] = useState<string | null>(null);
  const [serverFlags, setServerFlags] = useState<Record<FeatureId, boolean>>(defaultFeatureFlags);
  const [draftFlags, setDraftFlags] = useState<Record<FeatureId, boolean>>(defaultFeatureFlags);
  const [controlNotice, setControlNotice] = useState<string | null>(null);

  const [adminForms, setAdminForms] = useState<FormListItem[]>([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [formsError, setFormsError] = useState("");
  const [formsQuery, setFormsQuery] = useState("");
  const [selectedFormPreview, setSelectedFormPreview] = useState<FormListItem | null>(null);
  const [formsGovernanceSummary, setFormsGovernanceSummary] = useState<FormGovernanceSummary | null>(null);
  const [formsGovernanceLoading, setFormsGovernanceLoading] = useState(false);

  const [adminDocs, setAdminDocs] = useState<OfficialFileItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState("");
  const [docsQuery, setDocsQuery] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError(null);

    try {
      const nextDashboard = await api.getAdminPaymentsDashboard(apiBaseUrl);
      setDashboard(nextDashboard);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر تحميل لوحة الدفعات");
    } finally {
      setLoading(false);
    }
  }

  async function loadFeatureFlags() {
    setFlagsLoading(true);
    setFlagsError(null);

    try {
      const payload = await api.getFeatureFlags(apiBaseUrl);
      const nextFlags = {
        ...defaultFeatureFlags(),
        ...payload.flags,
      } as Record<FeatureId, boolean>;
      setServerFlags(nextFlags);
      setDraftFlags(nextFlags);
      setPublishedFlagsAt(payload.lastUpdatedAt);
    } catch (nextError) {
      setFlagsError(nextError instanceof Error ? nextError.message : "تعذر تحميل إعدادات الميزات");
    } finally {
      setFlagsLoading(false);
    }
  }

  async function loadAdminForms(query = "") {
    setFormsLoading(true);
    setFormsError("");

    try {
      const response = await api.getForms(query ? { q: query } : undefined, apiBaseUrl);
      setAdminForms(response.items || []);
    } catch (nextError) {
      setFormsError(nextError instanceof Error ? nextError.message : "تعذر تحميل النماذج");
      setAdminForms([]);
    } finally {
      setFormsLoading(false);
    }
  }

  async function loadFormsGovernanceSummary() {
    setFormsGovernanceLoading(true);

    try {
      const summary = await api.getFormGovernanceSummary(apiBaseUrl);
      setFormsGovernanceSummary(summary);
    } finally {
      setFormsGovernanceLoading(false);
    }
  }

  function refreshFormsPanel() {
    void loadAdminForms(formsQuery);
    void loadFormsGovernanceSummary();
  }

  async function loadAdminDocs(query = "") {
    setDocsLoading(true);
    setDocsError("");

    try {
      const response = await api.getFiles(query || undefined, apiBaseUrl, { includeArchive: true });
      setAdminDocs(response.items || []);
    } catch (nextError) {
      setDocsError(nextError instanceof Error ? nextError.message : "تعذر تحميل المستندات");
      setAdminDocs([]);
    } finally {
      setDocsLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
    void loadFeatureFlags();
  }, [apiBaseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedQuestionId && dashboard.questions.length > 0) {
      setSelectedQuestionId(dashboard.questions[0].id);
    }
  }, [dashboard.questions, selectedQuestionId]);

  useEffect(() => {
    if (activeTab === "forms") {
      void loadAdminForms(formsQuery);
      void loadFormsGovernanceSummary();
      setSelectedFormPreview(null);
    }
    if (activeTab === "documents") {
      void loadAdminDocs(docsQuery);
    }
  }, [activeTab, apiBaseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === "forms") {
      const timer = globalThis.setTimeout(() => void loadAdminForms(formsQuery), 250);
      return () => globalThis.clearTimeout(timer);
    }
    return undefined;
  }, [formsQuery, activeTab, apiBaseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === "documents") {
      const timer = globalThis.setTimeout(() => void loadAdminDocs(docsQuery), 250);
      return () => globalThis.clearTimeout(timer);
    }
    return undefined;
  }, [docsQuery, activeTab, apiBaseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const answerByQuestionId = useMemo(() => {
    const map = new Map<string, PaymentAnswer>();
    for (const answer of dashboard.activeAnswers) {
      map.set(answer.questionId, answer);
    }
    return map;
  }, [dashboard.activeAnswers]);

  const archivedAnswers = useMemo(() => {
    const activeIds = new Set(dashboard.activeAnswers.map((answer) => answer.id));
    const scheduledIds = new Set(dashboard.scheduledAnswers.map((answer) => answer.id));
    return dashboard.answers.filter((answer) => !activeIds.has(answer.id) && !scheduledIds.has(answer.id));
  }, [dashboard.activeAnswers, dashboard.answers, dashboard.scheduledAnswers]);

  const featureGroups = useMemo(() => {
    return FEATURES.reduce<Record<FeatureCategory, typeof FEATURES>>((groups, feature) => {
      groups[feature.category] = [...(groups[feature.category] || []), feature];
      return groups;
    }, {
      core: [],
      services: [],
      communication: [],
      account: [],
    });
  }, []);

  const hasUnsavedFeatureFlags = useMemo(
    () => FEATURES.some((feature) => draftFlags[feature.id] !== serverFlags[feature.id]),
    [draftFlags, serverFlags],
  );

  async function handleCreateQuestion(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (!questionText.trim()) return;

    setBusy("question");
    setError(null);
    try {
      const created = await api.createAdminPaymentsQuestion({
        text: questionText.trim(),
        tags: formatTags(questionTags),
      }, apiBaseUrl);
      setQuestionText("");
      setQuestionTags("");
      await loadDashboard();
      setSelectedQuestionId(created.id);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر حفظ السؤال");
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateAnswer(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (!selectedQuestionId || !answerValue.trim()) return;

    setBusy("answer");
    setError(null);
    try {
      await api.createAdminPaymentsAnswer({
        questionId: selectedQuestionId,
        value: answerValue.trim(),
        activateAt: toIsoOrNull(activateAt),
        expiresAt: toIsoOrNull(expiresAt),
      }, apiBaseUrl);
      setAnswerValue("");
      setActivateAt("");
      setExpiresAt("");
      await loadDashboard();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر حفظ الإجابة");
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateAnnouncement(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (!announcementText.trim()) return;

    setBusy("announcement");
    setError(null);
    try {
      await api.createAdminPaymentsAnnouncement({ text: announcementText.trim() }, apiBaseUrl);
      setAnnouncementText("");
      await loadDashboard();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر حفظ التنبيه");
    } finally {
      setBusy(null);
    }
  }

  async function handleToggleAnnouncement(announcement: Announcement) {
    setBusy(`announcement:${announcement.id}`);
    setError(null);
    try {
      await api.toggleAdminPaymentsAnnouncement(announcement.id, !announcement.enabled, apiBaseUrl);
      await loadDashboard();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر تحديث التنبيه");
    } finally {
      setBusy(null);
    }
  }

  function beginQuestionEdit(question: PaymentQuestion) {
    setEditingQuestionId(question.id);
    setEditingQuestionText(question.text);
    setEditingQuestionTags(question.tags.join("، "));
  }

  function cancelQuestionEdit() {
    setEditingQuestionId(null);
    setEditingQuestionText("");
    setEditingQuestionTags("");
  }

  async function handleUpdateQuestion(questionId: string) {
    if (!editingQuestionText.trim()) return;

    setBusy(`question:update:${questionId}`);
    setError(null);
    try {
      await api.updateAdminPaymentsQuestion(questionId, {
        text: editingQuestionText.trim(),
        tags: formatTags(editingQuestionTags),
      }, apiBaseUrl);
      cancelQuestionEdit();
      await loadDashboard();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر تحديث السؤال");
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteQuestion(question: PaymentQuestion) {
    if (!globalThis.confirm(`سيتم حذف السؤال وكل الإجابات التابعة له:/n${question.text}`)) return;

    setBusy(`question:delete:${question.id}`);
    setError(null);
    try {
      await api.deleteAdminPaymentsQuestion(question.id, apiBaseUrl);
      if (selectedQuestionId === question.id) {
        setSelectedQuestionId("");
      }
      if (editingQuestionId === question.id) {
        cancelQuestionEdit();
      }
      await loadDashboard();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر حذف السؤال");
    } finally {
      setBusy(null);
    }
  }

  function beginAnswerEdit(answer: PaymentAnswer) {
    setEditingAnswerId(answer.id);
    setEditingAnswerQuestionId(answer.questionId);
    setEditingAnswerValue(answer.value);
    setEditingAnswerActivateAt(toDateTimeLocalValue(answer.activateAt));
    setEditingAnswerExpiresAt(toDateTimeLocalValue(answer.expiresAt));
  }

  function cancelAnswerEdit() {
    setEditingAnswerId(null);
    setEditingAnswerQuestionId("");
    setEditingAnswerValue("");
    setEditingAnswerActivateAt("");
    setEditingAnswerExpiresAt("");
  }

  async function handleUpdateAnswer(answerId: string) {
    if (!editingAnswerQuestionId || !editingAnswerValue.trim()) return;

    setBusy(`answer:update:${answerId}`);
    setError(null);
    try {
      await api.updateAdminPaymentsAnswer(answerId, {
        questionId: editingAnswerQuestionId,
        value: editingAnswerValue.trim(),
        activateAt: toIsoOrNull(editingAnswerActivateAt),
        expiresAt: toIsoOrNull(editingAnswerExpiresAt),
      }, apiBaseUrl);
      cancelAnswerEdit();
      await loadDashboard();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر تحديث الإجابة");
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteAnswer(answer: PaymentAnswer) {
    if (!globalThis.confirm("سيتم حذف هذه الإجابة نهائياً.")) return;

    setBusy(`answer:delete:${answer.id}`);
    setError(null);
    try {
      await api.deleteAdminPaymentsAnswer(answer.id, apiBaseUrl);
      if (editingAnswerId === answer.id) {
        cancelAnswerEdit();
      }
      await loadDashboard();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر حذف الإجابة");
    } finally {
      setBusy(null);
    }
  }

  function handleDraftFlagChange(featureId: FeatureId, enabled: boolean) {
    setDraftFlags((current) => ({
      ...current,
      [featureId]: enabled,
    }));
    setFlagsNotice(null);
  }

  async function handleSaveFeatureFlags() {
    setFlagsSaving(true);
    setFlagsError(null);
    setFlagsNotice(null);

    try {
      const ok = await api.saveFeatureFlags(draftFlags, apiBaseUrl);
      if (!ok) {
        throw new Error("فشل حفظ إعدادات الميزات");
      }

      for (const feature of FEATURES) {
        if (flags[feature.id] !== draftFlags[feature.id]) {
          setFlag(feature.id, draftFlags[feature.id]);
        }
      }

      setServerFlags(draftFlags);
      const now = new Date().toISOString();
      setPublishedFlagsAt(now);
      setFlagsNotice("تم نشر إعدادات الميزات بنجاح.");
    } catch (nextError) {
      setFlagsError(nextError instanceof Error ? nextError.message : "تعذر حفظ إعدادات الميزات");
    } finally {
      setFlagsSaving(false);
    }
  }

  function activateTab(nextTab: SuperAdminTabId) {
    setActiveTab(nextTab);
    globalThis.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleExportProceduresCsv() {
    setBusy("procedures:export");
    setError(null);
    setControlNotice(null);

    try {
      const blob = await api.exportProcedures(apiBaseUrl);
      const fileUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = fileUrl;
      anchor.download = `procedures_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(fileUrl);
      setControlNotice("تم تصدير ملف المعاملات بنجاح.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر تصدير المعاملات");
    } finally {
      setBusy(null);
    }
  }

  function renderControlCenterPanel() {
    return (
      <section className="sa-control-center">
        <div className="sa-control-center__hero">
          <div>
            <h2>مركز إدارة شامل</h2>
            <p>
              من هذه الصفحة يمكنك الدخول السريع إلى كل أدوات الإدارة: إضافة، تعديل، حذف، معاينة، استيراد، وتصدير عبر السوق، الوظائف، النماذج، المستندات، المعاملات، والمستخدمين.
            </p>
          </div>
          <div className="sa-control-center__hero-actions">
            <button className="sa-group__btn" type="button" onClick={() => navigate("/superadmin/users")}>إدارة المستخدمين</button>
            <button className="sa-group__btn" type="button" onClick={() => navigate("/admin/opportunities/imports")}>استيراد فرص</button>
            <button className="sa-group__btn" type="button" onClick={() => void handleExportProceduresCsv()} disabled={busy === "procedures:export"}>
              {busy === "procedures:export" ? "جارٍ التصدير…" : "تصدير المعاملات"}
            </button>
            <button className="sa-group__btn" type="button" onClick={() => navigate("/marketplace")}>معاينة السوق</button>
          </div>
        </div>

        {controlNotice ? <div className="admin-payments-banner admin-payments-banner--success"><span>{controlNotice}</span></div> : null}
        {error ? <div className="admin-payments-banner admin-payments-banner--error"><span>{error}</span></div> : null}

        <div className="sa-control-center__metrics">
          <article className="admin-payments-metric">
            <span className="admin-payments-metric__label">سجلات الدفعات</span>
            <strong>{dashboard.questions.length}</strong>
          </article>
          <article className="admin-payments-metric">
            <span className="admin-payments-metric__label">إجابات نشطة</span>
            <strong>{dashboard.activeAnswers.length}</strong>
          </article>
          <article className="admin-payments-metric">
            <span className="admin-payments-metric__label">ميزات قابلة للإدارة</span>
            <strong>{FEATURES.length}</strong>
          </article>
          <article className="admin-payments-metric">
            <span className="admin-payments-metric__label">حالة الصلاحية</span>
            <strong>{profile.role === "superadmin" ? "Superadmin" : (profile.role || "غير معروف")}</strong>
          </article>
        </div>

        <div className="sa-control-center__grid">
          <article className="sa-control-card">
            <h3>المستخدمون والصلاحيات</h3>
            <p>إدارة الأدوار، تفعيل الحسابات، ومراجعة صلاحيات الوصول لجميع فرق الإدارة.</p>
            <div className="sa-control-card__actions">
              <button className="sa-group__btn" type="button" onClick={() => navigate("/superadmin/users")}>إدارة المستخدمين</button>
              <button className="sa-group__btn sa-group__btn--off" type="button" onClick={() => navigate("/admin/users")}>لوحة المستخدمين</button>
            </div>
          </article>

          <article className="sa-control-card">
            <h3>السوق والوظائف والفرص</h3>
            <p>إدارة محتوى السوق والوظائف والفرص مع مسارات واضحة للاستيراد والتدقيق والمتابعة.</p>
            <div className="sa-control-card__actions">
              <button className="sa-group__btn" type="button" onClick={() => navigate("/admin/opportunities")}>إدارة الفرص</button>
              <button className="sa-group__btn" type="button" onClick={() => navigate("/admin/opportunities/imports")}>استيراد</button>
              <button className="sa-group__btn sa-group__btn--off" type="button" onClick={() => navigate("/market")}>معاينة السوق</button>
              <button className="sa-group__btn sa-group__btn--off" type="button" onClick={() => navigate("/jobs")}>معاينة الوظائف</button>
            </div>
          </article>

          <article className="sa-control-card">
            <h3>معاملات الخدمة</h3>
            <p>إضافة وتعديل وحذف المعاملات، معاينة المخرجات، وتصدير/التحقق من البيانات التشغيلية.</p>
            <div className="sa-control-card__actions">
              <button className="sa-group__btn" type="button" onClick={() => activateTab("procedures")}>فتح إدارة المعاملات</button>
              <button className="sa-group__btn" type="button" onClick={() => void handleExportProceduresCsv()} disabled={busy === "procedures:export"}>تصدير CSV</button>
              <button className="sa-group__btn sa-group__btn--off" type="button" onClick={() => navigate("/procedures")}>معاينة عامة</button>
            </div>
          </article>

          <article className="sa-control-card">
            <h3>النماذج والمستندات</h3>
            <p>مراجعة النماذج الرسمية والمستندات، مع أدوات المعاينة والتنزيل والتحقق من الروابط.</p>
            <div className="sa-control-card__actions">
              <button className="sa-group__btn" type="button" onClick={() => activateTab("forms")}>إدارة النماذج</button>
              <button className="sa-group__btn" type="button" onClick={() => activateTab("documents")}>إدارة المستندات</button>
              <button className="sa-group__btn sa-group__btn--off" type="button" onClick={() => navigate("/forms")}>معاينة واجهة النماذج</button>
            </div>
          </article>

          <article className="sa-control-card">
            <h3>الخدمات الرسمية والمحتوى</h3>
            <p>إدارة البطاقات الرسمية والتعاميم ومتابعة الجودة التشغيلية للخدمات داخل التطبيق.</p>
            <div className="sa-control-card__actions">
              <button className="sa-group__btn" type="button" onClick={() => activateTab("official-services")}>الخدمات الرسمية</button>
              <button className="sa-group__btn" type="button" onClick={() => activateTab("recruitment")}>التعاميم</button>
              <button className="sa-group__btn sa-group__btn--off" type="button" onClick={() => activateTab("visibility")}>صحة الظهور</button>
            </div>
          </article>

          <article className="sa-control-card">
            <h3>الاستطلاعات والتكسي والذكاء</h3>
            <p>إدارة الاستطلاعات ولوحة التكسي الموثوق وتحسين إجابات الذكاء والتحكم في الميزات.</p>
            <div className="sa-control-card__actions">
              <button className="sa-group__btn" type="button" onClick={() => activateTab("voting")}>إدارة الاستطلاعات</button>
              <button className="sa-group__btn" type="button" onClick={() => activateTab("taxi")}>لوحة التكسي</button>
              <button className="sa-group__btn" type="button" onClick={() => activateTab("intelligence")}>ذكاء الأسئلة</button>
              <button className="sa-group__btn sa-group__btn--off" type="button" onClick={() => activateTab("features")}>Feature Flags</button>
            </div>
          </article>
        </div>
      </section>
    );
  }

  function handleResetDraftFlags() {
    setDraftFlags(defaultFeatureFlags());
    setFlagsNotice(null);
    setFlagsError(null);
  }

  function renderFeatureItem(feature: typeof FEATURES[number]) {
    const checked = draftFlags[feature.id] ?? true;

    return (
      <div
        key={feature.id}
        className={`sa-feature ${checked ? "" : "sa-feature--off"} ${feature.canDisable ? "" : "sa-feature--locked"}`.trim()}
      >
        <div className={`sa-feature__icon ${checked ? "" : "sa-feature__icon--off"}`.trim()}>
          <WatanyFluentIcon name={feature.icon as WatanyIconName} aria-hidden />
        </div>
        <div className="sa-feature__info">
          <span className="sa-feature__label">{feature.label}</span>
          <span className="sa-feature__desc">{feature.desc}</span>
        </div>
        <label className="sa-toggle" aria-label={`تبديل ${feature.label}`}>
          <input
            type="checkbox"
            checked={checked}
            disabled={!feature.canDisable || flagsSaving}
            onChange={(event) => handleDraftFlagChange(feature.id, event.target.checked)}
          />
          <span className="sa-toggle__track">
            <span className="sa-toggle__thumb" />
          </span>
        </label>
      </div>
    );
  }

  function renderFeatureGroup(category: FeatureCategory, items: typeof FEATURES) {
    return (
      <section key={category} className="sa-group">
        <div className="sa-group__header">
          <h3 className="sa-group__title">{CATEGORY_LABELS[category]}</h3>
          <span className="sa-group__count">{items.length} عنصر</span>
        </div>
        <div className="sa-feature-list">
          {items.map(renderFeatureItem)}
        </div>
      </section>
    );
  }

  function renderFeatureFlagsPanel() {
    return (
      <section className="sa-section-panel">
        <div className="sa-section-panel__header">
          <div>
            <h2>تفعيل الخدمات والواجهات</h2>
            <p>
              هذه الإعدادات تتحكم في ظهور الخدمات داخل التطبيق نفسه. الحفظ هنا يعيد العناصر القديمة إلى لوحة الإدارة ويحدد ما يظهر للمستخدمين.
            </p>
          </div>
          <div className="sa-section-panel__meta">
            <span>آخر نشر: {formatDateTime(publishedFlagsAt)}</span>
            <button className="sa-group__btn" type="button" onClick={() => void loadFeatureFlags()} disabled={flagsLoading || flagsSaving}>
              تحديث
            </button>
          </div>
        </div>

        {flagsError ? <div className="admin-payments-banner admin-payments-banner--error">
        <SuperAdminCriticalDashboardShell />
        <SuperAdminTaxiDashboardPreviewPanel /><span>{flagsError}</span></div> : null}

        {(Object.entries(featureGroups) as Array<[FeatureCategory, typeof FEATURES]>).map(([category, items]) => renderFeatureGroup(category, items))}

        <div className="sa-footer">
          <button className="sa-save-btn" type="button" onClick={() => void handleSaveFeatureFlags()} disabled={!hasUnsavedFeatureFlags || flagsSaving || flagsLoading}>
            {flagsSaving ? "جارٍ النشر…" : "حفظ ونشر التعديلات"}
          </button>
          <button className="sa-reset-btn" type="button" onClick={handleResetDraftFlags} disabled={flagsSaving || flagsLoading}>
            إعادة للوضع الافتراضي
          </button>
          {flagsNotice ? <span className="sa-save-ok">{flagsNotice}</span> : null}
          {!flagsNotice && hasUnsavedFeatureFlags ? <span className="sa-save-fail">هناك تغييرات غير محفوظة.</span> : null}
        </div>
      </section>
    );
  }

  function renderFormsPanel() {
    const governanceContent = renderFormsGovernanceSummaryBlock();

    return (
      <section className="sa-section-panel">
        <div className="sa-section-panel__header">
          <div>
            <h2>معاينة النماذج</h2>
            <p>عرض حالة الحوكمة والمراجعة على الكتالوغ الرسمي قبل نشره أو توسيعه للمستخدمين.</p>
          </div>
          <div className="sa-section-panel__meta">
            <span>المفعل: {draftFlags.forms ? "نعم" : "لا"}</span>
            <button className="sa-group__btn" type="button" onClick={refreshFormsPanel} disabled={formsLoading || formsGovernanceLoading}>
              تحديث
            </button>
          </div>
        </div>

        {formsError ? <div className="admin-payments-banner admin-payments-banner--error"><span>{formsError}</span></div> : null}

        {governanceContent}
        {renderFormsCatalogSection()}

        {selectedFormPreview ? (
          <FormViewer form={selectedFormPreview} onClose={() => setSelectedFormPreview(null)} />
        ) : null}
      </section>
    );
  }

  function renderFormsGovernanceSummaryBlock() {
    const summaryStatus = renderFormsGovernanceSummaryStatus(formsGovernanceSummary, formsGovernanceLoading);
    if (summaryStatus) return summaryStatus;
    if (!formsGovernanceSummary) return null;

    return (
      <>
        <div className="admin-payments-metrics">
          <div className="admin-payments-metric">
            <strong>{formsGovernanceSummary.totalForms}</strong>
            <span className="admin-payments-metric__label">سجل في كتالوغ النماذج</span>
          </div>
          <div className="admin-payments-metric">
            <strong>{formsGovernanceSummary.reviewStatusCounts.approved || 0}</strong>
            <span className="admin-payments-metric__label">سجلات معتمدة</span>
          </div>
          <div className="admin-payments-metric">
            <strong>{formsGovernanceSummary.reviewStatusCounts.under_review || 0}</strong>
            <span className="admin-payments-metric__label">سجلات قيد المراجعة</span>
          </div>
          <div className="admin-payments-metric">
            <strong>{getGovernanceIssueCount(formsGovernanceSummary)}</strong>
            <span className="admin-payments-metric__label">موانع تشغيلية</span>
          </div>
        </div>

        <div className="watany-approved-home-icons sa-governance-grid">
          <article className="admin-payments-card admin-payments-card--wide">
            <div className="admin-payments-card__header">
              <h2>مصادر الحوكمة</h2>
              <span>تجميع حسب المصدر مع حالة المراجعة وآخر تاريخ مراجعة لكل مجموعة رسمية.</span>
            </div>
            <div className="sa-governance-sources">
              {formsGovernanceSummary.sourceRegistry.map((source) => (
                <div key={source.sourceId} className="sa-governance-source">
                  <div className="admin-payments-list__topline">
                    <strong>{source.sourceNameAr}</strong>
                    <span className={getFormReviewStatusBadgeClass(source.reviewStatus)}>{getFormReviewStatusLabel(source.reviewStatus)}</span>
                  </div>
                  <div className="sa-governance-source__meta">{source.authorityLabel}</div>
                  <div className="sa-governance-source__counts">
                    <span>{source.formCount} نموذج</span>
                    <span>{source.approvedForms} معتمد</span>
                    <span>{source.nonApprovedForms} غير مكتمل</span>
                  </div>
                  <div className="sa-governance-source__meta">آخر مراجعة: {formatDate(source.lastReviewedAt)} · {source.reviewOwner}</div>
                  {source.notes ? <div className="sa-governance-source__meta">{source.notes}</div> : null}
                </div>
              ))}
            </div>
          </article>

          <article className="admin-payments-card">
            <div className="admin-payments-card__header">
              <h2>متابعة المراجعة</h2>
              <span>السجلات غير المعتمدة أو التي تجاوزت نافذة المراجعة.</span>
            </div>
            <div className="admin-payments-list">
              {formsGovernanceSummary.nonApprovedRecords.map((item) => (
                <div key={item.id} className="admin-payments-list__item admin-payments-list__item--stacked">
                  <div className="admin-payments-list__topline">
                    <strong>{item.titleAr}</strong>
                    <span className={getFormReviewStatusBadgeClass(item.reviewStatus)}>{getFormReviewStatusLabel(item.reviewStatus)}</span>
                  </div>
                  <div className="admin-payments-inline-note">{item.sourceId} · {item.notes || "يتطلب استكمال دورة المراجعة قبل الاعتماد."}</div>
                </div>
              ))}
              {formsGovernanceSummary.nonApprovedRecords.length === 0 ? <p className="admin-payments-empty">لا توجد سجلات خارج حالة الاعتماد.</p> : null}
              {formsGovernanceSummary.staleReviews.length > 0 ? (
                <div className="sa-governance-footnote">نافذة المراجعة الحالية: {formsGovernanceSummary.reviewWindowDays} يوماً.</div>
              ) : null}
            </div>
          </article>

          <article className="admin-payments-card">
            <div className="admin-payments-card__header">
              <h2>فحوص التشغيل</h2>
              <span>العناصر التي تمنع اعتماد الكتالوغ أو تحتاج تدخلاً فورياً.</span>
            </div>
            <div className="admin-payments-list">
              <div className="admin-payments-list__item admin-payments-list__item--stacked">
                <div className="admin-payments-list__topline">
                  <strong>تغطية المصادر</strong>
                  <span className={formsGovernanceSummary.missingSourceCoverage.length === 0 ? "admin-payments-badge admin-payments-badge--active" : "admin-payments-badge admin-payments-badge--danger"}>
                    {formsGovernanceSummary.missingSourceCoverage.length === 0 ? "مكتملة" : `${formsGovernanceSummary.missingSourceCoverage.length} ناقص`}
                  </span>
                </div>
                <div className="admin-payments-inline-note">
                  {formsGovernanceSummary.missingSourceCoverage.length === 0 ? "كل المصادر المطلوبة ممثلة داخل الكتالوغ." : formsGovernanceSummary.missingSourceCoverage.join("، ")}
                </div>
              </div>
              <div className="admin-payments-list__item admin-payments-list__item--stacked">
                <div className="admin-payments-list__topline">
                  <strong>الأدلة والمراجع الرسمية</strong>
                  <span className={formsGovernanceSummary.approvedWithoutEvidence.length === 0 ? "admin-payments-badge admin-payments-badge--active" : "admin-payments-badge admin-payments-badge--danger"}>
                    {formsGovernanceSummary.approvedWithoutEvidence.length === 0 ? "سليم" : `${formsGovernanceSummary.approvedWithoutEvidence.length} ناقص`}
                  </span>
                </div>
                <div className="admin-payments-inline-note">
                  {formsGovernanceSummary.approvedWithoutEvidence.length === 0 ? "لا توجد سجلات معتمدة من دون مرجع أو رابط رسمي." : formsGovernanceSummary.approvedWithoutEvidence.map((item) => item.titleAr).join("، ")}
                </div>
              </div>
              <div className="admin-payments-list__item admin-payments-list__item--stacked">
                <div className="admin-payments-list__topline">
                  <strong>روابط المعاينة والتنزيل</strong>
                  <span className={formsGovernanceSummary.brokenActionUrls.length === 0 ? "admin-payments-badge admin-payments-badge--active" : "admin-payments-badge admin-payments-badge--danger"}>
                    {formsGovernanceSummary.brokenActionUrls.length === 0 ? "سليمة" : `${formsGovernanceSummary.brokenActionUrls.length} مكسور`}
                  </span>
                </div>
                <div className="admin-payments-inline-note">
                  {formsGovernanceSummary.brokenActionUrls.length === 0 ? "كل روابط المعاملات صالحة حالياً." : formsGovernanceSummary.brokenActionUrls.map((item) => item.titleAr).join("، ")}
                </div>
              </div>
            </div>
          </article>
        </div>
      </>
    );
  }

  function renderFormsCatalogSection() {
    return (
      <div className="watany-approved-home-icons admin-payments-grid admin-payments-grid--preview">
        <article className="admin-payments-card admin-payments-card--wide">
          <div className="admin-payments-card__header">
            <h2>بحث النماذج</h2>
            <span>ابحث عبر العنوان أو الوصف أو المصدر.</span>
          </div>
          <input
            className="admin-payments-field"
            placeholder="ابحث داخل النماذج..."
            value={formsQuery}
            onChange={(event) => setFormsQuery(event.target.value)}
          />
          <button className="sa-group__btn" type="button" onClick={() => void loadAdminForms(formsQuery)} disabled={formsLoading}>
            تحميل النتائج
          </button>
        </article>

        <article className="admin-payments-card admin-payments-card--wide">
          <div className="admin-payments-card__header">
            <h2>قائمة النماذج</h2>
            <span>العناوين والمصادر والحالة الحالية.</span>
          </div>
          <div className="admin-payments-list">
            {adminForms.map((form) => (
              <div key={form.id} className="admin-payments-list__item admin-payments-list__item--stacked">
                <div className="admin-payments-list__topline">
                  <strong>{form.title_ar}</strong>
                  <div className="admin-payments-list__badges">
                    <span className="admin-payments-badge">{form.sourceName}</span>
                    {form.governance ? (
                      <span className={getFormReviewStatusBadgeClass(form.governance.reviewStatus)}>{getFormReviewStatusLabel(form.governance.reviewStatus)}</span>
                    ) : (
                      <span className="admin-payments-badge admin-payments-badge--muted">{form.origin === "procedure_doc" ? "مستند مرفق" : "بدون حوكمة"}</span>
                    )}
                  </div>
                  <button className="sa-group__btn" type="button" onClick={async () => {
                    const full = await api.getFormById(form.id, apiBaseUrl);
                    setSelectedFormPreview(full ?? form);
                  }}>
                    معاينة
                  </button>
                  <button className="sa-group__btn sa-group__btn--off" type="button" onClick={() => {
                    const url = getPreviewUrl(form);
                    if (url) window.open(url, "_blank");
                  }} disabled={!getPreviewUrl(form)}>
                    فتح العرض
                  </button>
                  <button className="sa-group__btn sa-group__btn--off" type="button" onClick={() => {
                    const url = getDownloadUrl(form);
                    if (url) window.open(url, "_blank");
                  }} disabled={!getDownloadUrl(form)}>
                    تحميل
                  </button>
                </div>
              </div>
            ))}
            {adminForms.length === 0 && !formsLoading ? <p className="admin-payments-empty">لا توجد نتائج للنماذج.</p> : null}
          </div>
        </article>
      </div>
    );
  }

  function renderDocumentsPanel() {
    return (
      <section className="sa-section-panel">
        <div className="sa-section-panel__header">
          <div>
            <h2>معاينة المستندات</h2>
            <p>عرض وتحقق من روابط العرض والتنزيل والاستقرار للمستندات.</p>
          </div>
          <div className="sa-section-panel__meta">
            <span>المفعل: {draftFlags.documents ? "نعم" : "لا"}</span>
            <button className="sa-group__btn" type="button" onClick={() => void loadAdminDocs(docsQuery)} disabled={docsLoading}>
              تحديث
            </button>
          </div>
        </div>

        {docsError ? <div className="admin-payments-banner admin-payments-banner--error"><span>{docsError}</span></div> : null}

        <div className="watany-approved-home-icons admin-payments-grid admin-payments-grid--preview">
          <article className="admin-payments-card admin-payments-card--wide">
            <div className="admin-payments-card__header">
              <h2>بحث المستندات</h2>
              <span>ابحث عبر العنوان أو الفئة أو الجهة.</span>
            </div>
            <input
              className="admin-payments-field"
              placeholder="ابحث داخل المستندات..."
              value={docsQuery}
              onChange={(event) => setDocsQuery(event.target.value)}
            />
            <button className="sa-group__btn" type="button" onClick={() => void loadAdminDocs(docsQuery)} disabled={docsLoading}>
              تحميل النتائج
            </button>
          </article>

          <article className="admin-payments-card admin-payments-card--wide">
            <div className="admin-payments-card__header">
              <h2>قائمة المستندات</h2>
              <span>العناوين، النوع، والمصادر.</span>
            </div>
            <div className="admin-payments-list">
              {adminDocs.map((doc) => (
                <div key={doc.id} className="admin-payments-list__item admin-payments-list__item--stacked">
                  <div className="admin-payments-list__topline">
                    <strong>{doc.title_ar || doc.id}</strong>
                    <span className="admin-payments-badge">{doc.kind || "غير معروف"}</span>
                  </div>
                  <div className="admin-payments-inline-note">
                    {doc.category || "بدون فئة"} · {doc.authority || "بدون جهة"}
                  </div>
                  <div className="watany-approved-home-icons admin-payments-list__actions">
                    <button className="sa-group__btn" type="button" onClick={() => {
                      const url = getPreviewUrl(doc);
                      if (url) window.open(url, "_blank");
                    }} disabled={!getPreviewUrl(doc)}>
                      عرض
                    </button>
                    <button className="sa-group__btn sa-group__btn--off" type="button" onClick={() => {
                      const url = getDownloadUrl(doc);
                      if (url) window.open(url, "_blank");
                    }} disabled={!getDownloadUrl(doc)}>
                      تنزيل
                    </button>
                    <button className="sa-group__btn sa-group__btn--off" type="button" onClick={() => {
                      const share = doc.share_url || getPreviewUrl(doc) || getDownloadUrl(doc);
                      if (share) window.open(share, "_blank");
                    }} disabled={!(doc.share_url || getPreviewUrl(doc) || getDownloadUrl(doc))}>
                      مشاركة
                    </button>
                  </div>
                </div>
              ))}
              {adminDocs.length === 0 && !docsLoading ? <p className="admin-payments-empty">لا توجد نتائج للمستندات.</p> : null}
            </div>
          </article>
        </div>
      </section>
    );
  }

  function renderPaymentsStateBanners() {
    return (
      <>
        {loading && dashboard.questions.length === 0 && !error ? (
          <div className="screen-loader">
            <div className="screen-loader__spinner" />
            <span>جارٍ تحميل لوحة الدفعات…</span>
          </div>
        ) : null}

        {error ? (
          <section className="admin-payments-banner admin-payments-banner--error">
            <Warning24Regular aria-hidden />
            <span>{error}</span>
          </section>
        ) : null}
      </>
    );
  }

  function renderPaymentsMetrics() {
    return (
      <section className="admin-payments-metrics">
        <article className="admin-payments-metric">
          <span className="admin-payments-metric__label">أسئلة مفعّلة</span>
          <strong>{dashboard.questions.length}</strong>
        </article>
        <article className="admin-payments-metric">
          <span className="admin-payments-metric__label">إجابات حالية</span>
          <strong>{dashboard.activeAnswers.length}</strong>
        </article>
        <article className="admin-payments-metric">
          <span className="admin-payments-metric__label">إجابات مجدولة</span>
          <strong>{dashboard.scheduledAnswers.length}</strong>
        </article>
        <article className="admin-payments-metric">
          <span className="admin-payments-metric__label">تنبيهات مفعلة</span>
          <strong>{dashboard.activeAnnouncements.length}</strong>
        </article>
      </section>
    );
  }

  function renderPaymentsCreateSection() {
    return (
      <section className="watany-approved-home-icons admin-payments-grid">
        <form className="admin-payments-card admin-payments-form" onSubmit={handleCreateQuestion}>
          <div className="admin-payments-card__header">
            <h2>سؤال جديد</h2>
            <span>سيصبح قابلاً للـ FAQ والـ chat override بعد إضافة إجابة نشطة له.</span>
          </div>
          <label className="admin-payments-field">
            <span>نص السؤال</span>
            <textarea value={questionText} onChange={(event) => setQuestionText(event.target.value)} rows={3} placeholder="مثال: هل دُفعت المستحقات؟" />
          </label>
          <label className="admin-payments-field">
            <span>وسوم البحث</span>
            <input value={questionTags} onChange={(event) => setQuestionTags(event.target.value)} placeholder="دفعات، مستحقات، فروقات" />
          </label>
          <button className="sa-group__btn" type="submit" disabled={busy === "question" || !questionText.trim()}>
            {busy === "question" ? "جارٍ الحفظ…" : "إضافة السؤال"}
          </button>
        </form>

        <form className="admin-payments-card admin-payments-form" onSubmit={handleCreateAnswer}>
          <div className="admin-payments-card__header">
            <h2>إجابة أو جدولة</h2>
            <span>الإجابة الفورية تستبدل الحالية. إذا حددت وقت تفعيل مستقبلي ستبقى الحالية حتى يحين الموعد.</span>
          </div>
          <label className="admin-payments-field">
            <span>السؤال المستهدف</span>
            <select value={selectedQuestionId} onChange={(event) => setSelectedQuestionId(event.target.value)}>
              <option value="">اختر سؤالاً</option>
              {dashboard.questions.map((question) => (
                <option key={question.id} value={question.id}>{questionLabel(question)}</option>
              ))}
            </select>
          </label>
          <label className="admin-payments-field">
            <span>نص الإجابة</span>
            <textarea data-aided-input-prose-editor="payment-answer" value={answerValue} onChange={(event) => setAnswerValue(event.target.value)} rows={4} placeholder="مثال: لم يتم صرف الدفعة بعد، وسيتم التحديث فور صدور القرار." />
          </label>
          <div className="admin-payments-form__row">
            <label className="admin-payments-field">
              <span>يبدأ عند</span>
              <CalendarInput label="تاريخ التفعيل" value={activateAt} includeTime onChange={setActivateAt} />
            </label>
            <label className="admin-payments-field">
              <span>ينتهي عند</span>
              <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
            </label>
          </div>
          <button className="sa-group__btn" type="submit" disabled={busy === "answer" || !selectedQuestionId || !answerValue.trim()}>
            {busy === "answer" ? "جارٍ الحفظ…" : "حفظ الإجابة"}
          </button>
        </form>

        <form className="admin-payments-card admin-payments-form" onSubmit={handleCreateAnnouncement}>
          <div className="admin-payments-card__header">
            <h2>تنبيه إداري</h2>
            <span>يُلحق بالتجاوز المباشر في المحادثة عندما يكون التنبيه مفعّلاً.</span>
          </div>
          <label className="admin-payments-field">
            <span>النص</span>
            <textarea value={announcementText} onChange={(event) => setAnnouncementText(event.target.value)} rows={4} placeholder="مثال: سيتم نشر التحديث الرسمي هذا الأسبوع." />
          </label>
          <button className="sa-group__btn" type="submit" disabled={busy === "announcement" || !announcementText.trim()}>
            {busy === "announcement" ? "جارٍ الحفظ…" : "إضافة التنبيه"}
          </button>
        </form>
      </section>
    );
  }

  function renderPaymentsListsSection() {
    return (
      <section className="watany-approved-home-icons admin-payments-grid admin-payments-grid--lists">
        <article className="admin-payments-card">
          <div className="admin-payments-card__header">
            <h2>الأسئلة الحالية</h2>
            <span>أساس الربط مع FAQ والمحادثة.</span>
          </div>
          <div className="admin-payments-list">
            {dashboard.questions.map((question) => (
              <div key={question.id} className="admin-payments-list__item">
                <div>
                  <strong>{question.text}</strong>
                  <div className="admin-payments-tags">
                    {question.tags.length > 0 ? question.tags.map((tag) => <span key={tag} className="admin-payments-tag">{tag}</span>) : <span className="admin-payments-tag admin-payments-tag--muted">بدون وسوم</span>}
                  </div>
                  {editingQuestionId === question.id ? (
                    <div className="admin-payments-editor admin-payments-editor--compact">
                      <label className="admin-payments-field">
                        <span>نص السؤال</span>
                        <textarea value={editingQuestionText} onChange={(event) => setEditingQuestionText(event.target.value)} rows={2} />
                      </label>
                      <label className="admin-payments-field">
                        <span>الوسوم</span>
                        <input value={editingQuestionTags} onChange={(event) => setEditingQuestionTags(event.target.value)} />
                      </label>
                      <div className="watany-approved-home-icons admin-payments-editor__actions">
                        <button className="sa-group__btn" type="button" onClick={() => void handleUpdateQuestion(question.id)} disabled={busy === `question:update:${question.id}`}>
                          {busy === `question:update:${question.id}` ? "جارٍ الحفظ…" : "حفظ التعديل"}
                        </button>
                        <button className="sa-group__btn sa-group__btn--off" type="button" onClick={cancelQuestionEdit} disabled={!!busy}>
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="watany-approved-home-icons admin-payments-list__actions admin-payments-list__actions--stacked">
                  <div className="admin-payments-inline-note">
                    {answerByQuestionId.has(question.id) ? "له إجابة نشطة" : "بانتظار إجابة"}
                  </div>
                  <button className="sa-group__btn" type="button" onClick={() => beginQuestionEdit(question)} disabled={!!busy}>
                    تعديل
                  </button>
                  <button className="sa-group__btn sa-group__btn--off" type="button" onClick={() => void handleDeleteQuestion(question)} disabled={!!busy}>
                    حذف
                  </button>
                </div>
              </div>
            ))}
            {dashboard.questions.length === 0 ? <p className="admin-payments-empty">لا توجد أسئلة بعد.</p> : null}
          </div>
        </article>

        <article className="admin-payments-card">
          <div className="admin-payments-card__header">
            <h2>الإجابات النشطة</h2>
            <span>المستخدمة فوراً في FAQ وchat.</span>
          </div>
          <div className="admin-payments-list">
            {dashboard.activeAnswers.map((answer) => renderAnswerCard(answer))}
            {dashboard.activeAnswers.length === 0 ? <p className="admin-payments-empty">لا توجد إجابات نشطة.</p> : null}
          </div>
        </article>

        <article className="admin-payments-card">
          <div className="admin-payments-card__header">
            <h2>الإجابات المجدولة</h2>
            <span>ستحلّ تلقائياً عند وصول وقت التفعيل.</span>
          </div>
          <div className="admin-payments-list">
            {dashboard.scheduledAnswers.map((answer) => renderAnswerCard(answer))}
            {dashboard.scheduledAnswers.length === 0 ? <p className="admin-payments-empty">لا توجد إجابات مجدولة.</p> : null}
          </div>
        </article>

        <article className="admin-payments-card">
          <div className="admin-payments-card__header">
            <h2>التنبيهات</h2>
            <span>يظهر التنبيه المفعّل مع الرد الإداري المباشر.</span>
          </div>
          <div className="admin-payments-list">
            {dashboard.announcements.map((announcement) => (
              <div key={announcement.id} className="admin-payments-list__item admin-payments-list__item--stacked">
                <div className="admin-payments-list__topline">
                  <strong>{announcement.text}</strong>
                  <span className={`admin-payments-badge admin-payments-badge--${announcement.enabled ? "active" : "muted"}`}>
                    {announcement.enabled ? "مفعّل" : "متوقف"}
                  </span>
                </div>
                <div className="watany-approved-home-icons admin-payments-list__actions">
                  <span className="admin-payments-inline-note">أُنشئ: {formatDateTime(announcement.createdAt)}</span>
                  <button
                    className={`sa-group__btn ${announcement.enabled ? "sa-group__btn--off" : ""}`.trim()}
                    onClick={() => void handleToggleAnnouncement(announcement)}
                    disabled={busy === `announcement:${announcement.id}`}
                  >
                    {announcement.enabled ? "إيقاف" : "تفعيل"}
                  </button>
                </div>
              </div>
            ))}
            {dashboard.announcements.length === 0 ? <p className="admin-payments-empty">لا توجد تنبيهات محفوظة.</p> : null}
          </div>
        </article>

        <article className="admin-payments-card admin-payments-card--wide">
          <div className="admin-payments-card__header">
            <h2>السجل الكامل</h2>
            <span>يعرض كل الإصدارات السابقة والمجدولة لنفس السؤال.</span>
          </div>
          <div className="admin-payments-list">
            {archivedAnswers.map((answer) => renderAnswerCard(answer))}
            {archivedAnswers.length === 0 ? <p className="admin-payments-empty">لا توجد نسخ مؤرشفة بعد.</p> : null}
          </div>
        </article>
      </section>
    );
  }

  function renderPaymentsPanel() {
    return (
      <div className="sa-section-stack">
        {renderPaymentsStateBanners()}
        {renderPaymentsMetrics()}
        {renderPaymentsCreateSection()}
        {renderPaymentsListsSection()}
      </div>
    );
  }

  function renderVisibilityPanel() {
    const enabledCount = FEATURE_AUDIT.filter((item) =>
      item.featureId == null ? true : draftFlags[item.featureId]
    ).length;
    const disabledCount = FEATURE_AUDIT.length - enabledCount;
    const warningCount = FEATURE_AUDIT.filter((item) => item.status !== "ok").length;

    function handlePreview(item: (typeof FEATURE_AUDIT)[number]) {
      if (item.previewAction === "route" && item.previewPayload) {
        navigate(item.previewPayload);
      } else if (item.previewAction === "event" && item.previewPayload) {
        globalThis.dispatchEvent(new CustomEvent(item.previewPayload, { detail: {} }));
      }
    }

    return (
      <section className="sa-section-panel">
        <div className="sa-section-panel__header">
          <div>
            <h2>مرئية الخدمات وصحتها</h2>
            <p>مراجعة حالة تفعيل كل خدمة، أين تظهر في التطبيق، والتحذيرات المعروفة.</p>
          </div>
          <div className="sa-section-panel__meta">
            <span>{FEATURE_AUDIT.length} خدمة مراجعة</span>
          </div>
        </div>

        <div className="admin-payments-metrics">
          <article className="admin-payments-metric">
            <span className="admin-payments-metric__label">مفعّلة</span>
            <strong>{enabledCount}</strong>
          </article>
          <article className="admin-payments-metric">
            <span className="admin-payments-metric__label">معطّلة</span>
            <strong>{disabledCount}</strong>
          </article>
          <article className="admin-payments-metric">
            <span className="admin-payments-metric__label">تحذيرات</span>
            <strong>{warningCount}</strong>
          </article>
          <article className="admin-payments-metric">
            <span className="admin-payments-metric__label">إجمالي</span>
            <strong>{FEATURE_AUDIT.length}</strong>
          </article>
        </div>

        <div className="watany-approved-home-icons sa-visibility-grid">
          {FEATURE_AUDIT.map((item) => renderVisibilityCard(item, draftFlags, handlePreview))}
        </div>
      </section>
    );
  }

  function renderVisibilityCard(
    item: (typeof FEATURE_AUDIT)[number],
    currentDraftFlags: Record<FeatureId, boolean>,
    onPreview: (item: (typeof FEATURE_AUDIT)[number]) => void,
  ) {
    const isEnabled = item.featureId == null ? true : currentDraftFlags[item.featureId];
    const healthClass = getVisibilityHealthClass(item.status);
    const healthLabel = getVisibilityHealthLabel(item.status);

    return (
      <div
        key={item.id}
        className={`sa-visibility-card ${healthClass} ${isEnabled ? "" : "sa-visibility-card--off"}`.trim()}
      >
        <div className="sa-visibility-card__header">
          <span className="sa-visibility-card__title">{item.title}</span>
          <span className={`sa-visibility-badge sa-visibility-badge--${isEnabled ? "enabled" : "disabled"}`}>
            {isEnabled ? "مفعّل" : "معطّل"}
          </span>
          <span className={`sa-visibility-badge sa-visibility-badge--${item.status}`}>
            {healthLabel}
          </span>
        </div>

        {item.route ? (
          <span className="sa-visibility-route">
            <Link24Regular aria-hidden="true" /> {item.route}
          </span>
        ) : (
          <span className="sa-visibility-route">
            <Megaphone24Regular aria-hidden="true" /> حدث: {item.previewPayload}
          </span>
        )}

        <span className="sa-visibility-route">
          {item.featureId ? `id: ${item.featureId}` : "دائم التفعيل"}
        </span>

        <div className="sa-visibility-surfaces">
          {item.visibleSurfaces.length > 0
            ? item.visibleSurfaces.map((surface) => (
                <span key={surface} className="sa-visibility-surface">{SURFACE_LABELS[surface]}</span>
              ))
            : <span className="sa-visibility-surface sa-visibility-surface--none">غير مرئية في القوائم</span>
          }
          {item.routeGated ? (
            <span className="sa-visibility-surface sa-visibility-surface--gated">محجوب بـ gate</span>
          ) : null}
        </div>

        {item.warnings.length > 0 ? (
          <div className="sa-visibility-warnings">
            {item.warnings.map((warningText, warningIndex) => (
              <div key={`${warningIndex}-${warningText}`} className="sa-visibility-warning">
                <Warning24Regular aria-hidden="true" />
                <span>{warningText}</span>
              </div>
            ))}
          </div>
        ) : null}

        {item.notes ? (
          <span className="sa-visibility-note">{item.notes}</span>
        ) : null}

        <div className="watany-approved-home-icons sa-visibility-actions">
          {item.previewAction === "coming_soon" ? (
            <button className="sa-group__btn sa-group__btn--off" type="button" disabled>
              قريباً
            </button>
          ) : (
            <button
              className="sa-group__btn"
              type="button"
              onClick={() => onPreview(item)}
            >
              {item.previewAction === "event" ? (
                <><Megaphone24Regular aria-hidden="true" /> تشغيل</>
              ) : (
                <><Open24Regular aria-hidden="true" /> معاينة</>
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderAnswerCard(answer: PaymentAnswer) {
    const question = dashboard.questions.find((item) => item.id === answer.questionId);
    const status = answerStatus(answer);
    const isEditing = editingAnswerId === answer.id;

    return (
      <div key={answer.id} className="admin-payments-list__item admin-payments-list__item--stacked">
        <div className="admin-payments-list__topline">
          <strong>{question ? question.text : answer.questionId}</strong>
          <span className={`admin-payments-badge admin-payments-badge--${status.tone}`}>{status.label}</span>
        </div>
        <p>{answer.value}</p>
        <div className="admin-payments-inline-note">
          أُنشئت: {formatDateTime(answer.createdAt)}
          {answer.activateAt ? ` | تبدأ: ${formatDateTime(answer.activateAt)}` : ""}
          {answer.expiresAt ? ` | تنتهي: ${formatDateTime(answer.expiresAt)}` : ""}
        </div>
        <div className="watany-approved-home-icons admin-payments-list__actions">
          <button className="sa-group__btn" type="button" onClick={() => beginAnswerEdit(answer)} disabled={!!busy}>
            تعديل
          </button>
          <button className="sa-group__btn sa-group__btn--off" type="button" onClick={() => void handleDeleteAnswer(answer)} disabled={!!busy}>
            حذف
          </button>
        </div>
        {isEditing ? (
          <div className="admin-payments-editor">
            <label className="admin-payments-field">
              <span>السؤال</span>
              <select value={editingAnswerQuestionId} onChange={(event) => setEditingAnswerQuestionId(event.target.value)}>
                <option value="">اختر سؤالاً</option>
                {dashboard.questions.map((entry) => (
                  <option key={entry.id} value={entry.id}>{questionLabel(entry)}</option>
                ))}
              </select>
            </label>
            <label className="admin-payments-field">
              <span>الإجابة</span>
              <textarea value={editingAnswerValue} onChange={(event) => setEditingAnswerValue(event.target.value)} rows={3} />
            </label>
            <div className="admin-payments-form__row">
              <label className="admin-payments-field">
                <span>يبدأ عند</span>
                <CalendarInput label="تاريخ التفعيل" value={editingAnswerActivateAt} includeTime onChange={setEditingAnswerActivateAt} />
              </label>
              <label className="admin-payments-field">
                <span>ينتهي عند</span>
                <CalendarInput label="تاريخ الانتهاء" value={editingAnswerExpiresAt} includeTime onChange={setEditingAnswerExpiresAt} />
              </label>
            </div>
            <div className="watany-approved-home-icons admin-payments-editor__actions">
              <button className="sa-group__btn" type="button" onClick={() => void handleUpdateAnswer(answer.id)} disabled={busy === `answer:update:${answer.id}`}>
                {busy === `answer:update:${answer.id}` ? "جارٍ الحفظ…" : "حفظ التعديل"}
              </button>
              <button className="sa-group__btn sa-group__btn--off" type="button" onClick={cancelAnswerEdit} disabled={!!busy}>
                إلغاء
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="sa-page admin-payments-page"
      data-route-owner="superadmin"
      data-route-content
      data-page-content
      data-watany-feature="superadmin"
    >
      <header className="sa-topbar">
        <div className="sa-topbar__inner">
          <div className="sa-topbar__brand">
            <span className="sa-topbar__shield" aria-hidden>
              <ShieldCheckmark24Regular />
            </span>
            <div>
              <h1 className="sa-topbar__title">لوحة الإدارة العليا</h1>
              <p className="sa-topbar__role">
                <span className="sa-topbar__role-badge">{profile.role === "superadmin" ? "Superadmin" : (profile.role || "غير معروف")}</span>
                <span className="sa-topbar__role-sep">·</span>
                <span className="sa-topbar__api">{apiBaseUrl.replace(/https?:\/\//, "")}</span>
              </p>
            </div>
          </div>
          <div className="sa-topbar__stats">
            <span className="sa-topbar__stat"><strong>{dashboard.questions.length}</strong><span>سجلات</span></span>
            <span className="sa-topbar__stat"><strong>{dashboard.activeAnswers.length}</strong><span>إجابات</span></span>
            <span className="sa-topbar__stat"><strong>{FEATURES.length}</strong><span>ميزة</span></span>
            <span className="sa-topbar__stat"><strong>{dashboard.activeAnnouncements.length}</strong><span>تنبيهات</span></span>
          </div>
          <div className="sa-topbar__actions">
            <button
              className="sa-topbar__refresh-btn"
              type="button"
              onClick={() => { void loadDashboard(); void loadFeatureFlags(); }}
              disabled={loading || flagsLoading || !!busy || flagsSaving}
            >
              {loading || flagsLoading ? "جارٍ التحميل…" : "↺ تحديث الكل"}
            </button>
            <button className="sa-topbar__back-btn" type="button" onClick={() => navigate("/")}>← الرئيسية</button>
          </div>
        </div>
      </header>

      <div className="sa-body">
        <div className="sa-tabs" role="tablist" aria-label="أقسام لوحة الإدارة">
          {SUPER_ADMIN_TABS.map((tab) => (
            <button
              key={tab.id}
              data-feature-key={tab.id}
              type="button"
              className={`sa-tab ${activeTab === tab.id ? "active" : ""}`.trim()}
              onClick={() => setActiveTab(tab.id)}
            >
              {(() => { const TabIcon = tab.icon; return <TabIcon aria-hidden />; })()}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="sa-panel-area">
          {activeTab === "control-center" ? renderControlCenterPanel() : null}
          {activeTab === "payments" ? renderPaymentsPanel() : null}
          {activeTab === "recruitment" ? <RecruitmentAdminPanel /> : null}
          {activeTab === "procedures" ? <div className="sa-procedures-container"><ProceduresAdminDashboard /></div> : null}
          {activeTab === "forms" ? renderFormsPanel() : null}
          {activeTab === "documents" ? renderDocumentsPanel() : null}
          {activeTab === "official-services" ? <OfficialServicesAdminPanel apiBaseUrl={apiBaseUrl} /> : null}
          {activeTab === "taxi" ? <TaxiMobilityAdminPanel apiBaseUrl={apiBaseUrl} /> : null}
          {activeTab === "voting" ? <SurveyAdminPanel apiBaseUrl={apiBaseUrl} /> : null}
          {activeTab === "features" ? renderFeatureFlagsPanel() : null}
          {activeTab === "visibility" ? renderVisibilityPanel() : null}
          {activeTab === "intelligence" ? <QuestionIntelligencePanel apiBaseUrl={apiBaseUrl} /> : null}
        </div>
      </div>
    </div>
  );
}
// PAYMENT_OVERRIDE_LIVE_PIPELINE_WIRING_V1
// Live chat/payment pipeline must consult super-admin payment overrides before answering variable payment-status questions.
// Fixed legal facts remain grounded in KB/source material; variable status answers are admin-controlled.


