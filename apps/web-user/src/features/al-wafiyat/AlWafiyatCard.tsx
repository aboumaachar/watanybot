import type { AlWafiyatNoticeLike } from "./alWafiyat.types";
import { getAlWafiyatStatusLabel, getAlWafiyatStatusTone } from "./alWafiyat.classifier";
import { getAlWafiyatExcerpt, getAlWafiyatExternalLinks, getAlWafiyatMetaLine } from "./alWafiyat.mapper";

export function AlWafiyatCard({
  notice,
  actions,
}: Readonly<{
  notice: AlWafiyatNoticeLike;
  actions?: React.ReactNode;
}>) {
  const links = getAlWafiyatExternalLinks(notice);
  const excerpt = getAlWafiyatExcerpt(notice);

  return (
    <article className="wt-list__item">
      <div className="wt-list__main">
        <strong className="wt-list__title">{notice.title}</strong>
        <span className="wt-list__sub">{getAlWafiyatMetaLine(notice)}</span>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "0.5rem 0" }}>
          <span className={getAlWafiyatStatusTone(notice.status)}>{getAlWafiyatStatusLabel(notice.status)}</span>
          <span className="wt-pill">{notice.sourceProviderAr}</span>
        </div>
        {excerpt ? <p className="wt-muted">{excerpt}</p> : null}
      </div>

      <div className="wt-list__actions">
        <a className="wt-btn wt-btn--ghost" href={links.sourceUrl} target="_blank" rel="noreferrer">
          {links.sourceLabel}
        </a>
        {links.originalUrl ? (
          <a className="wt-btn wt-btn--ghost" href={links.originalUrl} target="_blank" rel="noreferrer">
            الإعلان الأصلي
          </a>
        ) : null}
        {actions}
      </div>
    </article>
  );
}