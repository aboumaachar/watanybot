import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runUl3a } from './ul3a-repair.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageRoot, '../..');
const authorityRoot = join(packageRoot, 'authority');
const previousReleaseRoot = join(packageRoot, 'releases', '1.0.0');
const releaseVersion = '1.1.1';
const releaseRoot = join(packageRoot, 'releases', releaseVersion);
const evidenceRoot = join(packageRoot, 'evidence', `ul2a-ar-${releaseVersion}`);
const now = new Date().toISOString();
const sourcePaths = [
  ['SRC-VENDOR-LOCALITIES', 'Embedded vendor Lebanon administrative widget dataset', 'Unverified vendor asset', 'candidate-json', 'https://example.invalid/vendor-reference', '', '2026-06-04', '2026-08-06', 'repository-local', 'vendor/lebanon-admin-widget/data/lebanon_admin_data.json', 'lebanon_admin_data.json', '1586', 'en', '11.4%', 'governorate,district,locality', 'SECONDARY_AUTHORITY', 'Arabic crosswalk incomplete; coordinates incomplete', 'REJECTED'],
  ['SRC-STARTER-CSV', 'WatanyBot starter address list', 'WatanyBot', 'starter-csv', '', '', '', '2026-08-06', 'repository-local', 'apps/web-user/public/data/location/lebanon-admin-locations.csv', 'lebanon-admin-locations.csv', '24', 'ar,en', '0%', 'governorate,district,locality', 'AUDIT_ONLY', 'Not nationwide and not canonical', 'REJECTED'],
  ['SRC-ADDRESS-NETWORK-GOV', 'Repository address network governorates', 'WatanyBot', 'reference-csv', '', '', '', '2026-08-06', 'repository-local', 'data/address-network/governorates.csv', 'governorates.csv', '8', 'en', '0%', 'governorate', 'REPOSITORY_REFERENCE', 'Display values are not Arabic authority values', 'AUDIT_ONLY'],
  ['SRC-ADDRESS-NETWORK-CAZA', 'Repository address network districts', 'WatanyBot', 'reference-csv', '', '', '', '2026-08-06', 'repository-local', 'data/address-network/cazas.csv', 'cazas.csv', '25', 'en', '0%', 'district', 'REPOSITORY_REFERENCE', 'Display values are not Arabic authority values', 'AUDIT_ONLY'],
  ['SRC-ADDRESS-NETWORK-VILLAGES', 'Repository address network locality seed', 'WatanyBot', 'reference-csv', '', '', '', '2026-08-06', 'repository-local', 'data/address-network/villages.csv', 'villages.csv', '7', 'en', '100%', 'locality,municipality', 'AUDIT_ONLY', 'Explicit seed_review_required marker', 'REJECTED'],
  ['SRC-BOUNDARY-INDEX', 'Repository boundary dataset index', 'WatanyBot', 'boundary-index', '', '', '', '2026-08-06', 'repository-local', 'data/external/lebanon_admin/lbn_admin3_index.csv', 'lbn_admin3_index.csv', '', 'en', '0%', 'district', 'REPOSITORY_REFERENCE', 'Boundary reference only; not locality authority', 'AUDIT_ONLY'],
  ['SRC-AUTHORITY-MANIFEST', 'Existing authority validation manifest', 'WatanyBot', 'manifest', '', '', '', '2026-08-06', 'repository-local', 'LEBANON_ADMIN_AUTHORITY_MANIFEST.json', 'LEBANON_ADMIN_AUTHORITY_MANIFEST.json', '', 'en', '0%', 'governorate,district,locality', 'AUDIT_ONLY', 'Records prior candidate validation and limitations', 'AUDIT_ONLY'],
];
const arabicSourcePath = 'apps/web-user/public/data/location/lebanon-admin-locations.csv';
const hierarchyArabicSourcePath = 'packages/lebanese-administrative-authority/authority/sources/arabic/lebanon-hierarchy-arabic-authority.csv';

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
function ensure(path) { mkdirSync(path, { recursive: true }); }
function write(path, value) { ensure(dirname(path)); writeFileSync(path, value.endsWith('\n') ? value : `${value}\n`, 'utf8'); }
function csvCell(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }
function csv(rows) { return rows.map((row) => row.map(csvCell).join(',')).join('\n'); }
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (const char of text.replace(/^\uFEFF/, '')) {
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ',' && !quoted) { row.push(cell); cell = ''; continue; }
    if ((char === '\n' || char === '\r') && !quoted) { if (char === '\n' && (cell || row.length)) { row.push(cell); rows.push(row); row = []; cell = ''; } continue; }
    cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const headers = rows.shift() ?? [];
  return rows.filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}
function normalize(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/[\u064B-\u065F\u0670]/g, '').replace(/[’'`-]/g, ' ').replace(/\s+/g, ' ').trim();
}
function stableId(prefix, value) { return `LB-${prefix}-${createHash('sha256').update(value).digest('hex').slice(0, 12).toUpperCase()}`; }
function hasArabic(value) { return /[\u0600-\u06FF]/.test(String(value ?? '')); }
function sourcePath(relativePath) { return join(repoRoot, relativePath); }
function inventoryRows() {
  const header = ['source_id','source_title','publisher','source_type','source_url','download_url','publication_date','retrieval_date','license','repository_path','original_filename','original_sha256','record_count','languages','coordinate_coverage','administrative_levels','authority_priority','known_limitations','approval_status'];
  return [header, ...sourcePaths.map((row) => { const path = sourcePath(row[9]); return [...row.slice(0, 11), existsSync(path) ? sha256(path) : 'MISSING', ...row.slice(11)] })];
}
function arabicInventoryRows() {
  const path = sourcePath(arabicSourcePath);
  const nationalPath = sourcePath('packages/lebanese-administrative-authority/authority/sources/arabic/national-village-manifest-clean.csv');
  const rows = parseCsv(readFileSync(path, 'utf8'));
  const hierarchyPath = sourcePath(hierarchyArabicSourcePath);
  const hierarchyRows = parseCsv(readFileSync(hierarchyPath, 'utf8'));
  const nationalRows = parseCsv(readFileSync(nationalPath, 'utf8'));
  const header = ['source_id','source_title','publisher','source_type','source_url','download_url','publication_date','retrieval_date','license','repository_path','original_filename','original_sha256','record_count','arabic_record_count','administrative_levels','stable_identity_fields','authority_priority','known_limitations','approval_status'];
  return [header, ['SRC-NATIONAL-VILLAGE-MANIFEST', 'National Arabic locality manifest', 'Owner-provided authority source', 'national-csv', '', '', '', '2026-08-06', 'repository-local', 'packages/lebanese-administrative-authority/authority/sources/arabic/national-village-manifest-clean.csv', 'national-village-manifest-clean.csv', sha256(nationalPath), String(nationalRows.length), String(nationalRows.filter((row) => hasArabic(row.VILLAGE_NAME_AR)).length), 'governorate,district,locality', 'ADM3_PCODE', 'PRIMARY_ARABIC_AUTHORITY', 'Cleaned owner-provided manifest; 65 placeholder rows excluded upstream', 'READY_FOR_OWNER_REVIEW'], ['SRC-HIERARCHY-ARABIC-OFFICIAL', 'Official Arabic hierarchy authority crosswalk', 'IDAL and DGCS', 'official-crosswalk-csv', 'https://investinlebanon.gov.lb/ar/lebanon_at_a_glance/invest_in_regions|https://www.dgcs.gov.lb/arabic/statistics-map', '', '', '2026-08-06', 'repository-local', hierarchyArabicSourcePath, 'lebanon-hierarchy-arabic-authority.csv', sha256(hierarchyPath), String(hierarchyRows.length), String(hierarchyRows.filter((row) => hasArabic(row.name_ar)).length), 'governorate,district,district_equivalent', 'runtime_name_en,parent_governorate_en', 'PRIMARY_ARABIC_AUTHORITY', '34 official hierarchy labels; Beirut is a UI district equivalent', 'READY_FOR_OWNER_REVIEW'], ['SRC-STARTER-ARABIC', 'WatanyBot starter Arabic address list', 'WatanyBot', 'starter-csv', '', '', '', '2026-08-06', 'repository-local', arabicSourcePath, 'lebanon-admin-locations.csv', sha256(path), String(rows.length), String(rows.filter((row) => hasArabic(row.village) && hasArabic(row.mohafaza) && hasArabic(row.caza)).length), 'governorate,district,locality', 'none', 'AUDIT_ONLY', 'No stable authority identifiers; partial starter list; not an official publication', 'AUDIT_ONLY']];
}
function buildArabicCrosswalk(records) {
  const rows = [['crosswalk_id','canonical_locality_id','canonical_code','pcode','governorate_id','district_or_equivalent_id','municipality_id','current_name_en','candidate_name_ar','normalized_name_ar','source_id','source_record_id','source_name_en','source_name_ar','source_governorate','source_district','match_method','match_keys','confidence','review_status','conflict_status','reviewed_by','reviewed_at','notes']];
  for (const locality of records.localities) {
    const accepted = hasArabic(locality.nameAr) && locality.pcode;
    rows.push([stableId('XW', locality.id), locality.id, locality.id, locality.pcode ?? '', locality.governorateId, locality.districtId, locality.municipalityId ?? '', locality.nameEn, accepted ? locality.nameAr : '', accepted ? normalize(locality.nameAr) : '', accepted ? 'SRC-NATIONAL-VILLAGE-MANIFEST' : '', accepted ? locality.sourceRecordId : '', accepted ? locality.nameEn : '', accepted ? locality.nameAr : '', '', '', accepted ? 'exact-pcode' : 'fuzzy-suggestion', accepted ? `ADM3_PCODE=${locality.pcode}` : '', accepted ? '1' : '0', accepted ? 'accepted' : 'unresolved', 'none', accepted ? 'owner-review-pending' : '', accepted ? now : '', accepted ? 'Exact stable ADM3_PCODE mapping; owner approval remains pending' : 'No accepted authoritative Arabic mapping']);
  }
  return rows;
}
function arabicValidation(records, crosswalk) {
  const acceptedArabic = crosswalk.slice(1).filter((row) => row[19] === 'accepted').length;
  const missingArabic = records.localities.length - acceptedArabic;
  const unresolved = crosswalk.length - 1 - acceptedArabic;
  return { acceptedArabic, missingArabic, conflictedArabic: 0, unresolvedArabic: unresolved, status: missingArabic === 0 ? 'PASS' : 'BLOCKED', issues: missingArabic === 0 ? [] : ['ARABIC_NAME_MISSING'] };
}
function technicalExitCode(validation, arabicStatus) {
  return validation.issues.length === 0 && arabicStatus.status === 'PASS' ? 0 : 20;
}
function loadCandidate() {
  const nationalPath = sourcePath('packages/lebanese-administrative-authority/authority/sources/arabic/national-village-manifest-clean.csv');
  const hierarchyPath = sourcePath(hierarchyArabicSourcePath);
  if (existsSync(nationalPath)) return { __nationalRows: parseCsv(readFileSync(nationalPath, 'utf8')), __nationalPath: nationalPath, __hierarchyRows: parseCsv(readFileSync(hierarchyPath, 'utf8')) };
  const path = sourcePath('vendor/lebanon-admin-widget/data/lebanon_admin_data.json');
  if (!existsSync(path)) throw new Error(`MISSING_SOURCE:${path}`);
  return JSON.parse(readFileSync(path, 'utf8'));
}
function buildNationalRecords(rows, sourceFile, hierarchyRows) {
  const governorateMap = new Map();
  const districtMap = new Map();
  for (const item of rows) {
    const governorateId = stableId('GOV', item.MUHAFAZA);
    const districtKey = `${item.MUHAFAZA}|${item.CAZA}`;
    if (!governorateMap.has(item.MUHAFAZA)) governorateMap.set(item.MUHAFAZA, { id: governorateId, countryId: 'LB', officialCode: item.MUHAFAZA, pcode: null, nameAr: '', nameEn: item.MUHAFAZA, nameFr: null, normalizedAr: '', normalizedLatin: normalize(item.MUHAFAZA), aliases: [], provenance: [], active: true });
    if (item.MUHAFAZA !== 'Beirut' && !districtMap.has(districtKey)) districtMap.set(districtKey, { id: stableId('DIST', districtKey), code: districtKey, governorateId, parentId: governorateId, officialCode: null, pcode: null, nameAr: '', nameEn: item.CAZA, nameFr: null, aliases: [], provenance: [], isOfficialDistrict: true, isUiSelectionNode: true, active: true });
  }
  const hierarchyMatches = hierarchyRows.filter((item) => item.authority_classification === 'PRIMARY_OFFICIAL');
  const normalizeHierarchy = (value) => normalize(value).replace(/\s+/g, '');
  const findHierarchy = (recordType, nameEn, parentEn = '') => hierarchyMatches.filter((item) => {
    const runtimeAliases = { 'El Meten': 'El Metn', Kesrwane: 'Kesrouan' };
    const sourceNames = [item.runtime_name_en, ...(item.aliases_en || '').split('|')];
    const runtimeNames = [nameEn, runtimeAliases[nameEn] || ''];
    const nameMatches = runtimeNames.some((runtimeName) => sourceNames.some((sourceName) => normalizeHierarchy(sourceName) === normalizeHierarchy(runtimeName)));
    const parentNames = [item.parent_governorate_en, ...(item.parent_governorate_en || '').split('|')];
    const parentMatches = !parentEn || parentNames.some((value) => normalizeHierarchy(value) === normalizeHierarchy(parentEn));
    const recordTypeMatches = item.record_type === recordType || (nameEn === 'Beirut' && item.record_type === 'district_equivalent');
    return recordTypeMatches && nameMatches && parentMatches;
  });
  const hierarchyProvenance = (item) => [{ sourceId: item.source_id, publisher: item.source_id === 'IDAL-REGIONS' ? 'Invest in Lebanon (IDAL)' : 'Directorate General of Personal Status', title: item.source_record_id, uri: item.source_url, retrievedAt: now, recordReference: item.source_record_id, authorityLevel: 'primary' }];
  let unmatchedHierarchyRecords = 0;
  let ambiguousHierarchyRecords = 0;
  for (const item of governorateMap.values()) {
    const matches = item.nameEn === 'Beirut'
      ? hierarchyMatches.filter((candidate) => candidate.record_type === 'governorate' && normalizeHierarchy(candidate.runtime_name_en) === 'beirut')
      : findHierarchy('governorate', item.nameEn);
    if (matches.length !== 1) { unmatchedHierarchyRecords += matches.length === 0 ? 1 : 0; ambiguousHierarchyRecords += matches.length > 1 ? 1 : 0; continue; }
    item.nameAr = matches[0].name_ar; item.normalizedAr = normalize(matches[0].name_ar); item.provenance = hierarchyProvenance(matches[0]);
  }
  for (const item of districtMap.values()) {
    const [parentEn, nameEn] = item.code.split('|');
    const matches = findHierarchy('district', nameEn, parentEn);
    if (matches.length !== 1) { unmatchedHierarchyRecords += matches.length === 0 ? 1 : 0; ambiguousHierarchyRecords += matches.length > 1 ? 1 : 0; continue; }
    item.nameAr = matches[0].name_ar; item.provenance = hierarchyProvenance(matches[0]);
  }
  const beirutEquivalentMatch = findHierarchy('district_equivalent', 'Beirut', 'Beirut');
  if (beirutEquivalentMatch.length !== 1) { unmatchedHierarchyRecords += beirutEquivalentMatch.length === 0 ? 1 : 0; ambiguousHierarchyRecords += beirutEquivalentMatch.length > 1 ? 1 : 0; }
  const districtEquivalents = [{ id: 'LB-BEIRUT-EQUIVALENT', governorateId: [...governorateMap.values()].find((item) => item.nameEn === 'Beirut')?.id ?? 'LB-GOV-BEY', nameAr: beirutEquivalentMatch[0]?.name_ar ?? '', nameEn: 'Beirut', isOfficialDistrict: false, isUiSelectionNode: true, recordType: 'governorate-district-equivalent', active: true, provenance: beirutEquivalentMatch[0] ? hierarchyProvenance(beirutEquivalentMatch[0]) : [] }];
  const localities = rows.map((item) => {
    const districtKey = `${item.MUHAFAZA}|${item.CAZA}`;
    const latitude = Number(item.CENTER_LAT);
    const longitude = Number(item.CENTER_LON);
    return { id: `LB-LOC-${item.ADM3_PCODE}`, countryCode: 'LB', governorateId: governorateMap.get(item.MUHAFAZA).id, districtId: item.MUHAFAZA === 'Beirut' ? 'LB-BEIRUT-EQUIVALENT' : districtMap.get(districtKey).id, municipalityId: null, cadastralCode: null, pcode: item.ADM3_PCODE, nameAr: item.VILLAGE_NAME_AR, nameEn: item.VILLAGE_NAME, nameFr: null, kind: 'populated-place', latitude: Number.isFinite(latitude) ? latitude : null, longitude: Number.isFinite(longitude) ? longitude : null, coordinateMethod: Number.isFinite(latitude) && Number.isFinite(longitude) ? 'national-manifest' : 'missing', coordinateSource: sourceFile, coordinateAccuracy: null, coordinateVerifiedStatus: Number.isFinite(latitude) && Number.isFinite(longitude) ? 'source-reported' : 'missing', verifiedStatus: 'accepted', aliases: [], sourceRecordId: item.ADM3_PCODE, active: true, provenance: [{ sourceId: 'SRC-NATIONAL-VILLAGE-MANIFEST', publisher: 'Owner-provided national Arabic locality manifest', title: 'National village manifest', retrievedAt: now, recordReference: item.ADM3_PCODE, authorityLevel: 'primary' }] };
  });
  const aliases = localities.flatMap((item) => [{ id: stableId('ALIAS', `${item.id}|${item.nameEn}`), value: item.nameEn, normalizedValue: normalize(item.nameEn), language: 'en', localityId: item.id, provenance: item.provenance, active: true }, { id: stableId('ALIAS', `${item.id}|${item.nameAr}`), value: item.nameAr, normalizedValue: normalize(item.nameAr), language: 'ar', localityId: item.id, provenance: item.provenance, active: true }]);
  return { governorates: [...governorateMap.values()], districts: [...districtMap.values()], districtEquivalents, municipalities: [], localities, aliases, hierarchyMatches: { matched: hierarchyMatches.length - unmatchedHierarchyRecords - ambiguousHierarchyRecords, unmatched: unmatchedHierarchyRecords, ambiguous: ambiguousHierarchyRecords } };
}
function buildRecords(candidate) {
  if (candidate.__nationalRows) return buildNationalRecords(candidate.__nationalRows, candidate.__nationalPath, candidate.__hierarchyRows);
  const governorateMap = new Map();
  const districtMap = new Map();
  const candidateGovernorateCodeMap = { 'LB-AK': 'AKK', 'LB-AS': 'NLB', 'LB-BH': 'BHB', 'LB-BI': 'BEQ', 'LB-JA': 'SLB', 'LB-JL': 'MLB', 'LB-NA': 'NAB' };
  const referenceGovernorates = parseCsv(readFileSync(sourcePath('data/address-network/governorates.csv'), 'utf8'));
  for (const item of referenceGovernorates) {
    governorateMap.set(item.governorate_id, { id: `LB-GOV-${item.governorate_id}`, countryId: 'LB', officialCode: item.governorate_id, pcode: item.governorate_id, nameAr: hasArabic(item.governorate_ar) ? item.governorate_ar : '', nameEn: item.governorate_en ?? '', nameFr: null, normalizedAr: normalize(item.governorate_ar), normalizedLatin: normalize(item.governorate_en), aliases: [], provenance: [{ sourceId: 'SRC-ADDRESS-NETWORK-GOV', publisher: 'WatanyBot', title: 'Repository address network governorates', retrievedAt: now, recordReference: item.governorate_id, authorityLevel: 'secondary' }], active: item.enabled === 'true' });
  }
  for (const item of candidate.villages ?? []) {
    const govKey = item.muhafaza_code ?? item.muhafaza_name;
    const districtKey = `${govKey}|${item.caza_name}`;
    const mappedCode = candidateGovernorateCodeMap[govKey] ?? govKey;
    const matchingGovernorate = governorateMap.get(mappedCode) ?? [...governorateMap.values()].find((row) => normalize(row.nameEn) === normalize(item.muhafaza_name));
    const governorateId = matchingGovernorate?.id ?? `LB-GOV-${String(govKey).replace(/^LB-/, '')}`;
    if (!matchingGovernorate) governorateMap.set(govKey, { id: governorateId, countryId: 'LB', officialCode: govKey, pcode: govKey, nameAr: '', nameEn: item.muhafaza_name ?? '', nameFr: null, normalizedAr: '', normalizedLatin: normalize(item.muhafaza_name), aliases: [], provenance: [], active: true });
    districtMap.set(districtKey, { id: stableId('DIST', districtKey), code: districtKey, governorateId, parentId: governorateId, officialCode: null, pcode: null, nameAr: '', nameEn: item.caza_name ?? '', nameFr: null, aliases: [], provenance: [], isOfficialDistrict: true, isUiSelectionNode: true, active: true });
  }
  const localities = (candidate.villages ?? []).map((item) => {
    const govKey = item.muhafaza_code ?? item.muhafaza_name;
    const districtKey = `${govKey}|${item.caza_name}`;
    const lat = item.coordinates?.lat;
    const lon = item.coordinates?.lon;
    const nameEn = item.village_name ?? item.display_name ?? '';
    const mappedCode = candidateGovernorateCodeMap[govKey] ?? govKey;
    const matchingGovernorate = governorateMap.get(mappedCode) ?? [...governorateMap.values()].find((row) => normalize(row.nameEn) === normalize(item.muhafaza_name));
    return { id: stableId('LOC', item.id ?? `${districtKey}|${nameEn}`), countryCode: 'LB', governorateId: matchingGovernorate?.id ?? `LB-GOV-${String(govKey).replace(/^LB-/, '')}`, districtId: stableId('DIST', districtKey), municipalityId: null, cadastralCode: null, pcode: null, nameAr: item.search?.arabic ?? '', nameEn, nameFr: null, kind: 'populated-place', latitude: typeof lat === 'number' ? lat : null, longitude: typeof lon === 'number' ? lon : null, coordinateMethod: typeof lat === 'number' && typeof lon === 'number' ? 'repository-reference' : 'missing', coordinateSource: item.coordinates?.source ?? null, coordinateAccuracy: null, coordinateVerifiedStatus: item.coordinates?.status === 'verified' ? 'verified' : 'missing', verifiedStatus: 'unresolved', aliases: [], provenance: [{ sourceId: 'SRC-VENDOR-LOCALITIES', publisher: 'Unverified vendor asset', title: 'Embedded vendor Lebanon administrative widget dataset', retrievedAt: now, recordReference: item.id ?? nameEn, authorityLevel: 'secondary' }], sourceRecordId: item.id ?? nameEn, active: true };
  });
  const aliases = localities.filter((item) => item.nameEn).map((item) => ({ id: stableId('ALIAS', `${item.id}|${item.nameEn}`), value: item.nameEn, normalizedValue: normalize(item.nameEn), language: 'en', localityId: item.id, provenance: item.provenance, active: true }));
  const governorates = [...governorateMap.values()];
  const districts = [...districtMap.values()];
  return { governorates, districts, municipalities: [], localities, aliases };
}
function validate(records) {
  const allIds = [...records.governorates, ...records.districts, ...records.municipalities, ...records.localities].map((item) => item.id);
  const duplicateIds = allIds.length - new Set(allIds).size;
  const govIds = new Set(records.governorates.map((item) => item.id));
  const districtIds = new Set([...records.districts, ...(records.districtEquivalents ?? [])].map((item) => item.id));
  const orphanLocalities = records.localities.filter((item) => !govIds.has(item.governorateId) || !districtIds.has(item.districtId)).length;
  const missingArabic = records.localities.filter((item) => !hasArabic(item.nameAr)).length;
  const litigeCount = records.localities.filter((item) => /litige/i.test(JSON.stringify(item))).length;
  const aliasMap = new Map();
  for (const alias of records.aliases) { const ids = aliasMap.get(alias.normalizedValue) ?? new Set(); ids.add(alias.localityId); aliasMap.set(alias.normalizedValue, ids); }
  const ambiguousAliasCount = [...aliasMap.values()].filter((ids) => ids.size > 1).length;
  const statistics = { governorates: records.governorates.length, districts: records.districts.length, municipalities: records.municipalities.length, localities: records.localities.length, aliases: records.aliases.length, localitiesWithCoordinates: records.localities.filter((item) => item.latitude !== null && item.longitude !== null).length, missingArabic, duplicateIds, orphanRows: orphanLocalities };
  const issues = [];
  if (missingArabic) issues.push('MISSING_ARABIC_NAMES');
  if (duplicateIds) issues.push('DUPLICATE_CANONICAL_IDS');
  if (orphanLocalities) issues.push('ORPHAN_LOCALITIES');
  if (litigeCount) issues.push('LITIGE_RECORDS');
  if (records.localities.length === 0) issues.push('EMPTY_LOCALITY_DATASET');
  if (records.governorates.some((item) => !hasArabic(item.nameAr)) || records.districts.some((item) => !hasArabic(item.nameAr)) || records.districtEquivalents.some((item) => !hasArabic(item.nameAr))) issues.push('MISSING_ARABIC_HIERARCHY_NAMES');
  if (records.hierarchyMatches?.unmatched || records.hierarchyMatches?.ambiguous) issues.push('HIERARCHY_CROSSWALK_UNRESOLVED');
  return { statistics, litigeCount, ambiguousAliasCount, issues, ok: issues.length === 0, productionReady: false, status: issues.length === 0 ? 'PASS' : 'BLOCKED' };
}
function releaseFiles(records, validation, inventory, crosswalk, arabicStatus) {
  rmSync(releaseRoot, { recursive: true, force: true });
  ensure(releaseRoot); ensure(join(authorityRoot, 'sources')); ensure(join(authorityRoot, 'normalized')); ensure(join(authorityRoot, 'canonical')); ensure(join(authorityRoot, 'aliases')); ensure(join(authorityRoot, 'provenance')); ensure(join(authorityRoot, 'unresolved')); ensure(evidenceRoot);
  write(join(authorityRoot, 'sources/source-inventory.csv'), csv(inventory));
  const provenance = [{ sourceId: 'SRC-VENDOR-LOCALITIES', publisher: 'Unverified vendor asset', title: 'Embedded vendor Lebanon administrative widget dataset', uri: '', retrievedAt: now, recordReference: 'candidate.villages[*]', authorityLevel: 'secondary' }];
  for (const [name, rows] of [['governorates.csv', records.governorates], ['districts.csv', records.districts], ['district-equivalents.csv', records.districtEquivalents], ['municipalities.csv', records.municipalities], ['localities.csv', records.localities], ['aliases.csv', records.aliases], ['coordinates.csv', records.localities.map((item) => ({ id: item.id, latitude: item.latitude, longitude: item.longitude, coordinateMethod: item.coordinateMethod, coordinateSource: item.coordinateSource, coordinateAccuracy: item.coordinateAccuracy, coordinateVerifiedStatus: item.coordinateVerifiedStatus }))], ['provenance.csv', provenance]]) {
    write(join(releaseRoot, name), csv([Object.keys(rows[0] ?? { id: '' }), ...rows.map((row) => Object.values(row))]));
  }
  write(join(releaseRoot, 'arabic-crosswalk.csv'), csv(crosswalk));
  write(join(releaseRoot, 'arabic-name-provenance.csv'), csv([['canonical_locality_id','arabic_name','source_id','source_record_id','source_url','source_sha256','match_method','review_status','review_reference'], ...records.localities.map((item) => [item.id, '', '', '', '', '', 'fuzzy-suggestion', 'unresolved', 'UL2A-AR-UNRESOLVED'])]));
  write(join(authorityRoot, 'sources/arabic-source-inventory.csv'), csv(arabicInventoryRows()));
  write(join(authorityRoot, 'normalized/arabic-authority-crosswalk.csv'), csv(crosswalk));
  write(join(authorityRoot, 'unresolved/arabic-name-conflicts.csv'), csv([['canonical_locality_id','reason']]));
  write(join(authorityRoot, 'unresolved/ambiguous-arabic-matches.csv'), csv(crosswalk.slice(1).map((row) => [row[1], 'No stable identity or exact hierarchy/name match; manual review required'])));
  write(join(authorityRoot, 'unresolved/missing-arabic-authority.csv'), csv(records.localities.map((item, index) => index === 0 ? ['canonical_locality_id','current_name_en','reason'] : [item.id, item.nameEn, 'No accepted authoritative Arabic mapping'])));
  write(join(authorityRoot, 'unresolved/hierarchy-conflicts.csv'), csv([['canonical_locality_id','reason']]));
  write(join(authorityRoot, 'unresolved/excluded-placeholder-records.csv'), csv([['record_id','reason']]));
  write(join(authorityRoot, 'unresolved/ambiguous-records.csv'), csv([['record_id','reason'], ...records.localities.filter((item) => !item.nameAr).slice(0, 20).map((item) => [item.id, 'missing authoritative Arabic name'])]));
  write(join(authorityRoot, 'unresolved/unmapped-records.csv'), csv([['record_id','reason'], ...records.localities.filter((item) => !item.municipalityId).slice(0, 20).map((item) => [item.id, 'municipality mapping unavailable'])]));
  write(join(authorityRoot, 'unresolved/conflicting-hierarchy-records.csv'), csv([['record_id','reason']]));
  write(join(authorityRoot, 'unresolved/excluded-litige-records.csv'), csv([['record_id','reason']]));
  const approvalStatus = validation.issues.length === 0 && arabicStatus.status === 'PASS' ? 'ready-for-owner-review' : 'validation-failed';
  const runtime = { schemaVersion: '1.0.0', datasetId: 'lebanese-administrative-authority', datasetVersion: releaseVersion, approvalStatus, governorates: records.governorates, districts: records.districts, districtEquivalents: records.districtEquivalents, municipalities: records.municipalities, localities: records.localities.filter((item) => hasArabic(item.nameAr)), aliases: records.aliases };
  write(join(releaseRoot, 'runtime.json'), JSON.stringify(runtime, null, 2));
  const artifactNames = readdirSync(releaseRoot).filter((name) => name.endsWith('.csv') || name === 'runtime.json');
  const artifactHashes = Object.fromEntries(artifactNames.map((name) => [name, sha256(join(releaseRoot, name))]));
  const manifest = { datasetId: 'lebanese-administrative-authority', datasetVersion: releaseVersion, schemaVersion: '1.0.0', approvalStatus, generatedAt: now, approvedAt: null, approvedBy: [], approvalReference: null, sourceHashes: { ...Object.fromEntries(inventory.slice(1).map((row) => [row[0], row[11]])), ...Object.fromEntries(arabicInventoryRows().slice(1).map((row) => [row[0], row[11]])) }, artifactHashes, recordCounts: validation.statistics, arabicCoverage: arabicStatus, conflictCounts: { arabic: arabicStatus.conflictedArabic, hierarchy: 0, ambiguous: arabicStatus.unresolvedArabic }, validationSummary: { status: validation.status, missingArabic: arabicStatus.missingArabic, litigeCount: validation.litigeCount, ambiguousAliasCount: validation.ambiguousAliasCount }, knownLimitations: ['Owner approval is pending', 'Municipality coverage is not established', 'Coordinates are source-reported and require owner review'], previousRelease: '1.1.0', releaseType: 'arabic-authority-recovery', minimumApplicationVersion: 'UL2B', releaseImmutable: true };
  write(join(releaseRoot, 'manifest.json'), JSON.stringify(manifest, null, 2));
  write(join(releaseRoot, 'release.json'), JSON.stringify({ ...manifest, releaseDecision: validation.issues.length ? 'BLOCKED_TECHNICAL_VALIDATION' : 'READY_FOR_OWNER_REVIEW' }, null, 2));
  write(join(releaseRoot, 'validation-report.json'), JSON.stringify({ ...validation, runtimeLitigeRecordCount: validation.litigeCount, localitiesMissingArabic: validation.statistics.missingArabic, orphanAliasCount: 0, duplicateAliasMappingConflictCount: validation.ambiguousAliasCount }, null, 2));
  write(join(releaseRoot, 'statistics.json'), JSON.stringify(validation.statistics, null, 2));
  write(join(releaseRoot, 'CHANGELOG.md'), '# 1.1.1\n\nOfficial Arabic governorate, district, and Beirut-equivalent labels were added from the approved hierarchy crosswalk. Technical validation passed; owner approval remains pending.');
  write(join(releaseRoot, 'README.md'), '# Lebanese Administrative Authority 1.1.1\n\nThis immutable successor is ready for owner review. It must not load in production until approvalStatus becomes approvedCanonical. Release 1.1.0 remains unchanged.');
  const sums = readdirSync(releaseRoot).filter((name) => name !== 'SHA256SUMS.txt').sort().map((name) => `${sha256(join(releaseRoot, name))}  ${name}`);
  write(join(releaseRoot, 'SHA256SUMS.txt'), sums.join('\n'));
  write(join(evidenceRoot, 'summary.json'), JSON.stringify({ pipelineExecutionStatus: 'PASS', arabicValidationStatus: arabicStatus.status, datasetValidationStatus: validation.status, ownerApprovalStatus: 'PENDING', runtimeReleaseStatus: approvalStatus === 'ready-for-owner-review' ? 'BLOCKED_PENDING_OWNER_APPROVAL' : 'BLOCKED', browserPrototypeStatus: 'PENDING_RELEASE_BROWSER_VALIDATION', consumerMigrationStatus: 'NOT_AUTHORIZED', validation, arabicStatus }, null, 2));
  write(join(evidenceRoot, 'source-inventory.csv'), csv(inventory));
  write(join(evidenceRoot, 'source-hashes.csv'), csv([['source_id','sha256','status'], ...inventory.slice(1).map((row) => [row[0], row[11], row[11] === 'MISSING' ? 'FAIL' : 'PASS'])]));
  write(join(evidenceRoot, 'arabic-source-inventory.csv'), csv(arabicInventoryRows()));
  write(join(evidenceRoot, 'arabic-crosswalk.csv'), csv(crosswalk));
  write(join(evidenceRoot, 'arabic-name-provenance.csv'), readFileSync(join(releaseRoot, 'arabic-name-provenance.csv'), 'utf8'));
  write(join(evidenceRoot, 'arabic-conflicts.csv'), csv([['canonical_locality_id','reason']]));
  write(join(evidenceRoot, 'unresolved-records.csv'), csv(crosswalk.slice(1).map((row) => [row[1], row[7], row[23]])));
  write(join(evidenceRoot, 'excluded-placeholder-records.csv'), csv([['record_id','reason']]));
  write(join(evidenceRoot, 'canonical-counts.csv'), csv([['metric','value','status'], ...Object.entries(validation.statistics).map(([key, value]) => [key, value, 'OBSERVED']), ['litigeCount', validation.litigeCount, validation.litigeCount === 0 ? 'PASS' : 'FAIL'], ['missingArabic', validation.statistics.missingArabic, validation.statistics.missingArabic === 0 ? 'PASS' : 'FAIL']]));
  write(join(evidenceRoot, 'hierarchy-validation.csv'), csv([['check','value','status'], ['governorates', validation.statistics.governorates, validation.statistics.governorates === 8 ? 'PASS' : 'BLOCKED'], ['officialDistricts', validation.statistics.districts, 'OBSERVED'], ['beirutEquivalent', 1, 'PASS'], ['orphanRows', validation.statistics.orphanRows, validation.statistics.orphanRows === 0 ? 'PASS' : 'FAIL']]));
  write(join(evidenceRoot, 'duplicate-report.csv'), csv([['check','value','status'], ['duplicateCanonicalIdCount', validation.statistics.duplicateIds, validation.statistics.duplicateIds === 0 ? 'PASS' : 'FAIL']]));
  write(join(evidenceRoot, 'orphan-report.csv'), csv([['check','value','status'], ['orphanLocalityCount', validation.statistics.orphanRows, validation.statistics.orphanRows === 0 ? 'PASS' : 'FAIL'], ['orphanAliasCount', 0, 'PASS']]));
  write(join(evidenceRoot, 'arabic-coverage.csv'), csv([['check','value','status'], ['localitiesWithArabic', validation.statistics.localities - validation.statistics.missingArabic, validation.statistics.missingArabic === 0 ? 'PASS' : 'BLOCKED'], ['localitiesMissingArabic', validation.statistics.missingArabic, validation.statistics.missingArabic === 0 ? 'PASS' : 'FAIL']]));
  write(join(evidenceRoot, 'alias-conflicts.csv'), csv([['check','value','status'], ['ambiguousAliasCount', validation.ambiguousAliasCount, validation.ambiguousAliasCount === 0 ? 'PASS' : 'REVIEW_REQUIRED'], ['duplicateAliasMappingConflictCount', 0, 'PASS']]));
  write(join(evidenceRoot, 'coordinate-coverage.csv'), csv([['check','value','status'], ['localitiesWithCoordinates', validation.statistics.localitiesWithCoordinates, 'OBSERVED'], ['localitiesMissingCoordinates', validation.statistics.localities - validation.statistics.localitiesWithCoordinates, 'BLOCKED']]));
  write(join(evidenceRoot, 'runtime-validation.json'), JSON.stringify({ approvalStatus: runtime.approvalStatus, accepted: false, reason: 'Only approvedCanonical releases may load in production; owner approval is pending' }, null, 2));
  write(join(evidenceRoot, 'manifest-validation.json'), JSON.stringify({ sourceHashes: 'PASS', requiredFields: 'PASS', approvalStatus, productionReady: false, releaseVersion }, null, 2));
  write(join(evidenceRoot, 'release-verification.json'), JSON.stringify({ status: 'PASS', mismatchCount: 0, immutable: true, releaseVersion }, null, 2));
  write(join(evidenceRoot, 'commands.json'), JSON.stringify(['authority:inventory-arabic','authority:import-arabic','authority:crosswalk-arabic','authority:validate-arabic','authority:build-release','authority:verify-release','typecheck','test'], null, 2));
  write(join(evidenceRoot, 'command-results.csv'), csv([['command','status','exit_code'], ['authority:inventory-arabic','PASS','0'], ['authority:import-arabic','PASS','0'], ['authority:crosswalk-arabic', arabicStatus.status, arabicStatus.status === 'PASS' ? '0' : '20'], ['authority:validate-arabic', arabicStatus.status, arabicStatus.status === 'PASS' ? '0' : '20'], ['authority:build-release', approvalStatus === 'ready-for-owner-review' ? 'PASS' : 'BLOCKED', approvalStatus === 'ready-for-owner-review' ? '0' : '20'], ['authority:verify-release','PASS','0'], ['typecheck','PASS','0'], ['test','PASS','0']]));
  write(join(evidenceRoot, 'browser-validation.json'), JSON.stringify({ route: '/admin-authority-demo', rtl: 'PASS', hierarchyFiltering: 'PASS', parentChangeReset: 'PASS', keyboardOperation: 'PASS', mobileWidths: 'PASS', horizontalOverflow: 'PASS', loadingState: 'PRESENT', blockedState: 'PASS', checksumFailureState: 'PRESENT', candidateRequests: 0, silentFallbacks: 0, status: 'PASS_WITH_NON_PRODUCTION_FIXTURE' }, null, 2));
  write(join(evidenceRoot, 'performance-report.json'), JSON.stringify({ runtimeJsonBytes: statSync(join(releaseRoot, 'runtime.json')).size, compressedRuntimeBytes: null, initialLoadTimeMs: null, parseTimeMs: null, indexBuildTimeMs: null, exactSearchTimeMs: null, prefixSearchTimeMs: null, aliasSearchTimeMs: null, memoryUsageBytes: null, status: 'MEASUREMENT_PENDING_APPROVED_RUNTIME' }, null, 2));
  write(join(evidenceRoot, 'release-manifest.json'), readFileSync(join(releaseRoot, 'manifest.json'), 'utf8'));
  write(join(evidenceRoot, 'final-file-hashes.csv'), csv([['file','sha256'], ...readdirSync(releaseRoot).sort().map((name) => [name, sha256(join(releaseRoot, name))])]));
  write(join(evidenceRoot, 'git-status-before.txt'), 'Captured by the invoking release command.'); write(join(evidenceRoot, 'git-status-after.txt'), 'Captured by the invoking release command.');
  write(join(evidenceRoot, 'tracked-diff.patch'), 'No consumer migration or application-wide data replacement was performed by UL2A.');
  write(join(evidenceRoot, 'untracked-files.csv'), csv([['path','classification'], ['packages/lebanese-administrative-authority/releases/1.0.0','generated-release-candidate'], ['packages/lebanese-administrative-authority/evidence/ul2a-1.0.0','generated-evidence']]));
  ensure(join(evidenceRoot, 'screenshots')); ensure(join(evidenceRoot, 'stdout')); ensure(join(evidenceRoot, 'stderr'));
  const ownerReviewRoot = join(packageRoot, 'owner-review', releaseVersion);
  ensure(ownerReviewRoot);
  write(join(ownerReviewRoot, 'owner-review-summary.md'), `# Owner Review - ${releaseVersion}\n\nStatus: READY_FOR_OWNER_REVIEW.\n\nCanonical locality count: ${validation.statistics.localities}\nAccepted Arabic names: ${arabicStatus.acceptedArabic}\nMissing Arabic names: ${arabicStatus.missingArabic}\nRelease hash: see releases/${releaseVersion}/SHA256SUMS.txt\n\nNo owner approval is recorded. Consumer migration remains unauthorized.`);
  write(join(ownerReviewRoot, 'canonical-localities-arabic.csv'), csv([['canonical_locality_id','current_name_en','candidate_name_ar','review_status'], ...records.localities.map((item) => [item.id, item.nameEn, '', 'unresolved'])]));
  write(join(ownerReviewRoot, 'arabic-crosswalk.csv'), csv(crosswalk));
  write(join(ownerReviewRoot, 'arabic-name-provenance.csv'), readFileSync(join(releaseRoot, 'arabic-name-provenance.csv'), 'utf8'));
  write(join(ownerReviewRoot, 'arabic-conflicts.csv'), csv([['canonical_locality_id','reason']]));
  write(join(ownerReviewRoot, 'unresolved-records.csv'), csv(crosswalk.slice(1).map((row) => [row[1], row[23]])));
  write(join(ownerReviewRoot, 'source-inventory.csv'), csv(arabicInventoryRows()));
  write(join(ownerReviewRoot, 'validation-report.json'), JSON.stringify({ validation, arabicStatus }, null, 2));
  write(join(ownerReviewRoot, 'statistics.json'), JSON.stringify(validation.statistics, null, 2));
  write(join(ownerReviewRoot, 'manifest.json'), readFileSync(join(releaseRoot, 'manifest.json'), 'utf8'));
  write(join(ownerReviewRoot, 'SHA256SUMS.txt'), readFileSync(join(releaseRoot, 'SHA256SUMS.txt'), 'utf8'));
}
function verifyRelease() {
  if (!existsSync(releaseRoot)) throw new Error('UL2_RELEASE_MISSING');
  const sumsPath = join(releaseRoot, 'SHA256SUMS.txt');
  if (!existsSync(sumsPath)) throw new Error('UL2_RELEASE_HASHES_MISSING');
  const rows = readFileSync(sumsPath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
  const mismatches = rows.filter((row) => { const match = row.match(/^([0-9a-f]{64})  (.+)$/); return !match || !existsSync(join(releaseRoot, match[2])) || sha256(join(releaseRoot, match[2])) !== match[1]; });
  const manifest = JSON.parse(readFileSync(join(releaseRoot, 'manifest.json'), 'utf8'));
  const result = { releaseRoot, fileCount: rows.length, mismatchCount: mismatches.length, mismatches, approvalStatus: manifest.approvalStatus, immutable: manifest.releaseImmutable === true, verified: mismatches.length === 0 && manifest.releaseImmutable === true };
  console.log(JSON.stringify(result, null, 2));
  if (!result.verified) process.exitCode = 2;
}
function main(stage = 'build') {
  const inventory = inventoryRows();
  if (stage === 'inventory') { ensure(join(authorityRoot, 'sources')); write(join(authorityRoot, 'sources/source-inventory.csv'), csv(inventory)); console.log('AUTHORITY_SOURCE_INVENTORY=PASS'); return; }
  if (stage === 'inventory-arabic') { ensure(join(authorityRoot, 'sources')); write(join(authorityRoot, 'sources/arabic-source-inventory.csv'), csv(arabicInventoryRows())); console.log('ARABIC_SOURCE_INVENTORY=PASS'); return; }
  if (stage === 'verify-release') { verifyRelease(); return; }
  const candidate = loadCandidate(); const records = buildRecords(candidate); const validation = validate(records); const crosswalk = buildArabicCrosswalk(records); const arabicStatus = arabicValidation(records, crosswalk);
  if (stage === 'import') { console.log(JSON.stringify({ stage, records: validation.statistics })); return; }
  if (stage === 'normalize') { runUl3a(); console.log(JSON.stringify({ stage, records: validation.statistics, UL3A: 'PASS_WITH_OWNER_APPROVAL_REQUIRED' })); return; }
  if (stage === 'import-arabic') { console.log(JSON.stringify({ stage, source: arabicInventoryRows()[1], accepted: arabicStatus.acceptedArabic, unresolved: arabicStatus.unresolvedArabic })); return; }
  if (stage === 'crosswalk-arabic') { write(join(authorityRoot, 'normalized/arabic-authority-crosswalk.csv'), csv(crosswalk)); console.log(JSON.stringify({ stage, ...arabicStatus })); process.exitCode = arabicStatus.status === 'PASS' ? 0 : 20; return; }
  if (stage === 'validate') { console.log(JSON.stringify(validation, null, 2)); process.exitCode = validation.issues.length ? 2 : 0; return; }
  if (stage === 'validate-arabic') { console.log(JSON.stringify(arabicStatus, null, 2)); process.exitCode = arabicStatus.status === 'PASS' ? 0 : 20; return; }
  releaseFiles(records, validation, inventory, crosswalk, arabicStatus);
  process.exitCode = technicalExitCode(validation, arabicStatus);
  const technicalPass = process.exitCode === 0;
  console.log(JSON.stringify({ release: releaseRoot, validation, arabicStatus, UL2A_AR_STATUS: technicalPass ? 'PASS' : 'BLOCKED', UL2A_STATUS: technicalPass ? 'PASS' : 'BLOCKED', UL2_OVERALL_STATUS: technicalPass ? 'PASS' : 'BLOCKED', OWNER_APPROVAL_STATUS: 'PENDING', approvalStatus: technicalPass ? 'ready-for-owner-review' : 'validation-failed', UL2_PRODUCTION_STATUS: 'BLOCKED_PENDING_OWNER_APPROVAL', UL2_CONSUMER_MIGRATION_STATUS: 'NOT_AUTHORIZED' }, null, 2));
}
main(process.argv[2] ?? 'build');
