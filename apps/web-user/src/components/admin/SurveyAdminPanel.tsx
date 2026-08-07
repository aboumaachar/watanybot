import { useEffect, useMemo, useState } from "react";
import { CheckmarkCircle24Regular, Warning24Regular } from "../../theme/watany-v4/legacyIconBridge";
import {
  api,
  type CreateSurveyRequest,
  type SurveyDetail,
  type SurveyStatus,
} from "../../lib/api";

type SurveyAdminPanelProps = {
  apiBaseUrl: string;
};

type OptionDraft = {
  name: string;
  description: string;
};

type ElectionDraft = {
  title: string;
  description: string;
  status: SurveyStatus;
  optionName: string;
  optionDescription: string;
};

const EMPTY_OPTION_DRAFT: OptionDraft = {
  name: "",
  description: "",
};

function buildElectionDrafts(items: SurveyDetail[]): Record<string, ElectionDraft> {
  return Object.fromEntries(items.map((item) => [
    item.election.id,
    {
      title: item.election.title,
      description: item.election.description || "",
      status: item.election.status,
      optionName: "",
      optionDescription: "",
    },
  ]));
}

function formatElectionStatus(status: SurveyStatus): string {
  switch (status) {
    case "active":
      return "نشطة";
    case "closed":
      return "مقفلة";
    case "draft":
    default:
      return "مسودة";
  }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "غير محدد";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "غير محدد";
  return new Intl.DateTimeFormat("ar-LB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatElectionWindow(startDate: string | null | undefined, endDate: string | null | undefined): string {
  if (!startDate && !endDate) {
    return "مفتوحة حاليا";
  }

  if (startDate && endDate) {
    return `${formatDateTime(startDate)} - ${formatDateTime(endDate)}`;
  }

  if (startDate) {
    return `تبدأ ${formatDateTime(startDate)}`;
  }

  return `تنتهي ${formatDateTime(endDate)}`;
}

export default function SurveyAdminPanel({ apiBaseUrl }: Readonly<SurveyAdminPanelProps>) {
  const [elections, setElections] = useState<SurveyDetail[]>([]);
  const [electionDrafts, setElectionDrafts] = useState<Record<string, ElectionDraft>>({});
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createStatus, setCreateStatus] = useState<SurveyStatus>("draft");
  const [createOptions, setCreateOptions] = useState<OptionDraft[]>([{ ...EMPTY_OPTION_DRAFT }]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const stats = useMemo(() => {
    const totalOptions = elections.reduce((sum, item) => sum + item.options.length, 0);
    return {
      total: elections.length,
      draft: elections.filter((item) => item.election.status === "draft").length,
      active: elections.filter((item) => item.election.status === "active").length,
      closed: elections.filter((item) => item.election.status === "closed").length,
      options: totalOptions,
    };
  }, [elections]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timer = globalThis.setTimeout(() => setNotice(null), 3200);
    return () => globalThis.clearTimeout(timer);
  }, [notice]);

  async function loadElections() {
    setLoading(true);
    setError(null);

    try {
      const items = await api.listSurveyAdminItems(apiBaseUrl);
      setElections(items);
      setElectionDrafts(buildElectionDrafts(items));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر تحميل إدارة الاستطلاعات");
      setElections([]);
      setElectionDrafts({});
    } finally {
      setLoading(false);
    }
  }

  // loadElections intentionally omitted from deps
  useEffect(() => {
    void loadElections();
  }, [apiBaseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateCreateOption(index: number, field: keyof OptionDraft, value: string) {
    setCreateOptions((current) => current.map((option, optionIndex) => (
      optionIndex === index ? { ...option, [field]: value } : option
    )));
  }

  function addCreateOptionRow() {
    setCreateOptions((current) => [...current, { ...EMPTY_OPTION_DRAFT }]);
  }

  function removeCreateOptionRow(index: number) {
    setCreateOptions((current) => {
      if (current.length === 1) {
        return current;
      }
      return current.filter((_, optionIndex) => optionIndex !== index);
    });
  }

  function updateElectionDraft(electionId: string, patch: Partial<ElectionDraft>) {
    setElectionDrafts((current) => ({
      ...current,
      [electionId]: {
        ...(current[electionId] || {
          title: "",
          description: "",
          status: "draft",
          optionName: "",
          optionDescription: "",
        }),
        ...patch,
      },
    }));
  }

  async function handleCreateElection(event: { preventDefault: () => void }) {
    event.preventDefault();
    setBusyKey("create-election");
    setError(null);

    const payload: CreateSurveyRequest = {
      title: createTitle.trim(),
      description: createDescription.trim() || undefined,
      status: createStatus,
      options: createOptions
        .map((option) => ({
          name: option.name.trim(),
          description: option.description.trim() || undefined,
        }))
        .filter((option) => option.name.length > 0),
    };

    if (!payload.title || payload.options.length === 0) {
      setBusyKey(null);
      setError("أدخل عنوان الاستطلاع وخيارا واحدا على الأقل.");
      return;
    }

    try {
      await api.createSurvey(payload, apiBaseUrl);
      setCreateTitle("");
      setCreateDescription("");
      setCreateStatus("draft");
      setCreateOptions([{ ...EMPTY_OPTION_DRAFT }]);
      setNotice("تم إنشاء الاستطلاع داخل النظام بنجاح.");
      await loadElections();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر إنشاء الاستطلاع");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSaveElection(electionId: string) {
    const draft = electionDrafts[electionId];
    if (!draft) {
      return;
    }

    setBusyKey(`update:${electionId}`);
    setError(null);

    try {
      await api.updateSurvey(electionId, {
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
        status: draft.status,
      }, apiBaseUrl);
      setNotice("تم حفظ بيانات الاستطلاع.");
      await loadElections();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر تحديث الاستطلاع");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleAddOption(electionId: string) {
    const draft = electionDrafts[electionId];
    if (!draft?.optionName.trim()) {
      setError("أدخل اسم الخيار قبل إضافته.");
      return;
    }

    setBusyKey(`option:${electionId}`);
    setError(null);

    try {
      await api.addSurveyOption(electionId, {
        name: draft.optionName.trim(),
        description: draft.optionDescription.trim() || undefined,
      }, apiBaseUrl);
      setNotice("تمت إضافة الخيار إلى الاستطلاع.");
      await loadElections();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر إضافة الخيار");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteElection(electionId: string) {
    const currentElection = elections.find((item) => item.election.id === electionId);
    if (!currentElection) {
      return;
    }

    if (!globalThis.confirm(`هل تريد حذف الاستطلاع "${currentElection.election.title}" نهائيا؟`)) {
      return;
    }

    setBusyKey(`delete-election:${electionId}`);
    setError(null);

    try {
      await api.deleteSurvey(electionId, apiBaseUrl);
      setNotice("تم حذف الاستطلاع.");
      await loadElections();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر حذف الاستطلاع");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteOption(electionId: string, optionId: string, optionName: string) {
    if (!globalThis.confirm(`هل تريد حذف الخيار "${optionName}" من هذا الاستطلاع؟`)) {
      return;
    }

    setBusyKey(`delete-option:${optionId}`);
    setError(null);

    try {
      await api.deleteSurveyOption(electionId, optionId, apiBaseUrl);
      setNotice("تم حذف الخيار من الاستطلاع.");
      await loadElections();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر حذف الخيار");
    } finally {
      setBusyKey(null);
    }
  }

  async function handlePublishWorldCupPolls(force: boolean) {
    setBusyKey(force ? "worldcup-publish-force" : "worldcup-publish");
    setError(null);

    try {
      const result = await api.publishWorldCupPolls(force, apiBaseUrl);
      if (!result.published && result.reason === "already_published") {
        setNotice("تم نشر تصويتات كأس العالم مسبقاً. استخدم إعادة النشر الإجباري لإرسالها مرة جديدة.");
        return;
      }

      setNotice(
        result.notificationPosted
          ? `تم إطلاق تصويتات كأس العالم ونشرها في ${result.groupsPosted} مجموعات مع إشعار للمشاركة.`
          : `تم إطلاق تصويتات كأس العالم ونشرها في ${result.groupsPosted} مجموعات.`,
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر إطلاق تصويتات كأس العالم");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="sa-section-stack">
      <section className="sa-section-panel__header">
        <div>
          <h2>إدارة الاستطلاعات</h2>
          <p>
            هذه الواجهة تدير الاستطلاعات والخيارات مباشرة من مخزن النظام الداخلي دون الحاجة إلى تطبيق خارجي.
          </p>
        </div>
        <div className="sa-section-panel__meta">
          <span>الاستطلاعات: {stats.total}</span>
          <span>الخيارات: {stats.options}</span>
          <span>النشطة: {stats.active}</span>
          <span>المسودات: {stats.draft}</span>
          <span>المقفلة: {stats.closed}</span>
        </div>
      </section>

      {error ? (
        <div className="admin-payments-banner admin-payments-banner--error">
          <Warning24Regular aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      {notice ? (
        <div className="admin-payments-banner admin-payments-banner--success">
          <CheckmarkCircle24Regular aria-hidden />
          <span>{notice}</span>
        </div>
      ) : null}

      <section className="watany-approved-home-icons admin-payments-grid">
        <article className="admin-payments-card">
          <div className="admin-payments-card__header">
            <h2>تصويتات كأس العالم</h2>
            <span>
              أطلق التصويتات الرسمية (بطل البطولة، أفضل لاعب، وكل مباراة) من لوحة السوبر أدمن مع إرسالها للمجموعات والإشعارات.
            </span>
          </div>

          <div className="watany-approved-home-icons voting-admin-actions">
            <button
              type="button"
              className="sa-group__btn wt-cta-glow wt-cta-processing"
              onClick={() => void handlePublishWorldCupPolls(false)}
              disabled={busyKey === "worldcup-publish" || busyKey === "worldcup-publish-force"}
            >
              {busyKey === "worldcup-publish" ? "جارٍ الإطلاق..." : "إطلاق تصويتات كأس العالم"}
            </button>
            <button
              type="button"
              className="sa-group__btn sa-group__btn--off wt-cta-glow wt-cta-processing"
              onClick={() => void handlePublishWorldCupPolls(true)}
              disabled={busyKey === "worldcup-publish" || busyKey === "worldcup-publish-force"}
            >
              {busyKey === "worldcup-publish-force" ? "جارٍ إعادة النشر..." : "إعادة النشر للمجموعات"}
            </button>
          </div>
        </article>

        <form className="admin-payments-card admin-payments-form" onSubmit={handleCreateElection}>
          <div className="admin-payments-card__header">
            <h2>إنشاء استطلاع جديد</h2>
            <span>أنشئ الاستطلاع وخياراته داخل النظام ثم فعله عندما يصبح جاهزا للتصويت.</span>
          </div>

          <label className="admin-payments-field">
            <span>عنوان الاستطلاع</span>
            <input value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} placeholder="مثال: استطلاع المجلس المحلي" />
          </label>

          <label className="admin-payments-field">
            <span>وصف مختصر</span>
            <textarea rows={3} value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} placeholder="نطاق الاستطلاع أو الجهة المستفيدة" />
          </label>

          <label className="admin-payments-field">
            <span>الحالة</span>
            <select value={createStatus} onChange={(event) => setCreateStatus(event.target.value as SurveyStatus)}>
              <option value="draft">مسودة</option>
              <option value="active">نشطة</option>
              <option value="closed">مقفلة</option>
            </select>
          </label>

          <div className="voting-admin-candidate-editor">
            {createOptions.map((option, index) => (
              <div className="voting-admin-candidate-draft" key={`create-candidate-${index + 1}`}>
                <div className="voting-admin-candidate-draft__header">
                  <strong>خيار {index + 1}</strong>
                  <button
                    type="button"
                    className="sa-group__btn sa-group__btn--off wt-cta-glow"
                    onClick={() => removeCreateOptionRow(index)}
                    disabled={createOptions.length === 1 || busyKey === "create-election"}
                  >
                    حذف
                  </button>
                </div>

                <label className="admin-payments-field">
                  <span>اسم الخيار</span>
                  <input
                    value={option.name}
                    onChange={(event) => updateCreateOption(index, "name", event.target.value)}
                    placeholder="اسم الخيار"
                  />
                </label>

                <label className="admin-payments-field">
                  <span>وصف الخيار</span>
                  <textarea
                    rows={2}
                    value={option.description}
                    onChange={(event) => updateCreateOption(index, "description", event.target.value)}
                    placeholder="نبذة موجزة أو تعريف مختصر"
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="watany-approved-home-icons voting-admin-actions">
            <button type="button" className="sa-group__btn sa-group__btn--off wt-cta-glow" onClick={addCreateOptionRow} disabled={busyKey === "create-election"}>
              إضافة خيار آخر
            </button>
            <button type="submit" className="sa-group__btn wt-cta-glow wt-cta-processing" disabled={busyKey === "create-election"} aria-busy={busyKey === "create-election"}>
              {busyKey === "create-election" ? "جارٍ الإنشاء..." : "إنشاء الاستطلاع"}
            </button>
          </div>
        </form>

        <section className="admin-payments-card admin-payments-card--wide">
          <div className="admin-payments-card__header">
            <h2>الاستطلاعات الحالية</h2>
            <span>تحديث العنوان والحالة، إضافة خيارات جديدة، أو حذف السجل من نفس اللوحة.</span>
          </div>

          {loading ? <p className="voting-admin-empty">جارٍ تحميل الاستطلاعات...</p> : null}

          {!loading && elections.length === 0 ? (
            <p className="voting-admin-empty">لا توجد استطلاعات داخلية بعد. أنشئ أول استطلاع من النموذج أعلاه.</p>
          ) : null}

          {!loading && elections.length > 0 ? (
            <div className="voting-admin-list">
              {elections.map((item) => {
                const draft = electionDrafts[item.election.id] || {
                  title: item.election.title,
                  description: item.election.description || "",
                  status: item.election.status,
                  optionName: "",
                  optionDescription: "",
                };

                return (
                  <article className="voting-admin-item" key={item.election.id}>
                    <div className="voting-admin-item__header">
                      <div>
                        <h3>{item.election.title}</h3>
                        <p>{item.election.description || "لا يوجد وصف لهذا السجل حاليا."}</p>
                      </div>
                      <span className={`voting-admin-status voting-admin-status--${item.election.status}`}>
                        {formatElectionStatus(item.election.status)}
                      </span>
                    </div>

                    <div className="voting-admin-item__meta">
                      <span>المعرف: {item.election.id}</span>
                      <span>الخيارات: {item.options.length}</span>
                      <span>حالة التصويت: {item.election.hasVoted ? "صوت المستخدم الحالي" : "لم يصوت المستخدم الحالي"}</span>
                      <span>نافذة الاستطلاع: {formatElectionWindow(item.election.startDate, item.election.endDate)}</span>
                    </div>

                    <div className="watany-approved-home-icons voting-admin-item__grid">
                      <label className="admin-payments-field">
                        <span>عنوان الاستطلاع</span>
                        <input
                          value={draft.title}
                          onChange={(event) => updateElectionDraft(item.election.id, { title: event.target.value })}
                          disabled={!item.canEdit || busyKey === `update:${item.election.id}`}
                        />
                      </label>

                      <label className="admin-payments-field">
                        <span>الحالة</span>
                        <select
                          value={draft.status}
                          onChange={(event) => updateElectionDraft(item.election.id, { status: event.target.value as SurveyStatus })}
                          disabled={!item.canEdit || busyKey === `update:${item.election.id}`}
                        >
                          <option value="draft">مسودة</option>
                          <option value="active">نشطة</option>
                          <option value="closed">مقفلة</option>
                        </select>
                      </label>

                      <div className="watany-approved-home-icons voting-admin-actions">
                        <button
                          type="button"
                          className="sa-group__btn"
                          onClick={() => void handleSaveElection(item.election.id)}
                          disabled={!item.canEdit || busyKey === `update:${item.election.id}`}
                        >
                          {busyKey === `update:${item.election.id}` ? "جارٍ الحفظ..." : "حفظ التعديلات"}
                        </button>
                        <button
                          type="button"
                          className="sa-group__btn sa-group__btn--danger"
                          onClick={() => void handleDeleteElection(item.election.id)}
                          disabled={!item.canEdit || busyKey === `delete-election:${item.election.id}`}
                        >
                          {busyKey === `delete-election:${item.election.id}` ? "جارٍ الحذف..." : "حذف الاستطلاع"}
                        </button>
                      </div>

                      <label className="watany-approved-home-icons admin-payments-field voting-admin-item__grid-wide">
                        <span>الوصف</span>
                        <textarea
                          rows={3}
                          value={draft.description}
                          onChange={(event) => updateElectionDraft(item.election.id, { description: event.target.value })}
                          disabled={!item.canEdit || busyKey === `update:${item.election.id}`}
                        />
                      </label>

                      <label className="admin-payments-field">
                        <span>اسم الخيار الجديد</span>
                        <input
                          value={draft.optionName}
                          onChange={(event) => updateElectionDraft(item.election.id, { optionName: event.target.value })}
                          disabled={!item.canEdit || busyKey === `option:${item.election.id}` || item.election.status === "closed"}
                          placeholder="أدخل اسم الخيار"
                        />
                      </label>

                      <label className="admin-payments-field">
                        <span>وصف الخيار الجديد</span>
                        <input
                          value={draft.optionDescription}
                          onChange={(event) => updateElectionDraft(item.election.id, { optionDescription: event.target.value })}
                          disabled={!item.canEdit || busyKey === `option:${item.election.id}` || item.election.status === "closed"}
                          placeholder="اختياري"
                        />
                      </label>

                      <div className="watany-approved-home-icons voting-admin-actions">
                        <button
                          type="button"
                          className="sa-group__btn sa-group__btn--off"
                          onClick={() => void handleAddOption(item.election.id)}
                          disabled={!item.canEdit || busyKey === `option:${item.election.id}` || item.election.status === "closed"}
                        >
                          {busyKey === `option:${item.election.id}` ? "جارٍ الإضافة..." : "إضافة الخيار"}
                        </button>
                      </div>
                    </div>

                    <div className="voting-admin-candidates">
                      {item.options.map((option) => (
                        <div className="voting-admin-candidate" key={option.id}>
                          <div className="voting-admin-candidate__header">
                            <strong>{option.name}</strong>
                            <button
                              type="button"
                              className="sa-group__btn sa-group__btn--danger"
                              onClick={() => void handleDeleteOption(item.election.id, option.id, option.name)}
                              disabled={!item.canEdit || item.options.length <= 1 || busyKey === `delete-option:${option.id}`}
                            >
                              {busyKey === `delete-option:${option.id}` ? "جارٍ الحذف..." : "حذف الخيار"}
                            </button>
                          </div>
                          <p>{option.description || "لا توجد نبذة إضافية لهذا الخيار."}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      </section>
    </section>
  );
}


