import type { AuthorityDataset, DatasetStatistics, ValidationResult } from './types';

const uniqueCount = (values: readonly string[]) => new Set(values).size;
const countMissing = (values: readonly string[]) => values.filter((value) => !value.trim()).length;

export function validateAuthorityDataset(dataset: AuthorityDataset, canonicalSha256: string, aliasSha256: string): ValidationResult {
  const allIds = [...dataset.governorates, ...dataset.districts, ...dataset.municipalities, ...dataset.localities].map((item) => item.id);
  const duplicateIds = allIds.length - uniqueCount(allIds);
  const governorateIds = new Set(dataset.governorates.map((item) => item.id));
  const districtIds = new Set(dataset.districts.map((item) => item.id));
  const municipalityIds = new Set(dataset.municipalities.map((item) => item.id));
  const orphanDistricts = dataset.districts.filter((item) => !governorateIds.has(item.governorateId ?? '')).length;
  const orphanMunicipalities = dataset.municipalities.filter((item) => !districtIds.has(item.parentId ?? '')).length;
  const orphanLocalities = dataset.localities.filter((item) => !governorateIds.has(item.governorateId) || !districtIds.has(item.districtId) || (!!item.municipalityId && !municipalityIds.has(item.municipalityId))).length;
  const orphanRows = orphanDistricts + orphanMunicipalities + orphanLocalities;
  const missingArabic = countMissing(dataset.localities.map((item) => item.nameAr));
  const localitiesWithCoordinates = dataset.localities.filter((item) => typeof item.latitude === 'number' && typeof item.longitude === 'number').length;
  const statistics: DatasetStatistics = { governorates: dataset.governorates.length, districts: dataset.districts.length, municipalities: dataset.municipalities.length, localities: dataset.localities.length, aliases: dataset.aliases.length, localitiesWithCoordinates, missingArabic, duplicateIds, orphanRows };
  const issues: string[] = [];
  if (dataset.manifest.status !== 'approvedCanonical') issues.push('DATASET_NOT_APPROVED');
  if (dataset.manifest.canonicalSha256 !== canonicalSha256) issues.push('CANONICAL_HASH_MISMATCH');
  if (dataset.manifest.aliasSha256 !== aliasSha256) issues.push('ALIAS_HASH_MISMATCH');
  if (duplicateIds > 0) issues.push('DUPLICATE_IDS');
  if (orphanRows > 0) issues.push('ORPHAN_ROWS');
  if (missingArabic > 0) issues.push('MISSING_ARABIC_NAMES');
  if (dataset.localities.length === 0) issues.push('EMPTY_LOCALITY_DATASET');
  if (localitiesWithCoordinates !== dataset.localities.length) issues.push('MISSING_COORDINATES');
  if (dataset.localities.some((item) => item.provenance.length === 0)) issues.push('MISSING_PROVENANCE');
  const structuralIssues = issues.filter((issue) => !['DATASET_NOT_APPROVED', 'MISSING_COORDINATES'].includes(issue));
  const ok = structuralIssues.length === 0;
  const productionReady = ok && dataset.manifest.status === 'approvedCanonical' && localitiesWithCoordinates === dataset.localities.length;
  return { ok, productionReady, status: !ok ? 'INVALID' : productionReady ? 'VERIFIED' : 'PARTIAL', issues, statistics };
}
