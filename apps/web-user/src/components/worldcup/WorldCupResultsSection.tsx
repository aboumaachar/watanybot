import { useEffect, useMemo, useState } from "react";
import { getWorldCupMatchStatus, worldCupMatches } from "../../data/worldCupMatches";
import { api, type WorldCupMatchDto } from "../../lib/api";
import { getGroupKey, getGroupColorToken } from "./groupPalette";
import { WorldCupMatchCard } from "./WorldCupMatchCard";
import { WorldCupRaceStatusSection } from "./WorldCupRaceStatusSection";

type GroupStandingRow = {
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

function parseScore(score?: string | null) {
  if (!score) {
    return null;
  }

  const match = /(\d+)\s*[-–:]\s*(\d+)/.exec(score);
  if (!match) {
    return null;
  }

  return { home: Number(match[1]), away: Number(match[2]) };
}

function compareStandingRows(left: GroupStandingRow, right: GroupStandingRow) {
  return (
    right.points - left.points ||
    (right.goalsFor - right.goalsAgainst) - (left.goalsFor - left.goalsAgainst) ||
    right.goalsFor - left.goalsFor ||
    left.team.localeCompare(right.team, "ar")
  );
}

function buildGroupStandings(matches: WorldCupMatchDto[]) {
  const table = new Map<string, Map<string, GroupStandingRow>>();

  for (const match of matches) {
    const groupKey = getGroupKey(match.stage);
    const score = parseScore(match.score);
    if (!groupKey || !score || match.status !== "finished") {
      continue;
    }

    const rows = table.get(groupKey) ?? new Map<string, GroupStandingRow>();
    const home = rows.get(match.teamA) ?? { team: match.teamA, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
    const away = rows.get(match.teamB) ?? { team: match.teamB, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };

    home.played += 1;
    away.played += 1;
    home.goalsFor += score.home;
    home.goalsAgainst += score.away;
    away.goalsFor += score.away;
    away.goalsAgainst += score.home;

    if (score.home > score.away) {
      home.wins += 1;
      home.points += 3;
      away.losses += 1;
    } else if (score.home < score.away) {
      away.wins += 1;
      away.points += 3;
      home.losses += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }

    rows.set(match.teamA, home);
    rows.set(match.teamB, away);
    table.set(groupKey, rows);
  }

  return Array.from(table.entries())
    .map(([group, rows]) => ({
      group,
      rows: Array.from(rows.values()).sort(compareStandingRows),
    }))
    .sort((left, right) => left.group.localeCompare(right.group, "en"));
}

export function WorldCupResultsSection() {
  const [resolvedMatches, setResolvedMatches] = useState(worldCupMatches);
  const liveMatches = resolvedMatches.filter((match) => getWorldCupMatchStatus(match) === "live");
  const finishedMatches = resolvedMatches.filter((match) => getWorldCupMatchStatus(match) === "finished");
  const upcomingMatches = worldCupMatches.filter((match) => getWorldCupMatchStatus(match) === "scheduled").slice(0, 4);

  useEffect(() => {
    let active = true;

    async function loadResolvedMatches() {
      try {
        const settled = await Promise.all(
          worldCupMatches.map(async (match) => {
            try {
              const dto = await api.getWorldCupMatchById(match.id);
              return dto ?? match;
            } catch {
              return match;
            }
          }),
        );

        if (active) {
          setResolvedMatches(settled);
        }
      } catch {
        if (active) {
          setResolvedMatches(worldCupMatches);
        }
      }
    }

    void loadResolvedMatches();
    return () => {
      active = false;
    };
  }, []);

  const groupStandings = useMemo(() => buildGroupStandings(finishedMatches), [finishedMatches]);

  return (
    <section className="wc-results-section" dir="rtl">
      <header className="wc-window__header wc-results-section__header">
        <h2>النتائج</h2>
      </header>

      {liveMatches.length > 0 && (
        <section className="wc-results-panel" aria-labelledby="wc-live-results-title">
          <div className="wc-results-panel__title-row">
            <h3 id="wc-live-results-title">مباشر الآن</h3>
            <span>{`${liveMatches.length} مباراة`}</span>
          </div>
          <div className="watany-listing-grid watany-listing-grid--two-col">
            {liveMatches.map((match) => <WorldCupMatchCard key={match.id} match={match} />)}
          </div>
        </section>
      )}

      <section className="wc-results-panel" aria-labelledby="wc-finished-results-title">
        <div className="wc-results-panel__title-row">
          <h3 id="wc-finished-results-title">نتائج مؤكدة</h3>
          <span>{`${finishedMatches.length} مباراة`}</span>
        </div>

        {finishedMatches.length > 0 ? (
          <div className="watany-listing-grid watany-listing-grid--two-col">
            {finishedMatches.map((match) => <WorldCupMatchCard key={match.id} match={match} />)}
          </div>
        ) : (
          <div className="wc-results-empty" role="status" aria-live="polite">
            <strong>لا توجد نتائج نهائية بعد.</strong>
            <p>إلى أن تبدأ المباريات، نعرض أقرب المواجهات المنتظرة هنا.</p>
            <div className="watany-listing-grid watany-listing-grid--two-col">
              {upcomingMatches.map((match) => <WorldCupMatchCard key={match.id} match={match} />)}
            </div>
          </div>
        )}
      </section>

      <section className="wc-results-panel" aria-labelledby="wc-group-standings-title">
        <div className="wc-results-panel__title-row">
          <h3 id="wc-group-standings-title">ترتيب المجموعات</h3>
          <span>يُحدّث من النتائج النهائية</span>
        </div>

        {groupStandings.length > 0 ? (
          <div className="wc-group-standings-grid">
            {groupStandings.map(({ group, rows }) => {
              const token = getGroupColorToken(`Group ${group}`);
              return (
                <section key={group} className="wc-group-standings-card" style={{ borderColor: token.border, background: token.bg }}>
                  <header className="wc-group-standings-card__head" style={{ color: token.text }}>
                    المجموعة {group}
                  </header>
                  <div className="wc-group-standings-card__table">
                    {rows.map((row, index) => (
                      <div key={`${group}-${row.team}`} className="wc-group-standings-card__row">
                        <span className="wc-group-standings-card__rank">{index + 1}</span>
                        <span className="wc-group-standings-card__team">{row.team}</span>
                        <span>{row.played}</span>
                        <span>{row.points}</span>
                        <span>{row.goalsFor - row.goalsAgainst}</span>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="wc-results-empty" role="status" aria-live="polite">
            <strong>لا توجد نتائج نهائية مؤكدة بعد.</strong>
            <p>سيظهر ترتيب المجموعات تلقائياً عندما تتوفر نتائج المباريات النهائية.</p>
          </div>
        )}
      </section>

      <section className="wc-results-panel" aria-labelledby="wc-race-status-title">
        <div className="wc-results-panel__title-row">
          <h3 id="wc-race-status-title">في السباق / خارج</h3>
          <span>حالة المنتخبات</span>
        </div>
        <WorldCupRaceStatusSection embedded />
      </section>
    </section>
  );
}