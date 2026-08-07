import type { ReactNode } from "react";
import { IconShell } from "./IconShell";
import { WatanyV4Icon, type WatanyV4IconName } from "../theme/watany-v4";

type UtilityActionIconProps = Readonly<{
  name?: WatanyV4IconName;
  icon?: ReactNode;
  className?: string;
}>;

export function UtilityActionIcon({ name = "most-requested", className = "" }: UtilityActionIconProps) {
  return (
    <IconShell className={["utility-action-card__icon", className].filter(Boolean).join(" ")} aria-hidden="true">
      <WatanyV4Icon name={name} aria-hidden="true" />
    </IconShell>
  );
}