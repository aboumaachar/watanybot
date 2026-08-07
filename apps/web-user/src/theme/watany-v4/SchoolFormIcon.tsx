import type { ImgHTMLAttributes } from "react";
import { getSchoolFormIcon, type SchoolFormIconName } from "./schoolFormIconRegistry";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { name: SchoolFormIconName };

export function SchoolFormIcon({ name, className = "", alt = "", ...rest }: Props) {
  const icon = getSchoolFormIcon(name);
  return <img {...rest} src={icon.path} alt={alt} className={["watany-v4-icon", className].filter(Boolean).join(" ")} />;
}