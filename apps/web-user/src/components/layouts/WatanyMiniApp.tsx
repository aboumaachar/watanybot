import React from "react";

type WatanyMiniAppProps = {
  children: React.ReactNode;
  title: string;
  description?: string;
  kicker?: string;
  className?: string;
};

type WatanyMiniAppCardProps = {
  title: string;
  text?: string;
  icon?: React.ReactNode;
  href?: string;
};

export function WatanyMiniApp({
  children,
  title,
  description,
  kicker = "WatanyBot",
  className = "",
}: WatanyMiniAppProps) {
  return (
    <section className={`wmo-miniapp ${className}`.trim()} dir="rtl">
      <header className="wmo-miniapp__hero">
        <p className="wmo-miniapp__kicker">{kicker}</p>
        <h1 className="wmo-miniapp__title">{title}</h1>
        {description ? <p className="wmo-miniapp__description">{description}</p> : null}
      </header>
      <div className="wmo-miniapp__content">{children}</div>
    </section>
  );
}

export function WatanyMiniAppGrid({ children }: { children: React.ReactNode }) {
  return <div className="wmo-miniapp-grid wmo-miniapp-grid--cards">{children}</div>;
}

export function WatanyMiniAppCard({ title, text, icon = "▦", href }: WatanyMiniAppCardProps) {
  const content = (
    <>
      <span className="wmo-miniapp-card__icon" aria-hidden="true">{icon}</span>
      <h2 className="wmo-miniapp-card__title">{title}</h2>
      {text ? <p className="wmo-miniapp-card__text">{text}</p> : null}
    </>
  );

  if (href) {
    return (
      <a className="wmo-miniapp-card" href={href}>
        {content}
      </a>
    );
  }

  return <article className="wmo-miniapp-card">{content}</article>;
}
