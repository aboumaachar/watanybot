import React, { useEffect, useState } from "react";
import { api, type WorldCupMatchDto } from "../../lib/api";
import { WorldCupMatchCard } from "./WorldCupMatchCard";

export function WorldCupAgendaSection() {
  const [matches, setMatches] = useState<WorldCupMatchDto[] | null>(null);

  useEffect(() => {
    let active = true;

    void api
      .getWorldCupMatches()
      .then((items) => {
        if (active) {
          setMatches(items);
        }
      })
      .catch(() => {
        if (active) {
          setMatches([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="wc-window" dir="rtl">
      <header className="wc-window__header">
        <h2>أجندة المباريات</h2>
      </header>
      <div className="wc-window__body">
        <div className="watany-listing-grid watany-listing-grid--two-col">
          {matches === null ? (
            <p className="text-sm text-slate-600">جارٍ تحميل جدول المباريات.</p>
          ) : matches.length > 0 ? (
            matches.map((match) => <WorldCupMatchCard key={match.id} match={match} />)
          ) : (
            <p className="text-sm text-slate-600">لا توجد مباريات متاحة الآن.</p>
          )}
        </div>
      </div>
    </section>
  );
}