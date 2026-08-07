import { normalizeAdministrativeText } from './normalize';
import type { AuthorityDataset, CanonicalAlias, CanonicalLocality, Language } from './types';

export type AliasResolution = Readonly<{ query: string; normalizedQuery: string; localityIds: readonly string[]; ambiguous: boolean }>;

export function resolveAlias(dataset: AuthorityDataset, query: string, language?: Language): AliasResolution {
  const normalizedQuery = normalizeAdministrativeText(query, language);
  const ids = new Set<string>();
  dataset.aliases.filter((alias) => alias.active && normalizeAdministrativeText(alias.value, alias.language) === normalizedQuery).forEach((alias) => ids.add(alias.localityId));
  dataset.localities.filter((locality) => [locality.nameAr, locality.nameEn, locality.nameFr, ...locality.aliases].filter(Boolean).some((value) => normalizeAdministrativeText(String(value), language) === normalizedQuery)).forEach((locality) => ids.add(locality.id));
  return { query, normalizedQuery, localityIds: [...ids], ambiguous: ids.size > 1 };
}

export function aliasesForLocality(dataset: AuthorityDataset, localityId: string): readonly CanonicalAlias[] {
  return dataset.aliases.filter((alias) => alias.active && alias.localityId === localityId);
}

export function buildAliasIndex(dataset: AuthorityDataset): ReadonlyMap<string, readonly string[]> {
  const index = new Map<string, string[]>();
  const add = (value: string, localityId: string, language?: Language) => {
    const key = normalizeAdministrativeText(value, language);
    if (!key) return;
    const ids = index.get(key) ?? [];
    if (!ids.includes(localityId)) ids.push(localityId);
    index.set(key, ids);
  };
  dataset.aliases.forEach((alias) => alias.active && add(alias.value, alias.localityId, alias.language));
  dataset.localities.forEach((locality) => [locality.nameAr, locality.nameEn, locality.nameFr, ...locality.aliases].filter(Boolean).forEach((value) => add(String(value), locality.id)));
  return index;
}
