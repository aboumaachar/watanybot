import { getWorldCupMatchStatus, type WorldCupMatch } from "../../data/worldCupMatches";
import { getGroupColorToken } from "./groupPalette";
import { Link } from "react-router-dom";

type Props = {
  match: WorldCupMatch;
};

export function WorldCupMatchCard({ match }: Readonly<Props>) {
  const date = new Date(match.dateTime);
  const groupToken = getGroupColorToken(match.stage);
  const status = getWorldCupMatchStatus(match);
  let statusLabel = "انتهت";
  if (status === "scheduled") {
    statusLabel = "مجدولة";
  } else if (status === "live") {
    statusLabel = "مباشرة";
  }

  return (
    <Link className="wc-listing-link" to={`/world-cup/match/${match.id}`} aria-label={`تفاصيل مباراة ${match.teamA} ضد ${match.teamB}`}>
      <article className="wc-listing-card watany-listing-card" dir="rtl">
        <div className="wc-listing-card__head">
          <h3 className="wc-listing-card__title watany-listing-card__title">
            {match.teamA} × {match.teamB}
          </h3>
          <span className="wc-listing-card__status watany-listing-card__badge">{statusLabel}</span>
        </div>

        <p className="wc-listing-card__meta watany-listing-card__summary">
          <span
            className="wc-listing-card__stage"
            style={{ background: groupToken.bg, color: groupToken.text, border: `1px solid ${groupToken.border}` }}
          >
            {match.stage}
          </span>
        </p>
        <p className="wc-listing-card__meta watany-listing-card__summary">
          {date.toLocaleString("ar-LB", { dateStyle: "medium", timeStyle: "short" })}
        </p>
        <p className="wc-listing-card__meta watany-listing-card__summary">{match.venue}</p>

        {status === "finished" || match.score ? (
          <p className="wc-listing-card__score">
            النتيجة: {match.score ?? "غير متاحة بعد"}
          </p>
        ) : null}
      </article>
    </Link>
  );
}