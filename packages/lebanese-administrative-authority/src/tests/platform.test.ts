import { describe, expect, it } from 'vitest';
import { resolveAlias } from '../aliasEngine';
import { createAdministrativePlatform } from '../platform';
import { validateAuthorityDataset } from '../validation';
import type { AuthorityDataset } from '../types';

const provenance = [{ sourceId: 'fixture', publisher: 'UL2 test fixture', title: 'Synthetic test only', retrievedAt: '2026-08-06', recordReference: 'fixture-1', authorityLevel: 'secondary' as const }];
const dataset: AuthorityDataset = {
  manifest: { datasetId: 'fixture', version: '0.0.0-test', schemaVersion: '1.0.0', status: 'candidate', canonicalSha256: 'canonical', aliasSha256: 'aliases', releasedAt: null, approval: { approvedBy: [], approvedAt: null, decisionReference: null }, sources: provenance, statistics: { governorates: 1, districts: 1, municipalities: 1, localities: 1, aliases: 1, localitiesWithCoordinates: 1, missingArabic: 0, duplicateIds: 0, orphanRows: 0 } },
  governorates: [{ id: 'LB-G-TEST', code: 'TEST', nameAr: 'محافظة اختبار', nameEn: 'Test Governorate', aliases: [], provenance, active: true }],
  districts: [{ id: 'LB-D-TEST', code: 'TEST-D', governorateId: 'LB-G-TEST', nameAr: 'قضاء اختبار', nameEn: 'Test District', aliases: [], provenance, active: true }],
  municipalities: [{ id: 'LB-M-TEST', code: 'TEST-M', parentId: 'LB-D-TEST', nameAr: 'بلدية اختبار', nameEn: 'Test Municipality', aliases: [], provenance, active: true }],
  localities: [{ id: 'LB-L-TEST', countryCode: 'LB', governorateId: 'LB-G-TEST', districtId: 'LB-D-TEST', municipalityId: 'LB-M-TEST', nameAr: 'اختبار', nameEn: 'Ikhtibar', nameFr: 'Test', kind: 'village', latitude: 33.9, longitude: 35.5, aliases: ['ikhtibar'], provenance, sourceRecordId: 'fixture-1', active: true }],
  aliases: [{ id: 'LB-A-TEST', value: 'ikhtibar', normalizedValue: 'ikhtibar', language: 'en', localityId: 'LB-L-TEST', provenance, active: true }],
};

const validation = validateAuthorityDataset(dataset, 'canonical', 'aliases');

describe('UL2 administrative platform', () => {
  it('keeps candidate fixtures out of production readiness', () => {
    expect(validation.productionReady).toBe(false);
    expect(validation.issues).toContain('DATASET_NOT_APPROVED');
  });

  it('resolves aliases to a stable locality ID', () => {
    expect(resolveAlias(dataset, 'ikhtibar', 'en').localityIds).toEqual(['LB-L-TEST']);
  });

  it('provides hierarchy and search through one platform', () => {
    const platform = createAdministrativePlatform(dataset, validation);
    expect(platform.search('اختبار', { mode: 'exact' })[0]?.id).toBe('LB-L-TEST');
    expect(platform.hierarchy('LB-L-TEST').municipality?.id).toBe('LB-M-TEST');
    expect(platform.municipalities('LB-D-TEST')[0]?.id).toBe('LB-M-TEST');
  });
});
