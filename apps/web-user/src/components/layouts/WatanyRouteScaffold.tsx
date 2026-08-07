import React from "react";
import { useLocation } from "react-router-dom";
import { getWatanyRouteSpec } from "./watanyRouteSpecs";

type WatanyRouteScaffoldProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
};

export default function WatanyRouteScaffold({
  children,
  title,
  description,
  icon,
  className = "",
}: WatanyRouteScaffoldProps) {
  const location = useLocation();
  const spec = getWatanyRouteSpec(location.pathname);

  const resolvedTitle = title || spec?.title || "موطني";
  const resolvedDescription = description || spec?.description || "خدماتك ومعلوماتك في مكان واحد";
  const resolvedIcon = icon || spec?.icon || "▦";

  return (
    <section className={`wmo-miniapp wmo-rebuilt-route ${className}`.trim()} dir="rtl">
      <header className="wmo-miniapp__hero">
        <p className="wmo-miniapp__kicker">WatanyBot</p>
        <h1 className="wmo-miniapp__title">
          <span aria-hidden="true">{resolvedIcon}</span> {resolvedTitle}
        </h1>
        <p className="wmo-miniapp__description">{resolvedDescription}</p>
      </header>
      <div className="wmo-miniapp__content">{children}</div>
    </section>
  );
}
