import React from "react";
import WatanyRouteScaffold from "./WatanyRouteScaffold";

type WatanyUtilityRouteProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
};

export default function WatanyUtilityRoute({
  children,
  title,
  description,
  icon,
  className = "",
}: WatanyUtilityRouteProps) {
  return (
    <WatanyRouteScaffold
      title={title}
      description={description}
      icon={icon}
      className={`wmo-utility-route ${className}`.trim()}
    >
      {children}
    </WatanyRouteScaffold>
  );
}
