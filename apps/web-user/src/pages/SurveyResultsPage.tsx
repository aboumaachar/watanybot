import { WatanyFeatureTemplate } from "../components/template";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight24Regular, TextBulletList24Regular, Trophy24Regular } from "../theme/watany-v4/legacyIconBridge";
import { UtilityActionIcon } from "../components/UtilityActionIcon";
import InlineInfoButton from "../components/InlineInfoButton";
import UtilityHeaderTitleRow from "../components/UtilityHeaderTitleRow";
import { api, type SurveyDetail, type SurveyResults, type SurveyStatus } from "../lib/api";
import { useApp } from "../store/app";

const STATUS_LABELS: Record<SurveyStatus, string> = {
  draft: "مسودة",
  active: "نشطة",
  closed: "مقفلة",
};

function formatPercent(value: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function SurveyResultsPageTemplateContent() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const { apiBaseUrl } = useApp();
  const [detail, setDetail] = useState<SurveyDetail | null>(null);
  const [results, setResults] = useState<SurveyResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadResults() {
      if (!surveyId) {
        setError("تعذر تحديد الاستطلاع المطلوب.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const [nextDetail, nextResults] = await Promise.all([
          api.getSurvey(surveyId, apiBaseUrl),
          api.getSurveyResults(surveyId, apiBaseUrl),
        ]);

        if (!active) return;
        setDetail(nextDetail);
        setResults(nextResults);
      } catch (reason) {
        if (!active) return;
        setDetail(null);
        setResults(null);
        setError(reason instanceof Error ? reason.message : "تعذر تحميل نتائج الاستطلاع.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadResults();
    return () => {
      active = false;
    };
  }, [apiBaseUrl, surveyId]);

  const leader = results?.items[0] || null;
  const maxVotes = Math.max(...(results?.items.map((item) => item.voteCount) || [0]), 0);

  return (
    <div className="panel utility-page watany-utility-page">
      <div className="utility-header watany-utility-page__header">
        <UtilityHeaderTitleRow
          titleClassName="utility-title"
          title="نتائج الاستطلاع"
          infoText="نتائج مدمجة داخل موطني مع احتساب الأصوات داخلياً."
          infoLabel="حول صفحة نتائج الاستطلاع"
        />
      </div>

      <div className="watany-approved-home-icons utility-action-grid utility-action-grid--compact">
        <button className="utility-action-card watany-utility-action-card" onClick={() => navigate("/voting")} style={{ "--utility-color": "#475569" } as React.CSSProperties}>
          <UtilityActionIcon icon={<ArrowRight24Regular aria-hidden />} />
          <span className="utility-action-card__label">كل الاستطلاعات</span>
          <span className="utility-action-card__desc">العودة إلى صفحة الاستطلاعات الرئيسية.</span>
        </button>
        <button
          className="utility-action-card watany-utility-action-card"
          disabled={!detail?.election.id}
          onClick={() => detail?.election.id && navigate(`/voting/${encodeURIComponent(detail.election.id)}`)}
          style={{ "--utility-color": "#0f766e" } as React.CSSProperties}
        >
          <UtilityActionIcon icon={<TextBulletList24Regular aria-hidden />} />
          <span className="utility-action-card__label">التفاصيل</span>
          <span className="utility-action-card__desc">عرض الخيارات ومعلومات الاستطلاع الأساسية.</span>
        </button>
        <div className="utility-action-card utility-action-card--static watany-utility-action-card" style={{ "--utility-color": "#7c3aed" } as React.CSSProperties}>
          <UtilityActionIcon icon={<Trophy24Regular aria-hidden />} />
          <span className="utility-action-card__label">الخيار الأول</span>
          <span className="utility-action-card__desc">{loading ? "جارٍ الاحتساب" : (leader?.optionName || "لا يوجد خيار متصدر بعد")}</span>
        </div>
      </div>

      {error ? <div className="panel-error">{error}</div> : null}
      {loading ? <div className="muted">جارٍ تحميل نتائج الاستطلاع...</div> : null}

      {!loading && detail && results ? (
        <div className="results watany-utility-page__results">
          <div className="card utility-list-card utility-list-card--compact watany-utility-list-card">
            <div className="utility-list-card__title-row">
              <div className="utility-list-card__title-copy">
                <div className="card-title">{detail.election.title}</div>
                <div className="card-sub">{STATUS_LABELS[detail.election.status]} ⬢ {`${results.totalVotes} صوت/أصوات مسجلة`}</div>
              </div>
              {detail.election.description ? (
                <div className="watany-approved-home-icons utility-list-card__title-actions">
                  <InlineInfoButton text={detail.election.description} label={`عرض وصف ${detail.election.title}`} />
                </div>
              ) : null}
            </div>
          </div>

          {results.items.map((item, index) => {
            const width = maxVotes > 0 ? `${Math.max((item.voteCount / maxVotes) * 100, 8)}%` : "8%";
            const isLeader = index === 0 && item.voteCount > 0;

            return (
              <div key={item.optionId} className="card utility-list-card utility-list-card--compact watany-utility-list-card">
                <div className="card-title">{item.optionName}</div>
                <div className="card-sub">{`${item.voteCount} صوت/أصوات ⬢ ${formatPercent(item.voteCount, results.totalVotes)}`}</div>
                <div style={{ background: "var(--surface-2, #e2e8f0)", borderRadius: 999, height: 10, overflow: "hidden", marginTop: 10 }}>
                  <div
                    style={{
                      width,
                      height: "100%",
                      background: isLeader ? "var(--accent, #0f766e)" : "var(--primary, #2563eb)",
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            );
          })}

          {results.items.length === 0 ? <div className="muted">لا توجد أصوات مسجلة لهذا الاستطلاع حتى الآن.</div> : null}
        </div>
      ) : null}
    </div>
  );
}
function SurveyResultsPageUnifiedTemplatePage() {
  return (
    <WatanyFeatureTemplate
      title="Survey results"
      description="Review available survey insights and results."
      category="general"
    >
      <div data-watany-template-batch="v1.4.3">
        <SurveyResultsPageTemplateContent />
      </div>
    </WatanyFeatureTemplate>
  );
}

export default SurveyResultsPageUnifiedTemplatePage;


