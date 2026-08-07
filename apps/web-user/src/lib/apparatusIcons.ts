export const DEFAULT_APPARATUS_ORIGINS = [
  "الجيش اللبناني",
  "الأمن الداخلي",
  "الأمن العام",
  "أمن الدولة",
  "الجمارك",
] as const;

export type ApparatusLabel = (typeof DEFAULT_APPARATUS_ORIGINS)[number];

export type ApparatusIcon = Readonly<{
  src: string;
  alt: string;
}>;

const APPARATUS_ICON_MAP: Record<string, ApparatusIcon> = {
  "الجيش اللبناني": {
    src: "/assets/recruitment-logos/army.png",
    alt: "شعار الجيش اللبناني",
  },
  "الأمن الداخلي": {
    src: "/assets/recruitment-logos/isf.png",
    alt: "شعار قوى الأمن الداخلي",
  },
  "الأمن العام": {
    src: "/assets/recruitment-logos/general-security.png",
    alt: "شعار الأمن العام",
  },
  "أمن الدولة": {
    src: "/assets/recruitment-logos/state-security.png",
    alt: "شعار أمن الدولة",
  },
  "الجمارك": {
    src: "/assets/recruitment-logos/customs.png",
    alt: "شعار الجمارك اللبنانية",
  },
};

export function normalizeApparatusName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace("قوى الأمن الداخلي", "الأمن الداخلي")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .toLowerCase();
}

export function resolveApparatusIcon(label: string): ApparatusIcon | null {
  const normalizedLabel = normalizeApparatusName(label);
  const entry = Object.entries(APPARATUS_ICON_MAP).find(([candidate]) => normalizeApparatusName(candidate) === normalizedLabel);
  return entry ? entry[1] : null;
}
