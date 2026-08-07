import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight24Regular, DataBarVertical24Regular, People24Regular } from "../theme/watany-v4/legacyIconBridge";
import { UtilityActionIcon } from "../components/UtilityActionIcon";
import InlineInfoButton from "../components/InlineInfoButton";
import UtilityHeaderTitleRow from "../components/UtilityHeaderTitleRow";
import { api, type SurveyDetail, type SurveyStatus } from "../lib/api";
import { useApp } from "../store/app";

const STATUS_LABELS: Record<SurveyStatus, string> = {
  draft: "مسودة",
  active: "نشطة",
  closed: "مقفلة",
};

function formatSurveyWindow(startDate?: string | null, endDate?: string | null): string {
  const formatter = new Intl.DateTimeFormat("ar-LB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const start = startDate ? formatter.format(new Date(startDate)) : "لم يحدد بعد";
  const end = endDate ? formatter.format(new Date(endDate)) : "غير محدد";
  return `${start} - ${end}`;
}

export default function SurveyDetailPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const { apiBaseUrl } = useApp();
  const [detail, setDetail] = useState<SurveyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [voteError, setVoteError] = useState("");
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSurvey() {
      if (!surveyId) {
        setError("تعذر تحديد الاستطلاع المطلوب.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setVoteError("");

      try {
        const next = await api.getSurvey(surveyId, apiBaseUrl);
        if (!active) return;
        setDetail(next);
        if (!next.canVote) {
          setSelectedOptionId("");
        }
      } catch (reason) {
        if (!active) return;
        setDetail(null);
        setError(reason instanceof Error ? reason.message : "تعذر تحميل تفاصيل الاستطلاع.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSurvey();
    return () => {
      active = false;
    };
  }, [apiBaseUrl, surveyId]);

  async function handleCastVote() {
    if (!detail?.election.id) {
      setVoteError("تعذر تحديد الاستطلاع الحالي.");
      return;
    }

    if (!selectedOptionId) {
      setVoteError("اختر خيارا أولا قبل تثبيت الصوت.");
      return;
    }

    setSubmitting(true);
    setVoteError("");

    try {
      await api.submitSurveyVote(detail.election.id, selectedOptionId, apiBaseUrl);
      navigate(`/voting/${encodeURIComponent(detail.election.id)}/results`);
    } catch (reason) {
      setVoteError(reason instanceof Error ? reason.message : "تعذر تسجيل الصوت حاليا.");
      setSubmitting(false);
    }
  }

  return (
    <div className="panel utility-page watany-utility-page">
      <div className="utility-header watany-utility-page__header">
        <UtilityHeaderTitleRow
          titleClassName="utility-title"
          title="تفاصيل الاستطلاع"
          infoText="اطلع على خيارات الاستطلاع ومعلوماته الأساسية داخل موطني."
          infoLabel="حول صفحة تفاصيل الاستطلاع"
        />
      </div>

      <div className="watany-approved-home-icons utility-action-grid utility-action-grid--compact">
        <button className="utility-action-card watany-utility-action-card" onClick={() => navigate("/voting")} style={{ "--utility-color": "#475569" } as React.CSSProperties}>
          <UtilityActionIcon icon={<ArrowRight24Regular aria-hidden />} />
          <span className="utility-action-card__label">كل الاستطلاعات</span>
          <span className="utility-action-card__desc">العودة إلى القائمة المدمجة داخل موطني.</span>
        </button>
        <button
          className="utility-action-card watany-utility-action-card"
          disabled={!detail?.election.id}
          onClick={() => detail?.election.id && navigate(`/voting/${encodeURIComponent(detail.election.id)}/results`)}
          style={{ "--utility-color": "#0f766e" } as React.CSSProperties}
        >
          <UtilityActionIcon icon={<DataBarVertical24Regular aria-hidden />} />
          <span className="utility-action-card__label">النتائج</span>
          <span className="utility-action-card__desc">عرض نتائج الاستطلاع الحالي داخل موطني.</span>
        </button>
        <div className="utility-action-card utility-action-card--static watany-utility-action-card" style={{ "--utility-color": "#7c3aed" } as React.CSSProperties}>
          <UtilityActionIcon icon={<People24Regular aria-hidden />} />
          <span className="utility-action-card__label">عدد الخيارات</span>
          <span className="utility-action-card__desc">{loading ? "جارٍ العد" : (detail?.options.length || 0) + " خيار/خيارات"}</span>
        </div>
      </div>

      {error ? <div className="panel-error">{error}</div> : null}
      {loading ? <div className="muted">جارٍ تحميل تفاصيل الاستطلاع...</div> : null}

      {!loading && detail ? (
        <>
          {detail.canVote ? (
            <div className="card utility-list-card utility-list-card--compact watany-utility-list-card">
              <div className="utility-list-card__title-row">
                <div className="utility-list-card__title-copy">
                  <div className="card-title">التصويت داخل موطني</div>
                </div>
                <div className="watany-approved-home-icons utility-list-card__title-actions">
                  <InlineInfoButton text="اختر خيارا واحدا من القائمة أدناه ثم ثبّت صوتك. بعد التثبيت سينقلك موطني مباشرة إلى النتائج." label="شرح آلية التصويت" />
                </div>
              </div>
              {voteError ? <div className="panel-error" style={{ marginTop: 12 }}>{voteError}</div> : null}
              <div className="row gap-sm" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                <button className="watany-ui-inline-action" disabled={!selectedOptionId || submitting} onClick={() => void handleCastVote()}>
                  {submitting ? "جارٍ تثبيت الصوت..." : "تثبيت الصوت"}
                </button>
                <button className="watany-ui-inline-action" onClick={() => navigate(`/voting/${encodeURIComponent(detail.election.id)}/results`)}>
                  عرض النتائج أولا
                </button>
              </div>
            </div>
          ) : null}

          {!detail.canVote && detail.hasVoted ? (
            <div className="panel-hint">تم تسجيل صوتك لهذا الاستطلاع داخل وطني، ولا يمكن تغييره الآن.</div>
          ) : null}

          {!detail.canVote && !detail.hasVoted ? (
            <div className="panel-hint">التصويت غير متاح حاليا لهذا الاستطلاع. يمكنك متابعة الخيارات أو عرض النتائج الحالية.</div>
          ) : null}

          <div className="results watany-utility-page__results">
            <div className="card utility-list-card utility-list-card--compact watany-utility-list-card">
              <div className="utility-list-card__title-row">
                <div className="utility-list-card__title-copy">
                  <div className="card-title">{detail.election.title}</div>
                  <div className="card-sub">{STATUS_LABELS[detail.election.status]} ⬢ {formatSurveyWindow(detail.election.startDate, detail.election.endDate)}</div>
                </div>
                {detail.election.description ? (
                  <div className="watany-approved-home-icons utility-list-card__title-actions">
                    <InlineInfoButton text={detail.election.description} label={`عرض وصف ${detail.election.title}`} />
                  </div>
                ) : null}
              </div>
              <div className="utility-list-card__footer">
                <span className={`pill watany-ui-pill ${detail.election.status === "active" ? "verified" : "pending"}`}>{STATUS_LABELS[detail.election.status]}</span>
                <span className={`pill watany-ui-pill ${detail.canVote ? "verified" : "pending"}`}>{detail.canVote ? "التصويت متاح الآن" : (detail.hasVoted ? "صوت مسجل" : "التصويت غير متاح")}</span>
              </div>
            </div>

            {detail.options.map((option, index) => (
              <div
                key={option.id}
                className="card utility-list-card utility-list-card--compact watany-utility-list-card"
                style={selectedOptionId === option.id ? { outline: "2px solid var(--accent, #0f766e)", outlineOffset: 2 } : undefined}
              >
                <div className="utility-list-card__title-row">
                  <div className="utility-list-card__title-copy">
                    <div className="card-title">{`${index + 1}. ${option.name}`}</div>
                  </div>
                  {option.description || option.imageUrl ? (
                    <div className="watany-approved-home-icons utility-list-card__title-actions">
                      <InlineInfoButton
                        text={[
                          option.description || "لا يوجد وصف إضافي لهذا الخيار.",
                          option.imageUrl ? "صورة هذا الخيار متاحة في المصدر الحالي." : "",
                        ].filter(Boolean).join(" ")}
                        label={`عرض تفاصيل الخيار ${option.name}`}
                      />
                    </div>
                  ) : null}
                </div>
                {option.imageUrl ? <div className="card-sub">صورة هذا الخيار متاحة في المصدر الحالي.</div> : null}
                {detail.canVote ? (
                  <div className="row gap-sm" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    <button className="watany-ui-inline-action" onClick={() => setSelectedOptionId(option.id)}>
                      {selectedOptionId === option.id ? "تم اختيار هذا الخيار" : "اختيار هذا الخيار"}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}

            {detail.options.length === 0 ? <div className="muted">لا توجد خيارات ظاهرة لهذا الاستطلاع حاليا.</div> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}


