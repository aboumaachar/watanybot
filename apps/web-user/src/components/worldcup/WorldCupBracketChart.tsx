import { worldCupMatches } from "../../data/worldCupMatches";
import { getGroupColorToken, getGroupKey } from "./groupPalette";

export function WorldCupBracketChart() {
  const grouped = worldCupMatches.reduce<Record<string, typeof worldCupMatches>>((acc, match) => {
    const key = getGroupKey(match.stage) || "OTHER";
    const groupMatches = acc[key] ?? [];
    groupMatches.push(match);
    acc[key] = groupMatches;
    return acc;
  }, {});

  const orderedGroups = Object.keys(grouped).sort((left, right) => left.localeCompare(right));

  return (
    <section className="wc-window" dir="rtl">
      <header className="wc-window__header">
        <h2>شجرة المباريات (بصري + قائمة)</h2>
      </header>
      <div className="wc-window__body">
        <div className="wc-bracket-tree">
          {orderedGroups.map((group) => {
            const token = getGroupColorToken(`Group ${group}`);
            return (
              <article
                key={group}
                className="wc-bracket-group"
                style={{ borderColor: token.border, background: token.bg }}
              >
                <header className="wc-bracket-group__head" style={{ color: token.text }}>
                  المجموعة {group}
                </header>
                <div className="wc-bracket-group__matches">
                  {grouped[group].map((match) => (
                    <div key={match.id} className="wc-bracket-node" style={{ borderColor: token.border }}>
                      <strong>{match.teamA} × {match.teamB}</strong>
                      <span>{new Date(match.dateTime).toLocaleString("ar-LB", { dateStyle: "medium", timeStyle: "short" })}</span>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        <div className="wc-tree-listing">
          <h3>قائمة المباريات الكاملة</h3>
          <div className="wc-tree-listing__rows">
            {worldCupMatches.map((match) => {
              const token = getGroupColorToken(match.stage);
              return (
                <div key={`list-${match.id}`} className="wc-tree-row" style={{ borderInlineStartColor: token.border }}>
                  <span className="wc-tree-row__teams">{match.teamA} × {match.teamB}</span>
                  <span className="wc-tree-row__meta">{match.stage}</span>
                  <span className="wc-tree-row__meta">{new Date(match.dateTime).toLocaleString("ar-LB", { dateStyle: "medium", timeStyle: "short" })}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}