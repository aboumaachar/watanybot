import { SERVICE_CATEGORIES } from "./service-catalog";

export type RabitaLegalReference = {
  categoryLabel: string;
  title: string;
  listingPathAr: string;
  manifest: string;
  documents: Array<{ id: string; titleAr: string }>;
};

export function getRabitaLegalReference(): RabitaLegalReference | null {
  const category = SERVICE_CATEGORIES.find((entry) => entry.id === "laws-regulations");
  const tile = category?.tiles.find((entry) => entry.id === "rabita");

  if (!category || !tile?.manifest || !tile.documents?.length) {
    return null;
  }

  return {
    categoryLabel: category.label,
    title: tile.label,
    listingPathAr: tile.listingPathAr ?? `${category.label} > ${tile.label}`,
    manifest: tile.manifest,
    documents: tile.documents,
  };
}