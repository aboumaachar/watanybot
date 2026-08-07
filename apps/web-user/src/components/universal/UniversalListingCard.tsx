import React, { useState } from "react";

export type UniversalListingCardProps = {
  id?: string;
  icon?: React.ReactNode;
  title: string;
  badges?: string[];
  summary?: string;
  actions?: Array<{ label: string; onClick?: () => void }>; 
  expanded?: React.ReactNode;
};

export default function UniversalListingCard(props: UniversalListingCardProps) {
  const { icon, title, badges = [], summary, actions = [], expanded } = props;
  const [open, setOpen] = useState(false);

  return (
    <article className="universal-listing-card watany-listing-card" role="group" data-expanded={open ? "true" : "false"}>
      <header className="universal-listing-card__head">
        <div className="universal-listing-card__icon">{icon}</div>
        <div className="universal-listing-card__meta">
          <h3 className="universal-listing-card__title watany-listing-card__title">{title}</h3>
          {badges.length > 0 && (
            <div className="universal-listing-card__badges watany-listing-card__meta">
              {badges.map((b, i) => (
                <span key={i} className="universal-listing-card__badge watany-listing-card__badge">{b}</span>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="universal-listing-card__summary watany-listing-card__summary">{summary}</div>

      <div className="universal-listing-card__actions watany-listing-card__actions">
        {actions.map((a, i) => (
          <button key={i} type="button" className="btn watany-listing-card__button watany-listing-card__button--secondary" onClick={a.onClick}>{a.label}</button>
        ))}
        <button type="button" className="btn btn-ghost watany-listing-card__button watany-listing-card__button--secondary" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "إغلاق" : "تفاصيل"}
        </button>
      </div>

      {open && expanded && (
        <div className="universal-listing-card__expanded">
          {expanded}
        </div>
      )}

    </article>
  );
}
