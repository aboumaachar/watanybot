import { ArrowRight24Regular, ChevronLeft24Regular } from "../theme/watany-v4/legacyIconBridge";

type Props = Readonly<{
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  trailing?: React.ReactNode;
  breadcrumbs?: { label: string; onClick?: () => void }[];
}>;

/**
 * Universal screen header.
 * - On tab screens: shows app title (ط `) + optional right actions
 * - On sub-screens: shows   back + screen title + breadcrumbs
 */
export function ScreenHeader({ title, showBack, onBack, trailing, breadcrumbs }: Props) {
  return (
    <header className="screen-header" role="banner">
      {showBack ? (
        <button className="screen-header__back" onClick={onBack} aria-label="رجوع" title="رجوع">
          <ArrowRight24Regular aria-hidden />
        </button>
      ) : (
        <div className="screen-header__logo">موطني</div>
      )}

      <div className="screen-header__center">
        <h1 className="screen-header__title">{title}</h1>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="screen-header__breadcrumbs" aria-label="المسار">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.label}>
                {crumb.onClick ? (
                  <button className="breadcrumb-link" onClick={crumb.onClick}>{crumb.label}</button>
                ) : (
                  <span className="breadcrumb-current">{crumb.label}</span>
                )}
                {i < breadcrumbs.length - 1 && <ChevronLeft24Regular aria-hidden className="breadcrumb-sep" />}
              </span>
            ))}
          </nav>
        )}
      </div>

      <div className="screen-header__trailing">
        {trailing}
      </div>
    </header>
  );
}



