import { resolveAlias } from './aliasEngine';
import { normalizeAdministrativeText } from './normalize';
import { searchLocalities } from './searchEngine';
import type { AdministrativePlatform, AdministrativeNode, AuthorityDataset, CanonicalLocality, DatasetStatistics, Language } from './types';

export function createAdministrativePlatform(dataset: AuthorityDataset, validation: ReturnType<AdministrativePlatform['validation']>): AdministrativePlatform {
  const allNodes = (): readonly (AdministrativeNode | CanonicalLocality)[] => [...dataset.governorates, ...dataset.districts, ...dataset.municipalities, ...dataset.localities];
  return {
    dataset,
    validation: () => validation,
    governorates: () => dataset.governorates.filter((item) => item.active),
    districts: (governorateId) => dataset.districts.filter((item) => item.active && (!governorateId || item.governorateId === governorateId)),
    municipalities: (districtId) => dataset.municipalities.filter((item) => item.active && (!districtId || item.parentId === districtId)),
    localities: (parentId) => dataset.localities.filter((item) => item.active && (!parentId || item.districtId === parentId || item.municipalityId === parentId)),
    hierarchy: (localityId) => {
      const locality = dataset.localities.find((item) => item.id === localityId) ?? null;
      const municipality = locality?.municipalityId ? dataset.municipalities.find((item) => item.id === locality.municipalityId) ?? null : null;
      const district = locality ? dataset.districts.find((item) => item.id === locality.districtId) ?? null : null;
      const governorate = locality ? dataset.governorates.find((item) => item.id === locality.governorateId) ?? null : null;
      return { governorate, district, municipality, locality };
    },
    lookup: (id) => allNodes().find((item) => item.id === id) ?? null,
    search: (query, options) => searchLocalities(dataset, query, options),
    aliases: () => dataset.aliases.filter((item) => item.active),
    statistics: (): DatasetStatistics => validation.statistics,
  };
}

export { normalizeAdministrativeText, resolveAlias };
