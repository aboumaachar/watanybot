import * as React from "react";

export type WatanyListingBadge = {
  label: string;
  tone?: "default" | "gold";
};

export type WatanyListingAction = {
  label: string;
  onClick: () => void;
  tone?: "primary" | "secondary";
  disabled?: boolean;
};

export type WatanyListingCardProps = {
  title: string;
  summary: string;
  badges?: WatanyListingBadge[];
  rankLabel?: string;
  primaryAction: WatanyListingAction;
  secondaryAction?: WatanyListingAction;
};

export const watanyListingCardTheme = {
  tile: "watany-listing-card",
  topWrap: "watany-listing-card__top",
  body: "watany-listing-card__body",
  itemTitle: "watany-listing-card__title",
  summary: "watany-listing-card__summary",
  meta: "watany-listing-card__meta",
  pill: "watany-listing-card__badge",
  pillGold: "watany-listing-card__badge watany-listing-card__badge--gold",
  rank: "watany-listing-card__rank",
  actionRow: "watany-listing-card__actions",
  actionButtonPrimary: "watany-listing-card__button watany-listing-card__button--primary",
  actionButtonSecondary: "watany-listing-card__button watany-listing-card__button--secondary",
} as const;

export function WatanyListingCard({
  title,
  summary,
  badges = [],
  rankLabel,
  primaryAction,
  secondaryAction,
}: WatanyListingCardProps): React.ReactElement {
  return (
    <article className={watanyListingCardTheme.tile}>
      <div className={watanyListingCardTheme.topWrap}>
        <div className={watanyListingCardTheme.body}>
          <h3 className={watanyListingCardTheme.itemTitle}>{title}</h3>
          <p className={watanyListingCardTheme.summary}>{summary}</p>
          <div className={watanyListingCardTheme.meta}>
            {badges.map((badge) => (
              <span
                key={`${badge.tone ?? "default"}-${badge.label}`}
                className={badge.tone === "gold" ? watanyListingCardTheme.pillGold : watanyListingCardTheme.pill}
              >
                {badge.label}
              </span>
            ))}
            {rankLabel ? <span className={watanyListingCardTheme.rank}>{rankLabel}</span> : null}
          </div>
        </div>
      </div>
      <div className={watanyListingCardTheme.actionRow}>
        {secondaryAction ? (
          <button className={watanyListingCardTheme.actionButtonSecondary} type="button" onClick={secondaryAction.onClick} disabled={secondaryAction.disabled}>
            {secondaryAction.label}
          </button>
        ) : null}
        <button className={watanyListingCardTheme.actionButtonPrimary} type="button" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
          {primaryAction.label}
        </button>
      </div>
    </article>
  );
}

export default WatanyListingCard;