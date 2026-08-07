import React from "react";
import WatanyRouteScaffold from "./WatanyRouteScaffold";

type WatanySupportRouteProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
};

export default function WatanySupportRoute({
  children,
  title,
  description,
  icon,
  className = "",
}: WatanySupportRouteProps) {
  return (
    <WatanyRouteScaffold
      title={title}
      description={description}
      icon={icon}
      className={`wmo-support-route ${className}`.trim()}
    >
      {children}
    </WatanyRouteScaffold>
  );
}
