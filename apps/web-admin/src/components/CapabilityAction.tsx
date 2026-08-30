import type { ReactNode } from "react";

export type CapabilityState = "SUPPORTED" | "NOT_APPLICABLE" | "READ_ONLY" | "ROLE_RESTRICTED" | "EXTERNAL_OWNER" | "MISSING";

type CapabilityActionProps = Readonly<{
  capability: CapabilityState;
  children: ReactNode;
  onClick?: () => void;
}>;

export function CapabilityAction({ capability, children, onClick }: CapabilityActionProps) {
  const enabled = capability === "SUPPORTED";
  return (
    <button type="button" disabled={!enabled} aria-label={`${String(children)}: ${capability}`} onClick={onClick}>
      {children}
    </button>
  );
}