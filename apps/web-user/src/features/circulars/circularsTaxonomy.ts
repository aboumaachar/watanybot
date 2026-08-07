export type CircularTaxonomyKey =
  | "security_institutions"
  | "rabita"
  | "veterans"
  | "banque_du_liban"
  | "administrative_memos"
  | "decrees"
  | "laws"
  | "other";

export type CircularTaxonomyEntry = Readonly<{
  key: CircularTaxonomyKey;
  labelAr: string;
  subAuthorities: readonly string[];
}>;

export const CIRCULAR_TAXONOMY: readonly CircularTaxonomyEntry[] = [
  { key: "security_institutions", labelAr: "\u0627\u0644\u0645\u0624\u0633\u0633\u0627\u062a \u0627\u0644\u0623\u0645\u0646\u064a\u0629", subAuthorities: ["LAF", "ISF", "General Security", "State Security", "Customs", "Parliament Police"] },
  { key: "rabita", labelAr: "\u0627\u0644\u0631\u0627\u0628\u0637\u0629", subAuthorities: ["Rabita / League of Lebanese Armed Forces Veterans"] },
  { key: "veterans", labelAr: "\u0627\u0644\u0645\u062d\u0627\u0631\u0628\u0648\u0646 \u0627\u0644\u0642\u062f\u0627\u0645\u0649", subAuthorities: ["Veterans associations", "Veterans unions", "Veterans committees"] },
  { key: "banque_du_liban", labelAr: "\u0645\u0635\u0631\u0641 \u0644\u0628\u0646\u0627\u0646", subAuthorities: ["Banque du Liban", "Basic circulars", "Intermediate circulars", "Financial decisions"] },
  { key: "administrative_memos", labelAr: "\u0627\u0644\u0645\u0630\u0643\u0631\u0627\u062a \u0627\u0644\u0625\u062f\u0627\u0631\u064a\u0629", subAuthorities: ["Ministries", "Public administrations", "Administrative notices"] },
  { key: "decrees", labelAr: "\u0627\u0644\u0645\u0631\u0627\u0633\u064a\u0645", subAuthorities: ["Council of Ministers", "Presidency", "Implementing decrees"] },
  { key: "laws", labelAr: "\u0627\u0644\u0642\u0648\u0627\u0646\u064a\u0646", subAuthorities: ["Parliament", "Amended laws", "Military retirement laws"] },
  { key: "other", labelAr: "\u064a\u062d\u062a\u0627\u062c \u0625\u0644\u0649 \u0645\u0631\u0627\u062c\u0639\u0629", subAuthorities: ["Needs review"] },
] as const;

export const circularTaxonomy = CIRCULAR_TAXONOMY;

export const CIRCULAR_TAXONOMY_KEYS = CIRCULAR_TAXONOMY.map((entry) => entry.key);

export function isCircularTaxonomyKey(value: string): value is CircularTaxonomyKey {
  return (CIRCULAR_TAXONOMY_KEYS as readonly string[]).includes(value);
}

export const circularCategoryLabelByKey: Record<CircularTaxonomyKey, string> = CIRCULAR_TAXONOMY.reduce(
  (labels, entry) => {
    labels[entry.key] = entry.labelAr;
    return labels;
  },
  {} as Record<CircularTaxonomyKey, string>,
);

export function getCircularTaxonomyLabel(key: CircularTaxonomyKey): string {
  return circularCategoryLabelByKey[key] ?? key;
}

// APEX_CIRCULARS_TAXONOMY_COMPAT_START
export function getCircularCategoryLabelAr(category: unknown): string {
  const key = String(category ?? '');
  return circularCategoryLabelByKey[key as keyof typeof circularCategoryLabelByKey] ?? key;
}
// APEX_CIRCULARS_TAXONOMY_COMPAT_END
