import React from "react";

type WatanyMobilePageProps = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  full?: boolean;
  className?: string;
};

export default function WatanyMobilePage({
  children,
  title,
  subtitle,
  eyebrow = "WatanyBot",
  full = false,
  className = "",
}: WatanyMobilePageProps) {
  return (
    <section className={`wmo-page ${full ? "wmo-page--full" : ""} ${className}`.trim()} dir="rtl">
      {(title || subtitle || eyebrow) && (
        <header className="wmo-page__header">
          {eyebrow ? <p className="wmo-page__eyebrow">{eyebrow}</p> : null}
          {title ? <h1 className="wmo-page__title">{title}</h1> : null}
          {subtitle ? <p className="wmo-page__subtitle">{subtitle}</p> : null}
        </header>
      )}
      <div className="wmo-page__body">{children}</div>
    </section>
  );
}
