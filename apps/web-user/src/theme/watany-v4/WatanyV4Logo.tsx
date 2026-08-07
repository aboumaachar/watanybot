import type { ImgHTMLAttributes } from "react";
import { WATANY_V4_LOGO_PATH } from "./iconRegistry";

export function WatanyV4Logo(props: ImgHTMLAttributes<HTMLImageElement>) {
  const { className = "", alt = "Mowatany", ...rest } = props;
  return <img {...rest} src={WATANY_V4_LOGO_PATH} alt={alt} className={["watany-v4-logo", className].filter(Boolean).join(" ")} />;
}
