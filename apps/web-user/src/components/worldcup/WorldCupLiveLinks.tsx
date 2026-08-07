import { useEffect, useState } from "react";
import { api, type WorldCupMatchDto } from "../../lib/api";
import { useApp } from "../../store/app";
import { WorldCupMatchCard } from "./WorldCupMatchCard";

export function WorldCupLiveLinks() {
  const { apiBaseUrl } = useApp();
  const [matches, setMatches] = useState<WorldCupMatchDto[]>([]);
  const [loading, setLoading] = useState(true);

  const links = [
    {
      label: "FIFA - المصدر الرسمي",
      url: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026"
    }
  ];

  useEffect(() => {
    let active = true;

    void api
      .getWorldCupLive(apiBaseUrl)
      .then((payload) => {
        if (active) {
          setMatches(payload.matches ?? []);
        }
      })
      .catch(() => {
        if (active) {
          setMatches([]);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  return (
    <section className="wc-window" dir="rtl">
      <header className="wc-window__header">
        <h2>البث والمتابعة المباشرة</h2>
      </header>
      <div className="wc-window__body">
        <div className="wc-live-links__row">
          {links.map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="watany-listing-card__button watany-listing-card__button--primary">
              {link.label}
            </a>
          ))}
        </div>

        <div className="wc-news-list" style={{ marginTop: 20 }}>
          {loading ? <p className="watany-listing-card__summary">جارٍ تحميل آخر التحديثات.</p> : null}

          {!loading && matches.length === 0 ? (
            <p className="watany-listing-card__summary">لا توجد مباراة مباشرة الآن، وتم عرض أحدث المباريات المكتملة أو الأقرب التالية عند توفرها.</p>
          ) : null}

          {matches.map((match) => (
            <WorldCupMatchCard key={match.id} match={match} />
          ))}
        </div>
      </div>
    </section>
  );
}