import { buildAliasIndex } from './aliasEngine';
import { normalizeAdministrativeText } from './normalize';
import type { AuthorityDataset, CanonicalLocality, Language } from './types';

export function searchLocalities(dataset: AuthorityDataset, query: string, options: Readonly<{ mode?: 'exact' | 'prefix' | 'contains'; language?: Language }> = {}): readonly CanonicalLocality[] {
  const needle = normalizeAdministrativeText(query, options.language);
  if (!needle) return [];
  const mode = options.mode ?? 'contains';
  const index = buildAliasIndex(dataset);
  const matches = dataset.localities.filter((locality) => {
    const values = [locality.nameAr, locality.nameEn, locality.nameFr, ...locality.aliases].filter(Boolean).map((value) => normalizeAdministrativeText(String(value), options.language));
    const aliasIds = index.get(needle) ?? [];
    if (mode === 'exact') return aliasIds.includes(locality.id) || values.includes(needle);
    return values.some((value) => mode === 'prefix' ? value.startsWith(needle) : value.includes(needle)) || aliasIds.includes(locality.id);
  });
  return [...matches].sort((left, right) => left.nameAr.localeCompare(right.nameAr, 'ar') || left.id.localeCompare(right.id));
}
