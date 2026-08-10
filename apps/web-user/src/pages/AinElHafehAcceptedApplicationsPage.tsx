import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../store/app";
import "../styles/jobs-ainelhafeh-accepted.css";

type AcceptedApplication = {
  id: string;
  name: string;
  relationType: string;
  governorate: string;
  caza: string;
  village: string;
  availability: string;
  preferredPeriod?: string;
  createdAt: string;
};

function locationLabel(application: AcceptedApplication): string {
  return [application.governorate, application.caza, application.village].filter(Boolean).join("، ");
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "غير محدد";
  return new Intl.DateTimeFormat("ar-LB", { dateStyle: "medium" }).format(parsed);
}

export default function AinElHafehAcceptedApplicationsPage() {
  const { apiBaseUrl } = useApp();
  const [applications, setApplications] = useState<AcceptedApplication[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;

    fetch(`${apiBaseUrl}/api/koudama/surveys/seasonal-apple-job/accepted`, {
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("ACCEPTED_APPLICATIONS_FAILED");
        return response.json() as Promise<{ applications?: AcceptedApplication[] }>;
      })
      .then((payload) => {
        if (!active) return;
        setApplications(Array.isArray(payload.applications) ? payload.applications : []);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  return (
    <main className="ainelhafeh-accepted-page" dir="rtl">
      <header className="ainelhafeh-accepted-hero">
        <div>
          <p className="ainelhafeh-accepted-kicker">قطاف التفاح في تنورين</p>
          <h1>الطلبات المقبولة</h1>
          <p>الأسماء التالية قبلت للموسم الحالي. لا تظهر بيانات الاتصال حفاظاً على الخصوصية.</p>
        </div>
        <Link className="ainelhafeh-accepted-back" to="/jobs/ainelhafeh">العودة إلى صفحة التسجيل</Link>
      </header>

      <section className="ainelhafeh-accepted-content" aria-labelledby="accepted-list-title">
        <div className="ainelhafeh-accepted-content__heading">
          <div>
            <span className="ainelhafeh-accepted-count" aria-label={`عدد الطلبات المقبولة: ${applications.length}`}>
              {status === "ready" ? applications.length : "—"}
            </span>
            <h2 id="accepted-list-title">المقبولون في الموسم</h2>
          </div>
          <span className="ainelhafeh-accepted-status">مقبول</span>
        </div>

        {status === "loading" ? <p className="ainelhafeh-accepted-state">جارٍ تحميل القائمة...</p> : null}
        {status === "error" ? <p className="ainelhafeh-accepted-state ainelhafeh-accepted-state--error">تعذر تحميل القائمة حالياً. حاول مجدداً بعد قليل.</p> : null}
        {status === "ready" && applications.length === 0 ? (
          <div className="ainelhafeh-accepted-empty">
            <strong>لم تصدر قائمة قبول بعد</strong>
            <p>ستظهر الطلبات هنا فور اعتمادها من فريق الفرصة.</p>
          </div>
        ) : null}
        {status === "ready" && applications.length > 0 ? (
          <div className="ainelhafeh-accepted-list">
            {applications.map((application) => (
              <article className="ainelhafeh-accepted-card" key={application.id}>
                <div className="ainelhafeh-accepted-card__topline">
                  <span className="ainelhafeh-accepted-card__mark" aria-hidden="true">✓</span>
                  <div>
                    <h3>{application.name}</h3>
                    <p>{application.relationType}</p>
                  </div>
                </div>
                <dl className="ainelhafeh-accepted-card__details">
                  <div><dt>العنوان</dt><dd>{locationLabel(application) || "غير محدد"}</dd></div>
                  <div><dt>التوفر</dt><dd>{application.availability || "غير محدد"}</dd></div>
                  <div><dt>الفترة</dt><dd>{application.preferredPeriod || "مرن"}</dd></div>
                  <div><dt>تاريخ التسجيل</dt><dd>{formatDate(application.createdAt)}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}