import { useNavigate } from "react-router-dom";
import { WatanyListingCard } from "../components/listings/WatanyListingCard";
import { activeWatanySurveys } from "../data/surveyRegistry";

function recordSurveyOpen(featureKey: string): void {
  try {
    const raw = localStorage.getItem("watany-smart-attention-events-v1");
    const rows = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(rows) ? rows : [];
    list.push({ type: "open_item", id: featureKey, at: Date.now(), path: location.pathname });
    localStorage.setItem("watany-smart-attention-events-v1", JSON.stringify(list.slice(-120)));
  } catch { /* never block navigation */ }
  void fetch("/mcp/api/engagement/event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ featureKey }),
  }).catch(() => undefined);
}

export default function SurveysPage() {
  const navigate = useNavigate();
  return <main dir="rtl" className="wt-page" data-surveys-page="true">
    <section className="wt-panel">
      <h1>الاستبيانات</h1>
      <p>شارك في الاستبيانات المفتوحة وساعد موطني على توثيق الاحتياجات والحالات بصورة أدق.</p>
    </section>
    <section className="wt-listing-grid" aria-label="الاستبيانات المفتوحة">
      {activeWatanySurveys.map((survey) => <WatanyListingCard
        key={survey.id}
        title={survey.title}
        summary={survey.summary}
        badges={[{ label: "مفتوح" }, { label: survey.audience, tone: "gold" }]}
        primaryAction={{ label: "فتح الاستبيان", onClick: () => { recordSurveyOpen(survey.id); navigate(survey.route); } }}
      />)}
    </section>
  </main>;
}
