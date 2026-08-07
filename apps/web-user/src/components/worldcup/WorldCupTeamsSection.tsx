import { worldCupTeams } from "../../data/worldCupTeams";
import { getGroupColorToken } from "./groupPalette";

export function WorldCupTeamsSection() {
  return (
    <section className="wc-window wc-teams-section" dir="rtl">
      <header className="wc-window__header">
        <h2>المنتخبات واللاعبون</h2>
      </header>
      <div className="wc-window__body">
        <div className="wc-teams-grid">
          {worldCupTeams.map((team) => (
            <article
              key={team.id}
              className="wc-team-card watany-listing-card"
              style={{
                borderColor: getGroupColorToken(team.group).border,
                background: getGroupColorToken(team.group).bg,
                color: getGroupColorToken(team.group).text,
              }}
            >
              <div className="wc-team-card__head">
                <h4 className="watany-listing-card__title">
                  <span>{team.flagEmoji}</span>
                  {team.nameAr}
                </h4>
                <span className="wc-team-card__group watany-listing-card__badge">{team.group ?? "تحدد لاحقاً"}</span>
              </div>

              <div className="wc-team-card__meta watany-listing-card__summary">
                <span>{`عدد اللاعبين: ${team.players.length}`}</span>
                <span>{team.nameEn}</span>
              </div>

              <details className="wc-team-card__details">
                <summary className="wc-team-card__summary">عرض اللاعبين</summary>
                <ul className="wc-team-card__players">
                  {team.players.map((player) => (
                    <li key={player.id}>
                      <span>{player.name}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}