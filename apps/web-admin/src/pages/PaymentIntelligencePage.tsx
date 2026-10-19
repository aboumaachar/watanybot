import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminNotice,
  AdminPageHeader,
  AdminPageSection,
  AdminStatCard,
  AdminStatusBadge,
} from "../components/admin/AdminPrimitives";
import { adminFetch, getAdminErrorMessage } from "../lib/api";

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

type PaymentsDashboard = {
  questions: PaymentQuestion[];
  activeAnswers: PaymentAnswer[];
  scheduledAnswers: PaymentAnswer[];
  answers: PaymentAnswer[];
  announcements: Announcement[];
  activeAnnouncements: Announcement[];
};

const EMPTY_DASHBOARD: PaymentsDashboard = {
  questions: [],
  activeAnswers: [],
  scheduledAnswers: [],
  answers: [],
  announcements: [],
  activeAnnouncements: [],
};

function tagsFromText(value: string): string[] {
  return value.split(/[،,]/u).map((tag) => tag.trim()).filter(Boolean);
}

function toIso(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const offset = parsed.getTimezoneOffset() * 60_000;
  return new Date(parsed.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString("ar-LB", { dateStyle: "short", timeStyle: "short" });
}

function answerState(answer: PaymentAnswer): string {
  const now = Date.now();
  const starts = answer.activateAt ? Date.parse(answer.activateAt) : null;
  const ends = answer.expiresAt ? Date.parse(answer.expiresAt) : null;
  if (!answer.isActive) return "archived";
  if (starts && starts > now) return "pending";
  if (ends && ends <= now) return "disabled";
  return "active";
}

export default function PaymentIntelligencePage() {
  const [dashboard, setDashboard] = useState<PaymentsDashboard>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [questionTags, setQuestionTags] = useState("");
  const [answerId, setAnswerId] = useState<string | null>(null);
  const [answerQuestionId, setAnswerQuestionId] = useState("");
  const [answerValue, setAnswerValue] = useState("");
  const [activateAt, setActivateAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [announcementText, setAnnouncementText] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminFetch("/api/admin/payments/dashboard");
      const data = await response.json() as { dashboard?: PaymentsDashboard };
      setDashboard(data.dashboard ?? EMPTY_DASHBOARD);
    } catch (reason) {
      setError(getAdminErrorMessage(reason, "تعذر تحميل ذكاء الدفعات."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  useEffect(() => {
    if (!answerQuestionId && dashboard.questions.length > 0) {
      setAnswerQuestionId(dashboard.questions[0].id);
    }
  }, [answerQuestionId, dashboard.questions]);

  const questionById = useMemo(
    () => new Map(dashboard.questions.map((question) => [question.id, question])),
    [dashboard.questions],
  );

  function clearQuestionForm() {
    setQuestionId(null);
    setQuestionText("");
    setQuestionTags("");
  }

  function clearAnswerForm() {
    setAnswerId(null);
    setAnswerValue("");
    setActivateAt("");
    setExpiresAt("");
  }

  async function refreshAfter(message: string) {
    setNotice(message);
    await loadDashboard();
  }

  async function submitQuestion(event: React.FormEvent) {
    event.preventDefault();
    if (!questionText.trim()) return;
    setBusy("question"); setError(""); setNotice("");
    try {
      await adminFetch(
        questionId ? `/api/admin/payments/questions/${encodeURIComponent(questionId)}` : "/api/admin/payments/questions",
        {
          method: questionId ? "PATCH" : "POST",
          body: JSON.stringify({ text: questionText.trim(), tags: tagsFromText(questionTags) }),
        },
      );
      const message = questionId ? "تم تحديث سؤال الدفعات." : "تم إنشاء سؤال الدفعات.";
      clearQuestionForm();
      await refreshAfter(message);
    } catch (reason) {
      setError(getAdminErrorMessage(reason, "تعذر حفظ سؤال الدفعات."));
    } finally { setBusy(""); }
  }

  function editQuestion(question: PaymentQuestion) {
    setQuestionId(question.id);
    setQuestionText(question.text);
    setQuestionTags(question.tags.join("، "));
  }

  async function removeQuestion(question: PaymentQuestion) {
    if (!globalThis.confirm(`حذف السؤال وكل إجاباته؟\n${question.text}`)) return;
    setBusy(`question-delete:${question.id}`); setError(""); setNotice("");
    try {
      await adminFetch(`/api/admin/payments/questions/${encodeURIComponent(question.id)}`, { method: "DELETE" });
      if (questionId === question.id) clearQuestionForm();
      if (answerQuestionId === question.id) setAnswerQuestionId("");
      await refreshAfter("تم حذف سؤال الدفعات وإجاباته.");
    } catch (reason) {
      setError(getAdminErrorMessage(reason, "تعذر حذف سؤال الدفعات."));
    } finally { setBusy(""); }
  }

  async function submitAnswer(event: React.FormEvent) {
    event.preventDefault();
    if (!answerQuestionId || !answerValue.trim()) return;
    setBusy("answer"); setError(""); setNotice("");
    try {
      await adminFetch(
        answerId ? `/api/admin/payments/answers/${encodeURIComponent(answerId)}` : "/api/admin/payments/answers",
        {
          method: answerId ? "PATCH" : "POST",
          body: JSON.stringify({ questionId: answerQuestionId, value: answerValue.trim(), activateAt: toIso(activateAt), expiresAt: toIso(expiresAt) }),
        },
      );
      const message = answerId ? "تم تحديث إجابة الدفعات." : "تم إنشاء إجابة الدفعات.";
      clearAnswerForm();
      await refreshAfter(message);
    } catch (reason) {
      setError(getAdminErrorMessage(reason, "تعذر حفظ إجابة الدفعات."));
    } finally { setBusy(""); }
  }

  function editAnswer(answer: PaymentAnswer) {
    setAnswerId(answer.id);
    setAnswerQuestionId(answer.questionId);
    setAnswerValue(answer.value);
    setActivateAt(toLocalInput(answer.activateAt));
    setExpiresAt(toLocalInput(answer.expiresAt));
  }

  async function removeAnswer(answer: PaymentAnswer) {
    if (!globalThis.confirm("حذف إجابة الدفعات نهائياً؟")) return;
    setBusy(`answer-delete:${answer.id}`); setError(""); setNotice("");
    try {
      await adminFetch(`/api/admin/payments/answers/${encodeURIComponent(answer.id)}`, { method: "DELETE" });
      if (answerId === answer.id) clearAnswerForm();
      await refreshAfter("تم حذف إجابة الدفعات.");
    } catch (reason) {
      setError(getAdminErrorMessage(reason, "تعذر حذف إجابة الدفعات."));
    } finally { setBusy(""); }
  }

  async function submitAnnouncement(event: React.FormEvent) {
    event.preventDefault();
    if (!announcementText.trim()) return;
    setBusy("announcement"); setError(""); setNotice("");
    try {
      await adminFetch("/api/admin/payments/announcements", {
        method: "POST",
        body: JSON.stringify({ text: announcementText.trim() }),
      });
      setAnnouncementText("");
      await refreshAfter("تم إنشاء تنبيه الدفعات.");
    } catch (reason) {
      setError(getAdminErrorMessage(reason, "تعذر إنشاء تنبيه الدفعات."));
    } finally { setBusy(""); }
  }

  async function toggleAnnouncement(announcement: Announcement) {
    setBusy(`announcement:${announcement.id}`); setError(""); setNotice("");
    try {
      await adminFetch(`/api/admin/payments/announcements/${encodeURIComponent(announcement.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !announcement.enabled }),
      });
      await refreshAfter("تم تحديث حالة تنبيه الدفعات.");
    } catch (reason) {
      setError(getAdminErrorMessage(reason, "تعذر تحديث تنبيه الدفعات."));
    } finally { setBusy(""); }
  }

  return <div className="payment-intelligence-page" dir="rtl">
    <AdminPageHeader
      eyebrow="العمليات المالية"
      title="ذكاء الدفعات"
      description="إدارة الإجابات المتغيرة لحالة الدفعات والمستحقات. تبقى الحقائق القانونية الثابتة ضمن مصادر قاعدة المعرفة المعتمدة."
      actions={<button type="button" className="ghost" onClick={() => void loadDashboard()} disabled={loading || Boolean(busy)}>تحديث</button>}
    />

    {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
    {notice ? <AdminNotice tone="success">{notice}</AdminNotice> : null}

    <div className="admin-stat-grid payment-intelligence-stats">
      <AdminStatCard label="الأسئلة" value={loading ? "…" : dashboard.questions.length} detail="موضوعات الحالة المتغيرة" />
      <AdminStatCard label="إجابات نشطة" value={loading ? "…" : dashboard.activeAnswers.length} detail="المستخدمة حالياً في المحادثة" />
      <AdminStatCard label="إجابات مجدولة" value={loading ? "…" : dashboard.scheduledAnswers.length} detail="ستدخل حيز التنفيذ لاحقاً" />
      <AdminStatCard label="تنبيهات مفعلة" value={loading ? "…" : dashboard.activeAnnouncements.length} detail="تُلحق بالإجابة عند المطابقة" />
    </div>

    <AdminPageSection title="الأسئلة" description="حدّد الأسئلة التي يجب أن تقبل إجابة تشغيلية متغيرة بدلاً من تثبيتها كحقيقة قانونية.">
      <form className="payment-intelligence-form" onSubmit={submitQuestion}>
        <label><span>السؤال</span><input value={questionText} onChange={(event) => setQuestionText(event.target.value)} required placeholder="مثال: متى تُدفع المساعدة المدرسية؟" /></label>
        <label><span>وسوم المطابقة</span><input value={questionTags} onChange={(event) => setQuestionTags(event.target.value)} placeholder="دفعة، مساعدة مدرسية، موعد" /></label>
        <div className="payment-intelligence-form-actions">
          <button className="accent" type="submit" disabled={busy === "question"}>{questionId ? "حفظ التعديل" : "إضافة سؤال"}</button>
          {questionId ? <button className="ghost" type="button" onClick={clearQuestionForm}>إلغاء التعديل</button> : null}
        </div>
      </form>

      <div className="payment-intelligence-list">
        {dashboard.questions.length === 0 ? <p className="muted">لا توجد أسئلة تشغيلية مسجلة بعد.</p> : dashboard.questions.map((question) => (
          <article key={question.id} className="payment-intelligence-row">
            <div><strong>{question.text}</strong><small>{question.tags.length ? question.tags.join(" · ") : "بدون وسوم"}</small></div>
            <div className="payment-intelligence-row-actions">
              <button type="button" className="ghost" onClick={() => editQuestion(question)}>تعديل</button>
              <button type="button" className="admin-danger-button" disabled={busy === `question-delete:${question.id}`} onClick={() => void removeQuestion(question)}>حذف</button>
            </div>
          </article>
        ))}
      </div>
    </AdminPageSection>

    <AdminPageSection title="الإجابات التشغيلية" description="الإجابة الفعالة هنا تتقدم على الإجابة المتغيرة العادية في المحادثة، مع دعم بدء وانتهاء تلقائيين.">
      <form className="payment-intelligence-form payment-intelligence-answer-form" onSubmit={submitAnswer}>
        <label><span>السؤال</span><select value={answerQuestionId} onChange={(event) => setAnswerQuestionId(event.target.value)} required><option value="">اختر سؤالاً</option>{dashboard.questions.map((question) => <option key={question.id} value={question.id}>{question.text}</option>)}</select></label>
        <label className="payment-intelligence-wide"><span>الإجابة</span><textarea rows={3} value={answerValue} onChange={(event) => setAnswerValue(event.target.value)} required placeholder="اكتب آخر حالة تشغيلية مؤكدة..." /></label>
        <label><span>تفعيل في</span><input type="datetime-local" value={activateAt} onChange={(event) => setActivateAt(event.target.value)} /></label>
        <label><span>انتهاء في</span><input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>
        <div className="payment-intelligence-form-actions payment-intelligence-wide">
          <button className="accent" type="submit" disabled={busy === "answer" || dashboard.questions.length === 0}>{answerId ? "حفظ التعديل" : "نشر الإجابة"}</button>
          {answerId ? <button className="ghost" type="button" onClick={clearAnswerForm}>إلغاء التعديل</button> : null}
        </div>
      </form>

      <div className="payment-intelligence-list">
        {dashboard.answers.length === 0 ? <p className="muted">لا توجد إجابات تشغيلية مسجلة بعد.</p> : dashboard.answers.map((answer) => {
          const question = questionById.get(answer.questionId);
          const state = answerState(answer);
          return <article key={answer.id} className="payment-intelligence-row payment-intelligence-answer-row">
            <div>
              <span className="payment-intelligence-row-heading"><strong>{question?.text ?? "سؤال غير متاح"}</strong><AdminStatusBadge status={state} /></span>
              <p>{answer.value}</p>
              <small>تفعيل: {formatDate(answer.activateAt)} · انتهاء: {formatDate(answer.expiresAt)} · بواسطة {answer.createdBy}</small>
            </div>
            <div className="payment-intelligence-row-actions">
              <button type="button" className="ghost" onClick={() => editAnswer(answer)}>تعديل</button>
              <button type="button" className="admin-danger-button" disabled={busy === `answer-delete:${answer.id}`} onClick={() => void removeAnswer(answer)}>حذف</button>
            </div>
          </article>;
        })}
      </div>
    </AdminPageSection>

    <AdminPageSection title="التنبيهات" description="رسائل تشغيلية قصيرة يمكن إرفاقها بإجابات الدفعات المطابقة.">
      <form className="payment-intelligence-form" onSubmit={submitAnnouncement}>
        <label className="payment-intelligence-wide"><span>نص التنبيه</span><input value={announcementText} onChange={(event) => setAnnouncementText(event.target.value)} required placeholder="مثال: يرجى مراجعة الإعلان الرسمي المحدث قبل المراجعة." /></label>
        <div className="payment-intelligence-form-actions"><button className="accent" type="submit" disabled={busy === "announcement"}>إضافة تنبيه</button></div>
      </form>

      <div className="payment-intelligence-list">
        {dashboard.announcements.length === 0 ? <p className="muted">لا توجد تنبيهات مسجلة.</p> : dashboard.announcements.map((announcement) => (
          <article key={announcement.id} className="payment-intelligence-row">
            <div><span className="payment-intelligence-row-heading"><strong>{announcement.text}</strong><AdminStatusBadge status={announcement.enabled ? "enabled" : "disabled"} /></span><small>{formatDate(announcement.createdAt)}</small></div>
            <div className="payment-intelligence-row-actions">
              <button type="button" className="ghost" disabled={busy === `announcement:${announcement.id}`} onClick={() => void toggleAnnouncement(announcement)}>{announcement.enabled ? "تعطيل" : "تفعيل"}</button>
            </div>
          </article>
        ))}
      </div>
    </AdminPageSection>
  </div>;
}
