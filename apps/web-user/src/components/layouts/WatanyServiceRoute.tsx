import React from "react";
import WatanyRouteScaffold from "./WatanyRouteScaffold";

type WatanyServiceRouteProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
};

export default function WatanyServiceRoute({
  children,
  title,
  description,
  icon,
  className = "",
}: WatanyServiceRouteProps) {
  return (
    <WatanyRouteScaffold
      title={title}
      description={description}
      icon={icon}
      className={`wmo-service-route ${className}`.trim()}
    >
      {children}
    </WatanyRouteScaffold>
  );
}
