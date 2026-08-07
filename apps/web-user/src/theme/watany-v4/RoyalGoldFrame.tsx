import type { HTMLAttributes, ReactNode } from "react";

type RoyalGoldFrameProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
};

export function RoyalGoldFrame({ children, className = "", ...rest }: RoyalGoldFrameProps) {
  return (
    <span {...rest} className={["royal-gold-frame", className].filter(Boolean).join(" ")}>
      <span className="royal-gold-frame__highlight" aria-hidden="true" />
      <span className="royal-gold-frame__plate">{children}</span>
    </span>
  );
}