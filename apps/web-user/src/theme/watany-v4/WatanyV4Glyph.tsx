import type { ImgHTMLAttributes, SVGProps } from "react";
import { WatanyV4Icon } from "./WatanyV4Icon";
import type { WatanyV4IconName } from "./iconRegistry";

export type WatanyV4CompatProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
  title?: string;
  icon?: unknown;
  primaryFill?: string;
  filled?: boolean;
  semantic?: string;
  asset?: WatanyV4IconName;
};

const SEMANTIC_ASSETS: Record<string, WatanyV4IconName> = {
  menu: "most-requested", home: "most-requested", user: "profile", chat: "messages", bell: "notifications",
  close: "most-requested", back: "most-requested", search: "latest", filter: "most-requested", check: "forms",
  warning: "fake-fact", add: "forms", folder: "documents", mic: "voice", stop: "most-requested",
  volume: "voice", calendar: "forms", star: "for-you", document: "documents", people: "users", globe: "network",
  video: "news", trophy: "world-cup",
};

export function WatanyV4Glyph({ size = 24, title, className = "", semantic = "star", asset, ...rest }: WatanyV4CompatProps) {
  const name = asset || SEMANTIC_ASSETS[semantic] || "for-you";
  const dimension = typeof size === "number" ? `${size}px` : size;
  return (
    <WatanyV4Icon
      {...(rest as unknown as ImgHTMLAttributes<HTMLImageElement>)}
      name={name}
      width={dimension}
      height={dimension}
      title={title}
      alt={title || ""}
      className={["watany-v4-control-icon", className].filter(Boolean).join(" ")}
      data-watany-icon-authority="v4"
    />
  );
}
