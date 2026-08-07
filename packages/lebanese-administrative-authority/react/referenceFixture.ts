import { createAdministrativePlatform } from '../src/platform';
import type { AdministrativePlatform, AuthorityDataset, ValidationResult } from '../src/types';

const provenance = [{ sourceId: 'SRC-ADDRESS-NETWORK-GOV', publisher: 'WatanyBot', title: 'Repository address network reference', retrievedAt: '2026-08-06', recordReference: 'reference-fixture', authorityLevel: 'secondary' as const }];
const names = [['BEY', 'Beirut'], ['MLB', 'Mount Lebanon'], ['NLB', 'North Lebanon'], ['AKK', 'Akkar'], ['BEQ', 'Bekaa'], ['BHB', 'Baalbek-Hermel'], ['SLB', 'South Lebanon'], ['NAB', 'Nabatieh']] as const;
const governorates = names.map(([code, nameEn]) => ({ id: `LB-GOV-${code}`, code, nameAr: '', nameEn, aliases: [], provenance, active: true }));
const districts = names.map(([code, nameEn]) => ({ id: `LB-DIST-${code}`, code: `${code}-REFERENCE`, governorateId: `LB-GOV-${code}`, parentId: `LB-GOV-${code}`, nameAr: '', nameEn: code === 'BEY' ? 'Beirut' : nameEn, aliases: [], provenance, active: true }));
const localities = names.slice(0, 4).map(([code, nameEn]) => ({ id: `LB-LOC-REFERENCE-${code}`, countryCode: 'LB' as const, governorateId: `LB-GOV-${code}`, districtId: `LB-DIST-${code}`, municipalityId: null, nameAr: '', nameEn, nameFr: null, kind: 'populated-place' as const, latitude: null, longitude: null, aliases: [], provenance, sourceRecordId: `reference-${code}`, active: true }));
const dataset: AuthorityDataset = { manifest: { datasetId: 'ul2a-reference-fixture', version: '0.0.0-reference', schemaVersion: '1.0.0', status: 'validation-failed', canonicalSha256: 'reference', aliasSha256: 'reference', releasedAt: null, approval: { approvedBy: [], approvedAt: null, decisionReference: null }, sources: provenance, statistics: { governorates: 8, districts: 8, municipalities: 0, localities: 4, aliases: 0, localitiesWithCoordinates: 0, missingArabic: 4, duplicateIds: 0, orphanRows: 0 } }, governorates, districts, municipalities: [], localities, aliases: [] };
const validation: ValidationResult = { ok: false, productionReady: false, status: 'PARTIAL', issues: ['REFERENCE_FIXTURE_NOT_RUNTIME', 'MISSING_ARABIC_NAMES', 'MISSING_COORDINATES'], statistics: dataset.manifest.statistics };

export function createReferenceInteractionPlatform(): AdministrativePlatform { return createAdministrativePlatform(dataset, validation); }
