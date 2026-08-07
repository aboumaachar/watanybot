import type { ImgHTMLAttributes } from "react";
import { WATANY_V4_ICONS, type WatanyV4IconName } from "./iconRegistry";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { name: WatanyV4IconName };

export function WatanyV4Icon({ name, className = "", alt = "", ...rest }: Props) {
  return <img {...rest} src={WATANY_V4_ICONS[name]} alt={alt} className={["watany-v4-icon", className].filter(Boolean).join(" ")} />;
}
