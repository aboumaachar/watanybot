import { getWorldCupMatchStatus, worldCupMatches } from "../../data/worldCupMatches";
import { worldCupTeams, type WorldCupTeam } from "../../data/worldCupTeams";
import { getGroupColorToken } from "./groupPalette";

function parseScore(score?: string) {
  if (!score) {
    return null;
  }

  const match = /(\d+)\s*[-–:]\s*(\d+)/.exec(score);
  if (!match) {
    return null;
  }

  return {
    home: Number(match[1]),
    away: Number(match[2]),
  };
}

function isKnockoutStage(stage: string) {
  const normalized = stage.trim();
  return normalized.length > 0 && !normalized.includes("المجموعة") && !/^group/i.test(normalized);
}

function getRaceSnapshot() {
  const eliminatedNames = new Set<string>();

  for (const match of worldCupMatches) {
    if (getWorldCupMatchStatus(match) !== "finished" || !isKnockoutStage(match.stage)) {
      continue;
    }

    const parsed = parseScore(match.score);
    if (!parsed || parsed.home === parsed.away) {
      continue;
    }

    eliminatedNames.add(parsed.home > parsed.away ? match.teamB : match.teamA);
  }

  const inRace = worldCupTeams.filter((team) => !eliminatedNames.has(team.nameAr));
  const out = worldCupTeams.filter((team) => eliminatedNames.has(team.nameAr));

  return { inRace, out };
}

function TeamStatusCard({ team, tone }: Readonly<{ team: WorldCupTeam; tone: "positive" | "muted" }>) {
  const token = getGroupColorToken(team.group);
  return (
    <article
      className={`wc-race-card wc-race-card--${tone} watany-listing-card`}
      style={{
        borderColor: token.border,
        background: token.bg,
        color: token.text,
      }}
    >
      <h4 className="watany-listing-card__title">
        <span>{team.flagEmoji}</span>
        {team.nameAr}
      </h4>
      <p className="watany-listing-card__summary">{team.nameEn}</p>
      <span className="watany-listing-card__badge">{team.group ?? "تحدد لاحقاً"}</span>
    </article>
  );
}

export function WorldCupRaceStatusSection({ embedded = false }: Readonly<{ embedded?: boolean }>) {
  const { inRace, out } = getRaceSnapshot();

  return (
    <section className="wc-race-section" dir="rtl">
      {!embedded && (
        <header className="wc-window__header wc-results-section__header">
          <h2>من ما زال في السباق؟</h2>
        </header>
      )}

      <div className="wc-race-summary" aria-label="ملخص السباق">
        <article>
          <strong>{inRace.length}</strong>
          <span>منتخب ما زال ينافس</span>
        </article>
        <article>
          <strong>{out.length}</strong>
          <span>منتخب خرج من البطولة</span>
        </article>
      </div>

      <div className="wc-race-grid">
        <section className="wc-results-panel" aria-labelledby="wc-in-race-title">
          <div className="wc-results-panel__title-row">
            <h3 id="wc-in-race-title">ما زالت في السباق</h3>
            <span>{`${inRace.length} منتخب`}</span>
          </div>
          <div className="wc-race-card-grid">
            {inRace.map((team) => <TeamStatusCard key={team.id} team={team} tone="positive" />)}
          </div>
        </section>

        <section className="wc-results-panel" aria-labelledby="wc-out-race-title">
          <div className="wc-results-panel__title-row">
            <h3 id="wc-out-race-title">خارج البطولة</h3>
            <span>{`${out.length} منتخب`}</span>
          </div>

          {out.length > 0 ? (
            <div className="wc-race-card-grid">
              {out.map((team) => <TeamStatusCard key={team.id} team={team} tone="muted" />)}
            </div>
          ) : (
            <div className="wc-results-empty" role="status" aria-live="polite">
              <strong>لا توجد منتخبات خارجة حتى الآن.</strong>
              <p>سيظهر هذا القسم تلقائياً بمجرد توفر نتائج إقصائية مؤكدة.</p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}