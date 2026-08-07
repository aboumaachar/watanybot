import { useEffect, useMemo, useState } from 'react';

type EngagementSummary = {
  points: number;
  reputation: number;
  level: {
    code: string;
    titleAr: string;
    titleEn: string | null;
    minimumPoints: number;
  };
  nextLevel: {
    code: string;
    titleAr: string;
    minimumPoints: number;
    pointsRemaining: number;
  } | null;
  badges: Array<{
    code: string;
    titleAr: string;
    descriptionAr: string | null;
    iconName: string | null;
    awardedAt: string;
  }>;
};

const cardStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 20,
  border: '1px solid rgba(15, 23, 42, 0.10)',
  background: 'rgba(255, 255, 255, 0.96)',
  boxShadow: '0 10px 28px rgba(15, 23, 42, 0.08)',
  padding: 18,
};

export default function EngagementPage() {
  const [summary, setSummary] = useState<EngagementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorAr, setErrorAr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSummary() {
      try {
        const response = await fetch('/api/engagement/me', {
          credentials: 'include',
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('سجّل الدخول لعرض رصيد المشاركة والتقدّم.');
          }

          throw new Error('تعذّر تحميل رصيد المشاركة حالياً.');
        }

        const data = (await response.json()) as EngagementSummary;
        if (active) {
          setSummary(data);
        }
      } catch (error) {
        if (active) {
          setErrorAr(
            error instanceof Error
              ? error.message
              : 'تعذّر تحميل رصيد المشاركة حالياً.',
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSummary();

    return () => {
      active = false;
    };
  }, []);

  const progress = useMemo(() => {
    if (!summary?.nextLevel) {
      return 100;
    }

    const currentMinimum = summary.level.minimumPoints;
    const nextMinimum = summary.nextLevel.minimumPoints;
    const interval = Math.max(1, nextMinimum - currentMinimum);
    const completed = summary.points - currentMinimum;

    return Math.max(0, Math.min(100, Math.round((completed / interval) * 100)));
  }, [summary]);

  return (
    <main
      dir="rtl"
      style={{
        width: '100%',
        maxWidth: 760,
        margin: '0 auto',
        padding: '16px 12px 96px',
        boxSizing: 'border-box',
        color: '#111827',
      }}
    >
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
          رصيد المشاركة والتقدير
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: 16, lineHeight: 1.8 }}>
          تقدير محترم للتعلّم، ومساعدة المجتمع، والعمل التطوعي، والمشاركة
          المدنية الموثّقة.
        </p>
      </header>

      {loading ? (
        <section style={cardStyle}>يتم تحميل رصيدك…</section>
      ) : errorAr ? (
        <section role="alert" style={cardStyle}>
          {errorAr}
        </section>
      ) : summary ? (
        <div style={{ display: 'grid', gap: 14 }}>
          <section style={cardStyle}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>المستوى الحالي</div>
            <div style={{ marginTop: 8, fontSize: 26, fontWeight: 900 }}>
              {summary.level.titleAr}
            </div>
            <div
              aria-label={`التقدّم ${progress}%`}
              style={{
                height: 12,
                marginTop: 16,
                borderRadius: 999,
                background: 'rgba(15, 23, 42, 0.08)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: 'currentColor',
                  opacity: 0.75,
                }}
              />
            </div>
            <div style={{ marginTop: 10, fontSize: 15 }}>
              {summary.nextLevel
                ? `بقي ${summary.nextLevel.pointsRemaining} نقطة للوصول إلى ${summary.nextLevel.titleAr}.`
                : 'وصلت إلى أعلى مستوى تقدير متاح حالياً.'}
            </div>
          </section>

          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 12,
            }}
          >
            <div style={cardStyle}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>نقاط المشاركة</div>
              <strong style={{ display: 'block', marginTop: 8, fontSize: 28 }}>
                {summary.points}
              </strong>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>رصيد الثقة</div>
              <strong style={{ display: 'block', marginTop: 8, fontSize: 28 }}>
                {summary.reputation}
              </strong>
            </div>
          </section>

          <section style={cardStyle}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
              أوسمة التقدير
            </h2>

            {summary.badges.length === 0 ? (
              <p style={{ margin: '12px 0 0', lineHeight: 1.8 }}>
                ستظهر هنا الأوسمة التي تحصل عليها من المساهمات والأنشطة
                الموثّقة.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                {summary.badges.map((badge) => (
                  <article
                    key={`${badge.code}:${badge.awardedAt}`}
                    style={{
                      borderRadius: 16,
                      border: '1px solid rgba(15, 23, 42, 0.10)',
                      padding: 14,
                    }}
                  >
                    <div style={{ fontSize: 17, fontWeight: 800 }}>
                      {badge.titleAr}
                    </div>
                    {badge.descriptionAr ? (
                      <div style={{ marginTop: 6, lineHeight: 1.7 }}>
                        {badge.descriptionAr}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section style={cardStyle}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
              كيف يُحتسب الرصيد؟
            </h2>
            <p style={{ margin: '10px 0 0', lineHeight: 1.9 }}>
              النقاط تقيس النشاط المفيد، بينما رصيد الثقة يُمنح فقط للمساهمات
              الموثّقة. لا تُمنح نقاط لمجرد تحديث الصفحة، وتخضع الأنشطة لحدود
              يومية ومنع التكرار ومراجعة الإدارة عند الحاجة.
            </p>
          </section>
        </div>
      ) : null}
    </main>
  );
}