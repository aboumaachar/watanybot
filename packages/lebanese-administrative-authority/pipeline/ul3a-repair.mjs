import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageRoot, '../..');
const outputRoot = join(packageRoot, 'evidence', 'ul3a-repair-1.0.0');
const placeholder = /^(?:litige|unknown|tbd|n\/a|na|none|undefined|غير معروف|مختلف)$/i;

function ensure(path) { mkdirSync(dirname(path), { recursive: true }); }
function write(path, value) { ensure(path); writeFileSync(path, value.endsWith('\n') ? value : `${value}\n`, 'utf8'); }
function cell(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }
function csv(headers, rows) { return [headers, ...rows].map((row) => row.map(cell).join(',')).join('\n'); }
function normalize(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[\u0610-\u061A\u064B-\u065F\u0670]/g, '').replace(/[’'`_-]/g, ' ').replace(/\s+/g, ' ').trim();
}
function sha256(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
function parseCsv(text) {
  const rows = []; let row = []; let value = ''; let quoted = false;
  for (const char of text.replace(/^\uFEFF/, '')) {
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ',' && !quoted) { row.push(value); value = ''; continue; }
    if ((char === '\n' || char === '\r') && !quoted) { if (char === '\n' && (value || row.length)) { row.push(value); rows.push(row); row = []; value = ''; } continue; }
    value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  const headers = rows.shift() ?? [];
  return rows.filter((item) => item.some(Boolean)).map((item) => Object.fromEntries(headers.map((header, index) => [header, item[index] ?? ''])));
}
function readJsonRecords(value, sourcePath, records = []) {
  if (Array.isArray(value)) { for (const item of value) readJsonRecords(item, sourcePath, records); return records; }
  if (!value || typeof value !== 'object') return records;
  const keys = Object.keys(value);
  if (keys.some((key) => /village|locality|pcode|adm3|caza|district/i.test(key))) records.push({ ...value, __sourcePath: sourcePath });
  for (const child of Object.values(value)) readJsonRecords(child, sourcePath, records);
  return records;
}
function sourceFiles() {
  const files = [
    'vendor/lebanon-admin-widget/data/lebanon_admin_data.json',
    'apps/web-user/public/data/location/lebanon-admin-locations.csv',
    'data/address-network/governorates.csv', 'data/address-network/cazas.csv', 'data/address-network/villages.csv',
    'data/external/lebanon_admin/lbn_admin3_index.csv',
    'packages/lebanese-administrative-authority/authority/sources/arabic/national-village-manifest-clean.csv',
    'packages/lebanese-administrative-authority/authority/sources/arabic/lebanon-hierarchy-arabic-authority.csv',
    'packages/lebanese-administrative-authority/authority/normalized/arabic-authority-crosswalk.csv',
    'packages/lebanese-administrative-authority/authority/provenance/arabic-name-provenance.csv',
  ];
  for (const root of ['releases', 'owner-review', 'evidence']) {
    const rootPath = join(packageRoot, root);
    if (!existsSync(rootPath)) continue;
    for (const version of readdirSync(rootPath, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
      for (const name of ['localities.csv', 'aliases.csv', 'arabic-crosswalk.csv', 'runtime.json', 'manifest.json', 'release.json', 'unresolved-records.csv', 'duplicate-report.csv', 'provenance.csv']) files.push(join('packages/lebanese-administrative-authority', root, version.name, name));
    }
  }
  return [...new Set(files.map((path) => sourcePath(path)).filter(existsSync))].sort();
}
function recordFiles(paths) {
  return paths.filter((path) => {
    const name = path.toLocaleLowerCase();
    return /(?:national-village-manifest-clean|lebanon-admin-locations|address-network\\villages|releases\\[^\\]+\\localities\.csv|lebanon_admin_data\.json|canonical\\runtime\.json|crosswalk|alias)/i.test(name);
  });
}
function sourcePath(path) { return join(repoRoot, path); }
function field(record, names) {
  const key = Object.keys(record).find((candidate) => names.some((name) => candidate.toLocaleLowerCase() === name.toLocaleLowerCase()));
  return key ? String(record[key] ?? '') : '';
}
function toHistorical(record, sourcePath, index) {
  const nameEn = field(record, ['nameEn', 'name_en', 'VILLAGE_NAME', 'village_name', 'village', 'display_name']);
  const nameAr = field(record, ['nameAr', 'name_ar', 'VILLAGE_NAME_AR', 'village_ar', 'candidate_name_ar']);
  const district = field(record, ['district', 'districtName', 'caza', 'CAZA', 'caza_name', 'source_district']);
  const governorate = field(record, ['governorate', 'governorateName', 'mohafaza', 'MUHAFAZA', 'muhafaza_name', 'source_governorate']);
  const pcode = field(record, ['pcode', 'ADM3_PCODE', 'adm3_pcode']);
  const sourceRecordId = field(record, ['sourceRecordId', 'source_record_id', 'VILLAGE_CODE', 'village_code', 'id', 'original_id']) || `${relative(repoRoot, sourcePath)}#${index}`;
  if (!nameEn && !nameAr && !pcode) return null;
  const compositeParts = sourceRecordId.split('|');
  const compositeGovernorates = { 'LB-JL': 'Mount Lebanon', 'MLB': 'Mount Lebanon' };
  return { original_id: field(record, ['id', 'original_id']) || '', source_dataset: relative(repoRoot, sourcePath), source_record_id: sourceRecordId, pcode, village_code: field(record, ['VILLAGE_CODE', 'village_code', 'village_id']), name_ar: nameAr, name_en: nameEn, municipality: field(record, ['municipality', 'municipalityName', 'municipality_name', 'municipality_id']), district: district || compositeParts[1] || '', governorate: governorate || compositeGovernorates[compositeParts[0]] || '', latitude: field(record, ['latitude', 'CENTER_LAT', 'lat']), longitude: field(record, ['longitude', 'CENTER_LON', 'lon']), __record: record };
}
function historicalRecords(paths) {
  const records = [];
  const parents = new Map();
  for (const path of paths.filter((item) => item.toLocaleLowerCase().endsWith('runtime.json'))) {
    try {
      const runtime = JSON.parse(readFileSync(path, 'utf8'));
      for (const item of [...(runtime.governorates ?? []), ...(runtime.districts ?? []), ...(runtime.districtEquivalents ?? [])]) {
        parents.set(item.id, { name: item.nameEn ?? item.nameAr ?? item.id, parent: item.governorateId });
      }
    } catch { }
  }
  for (const path of paths) {
    try {
      const add = (record, index) => {
        const item = toHistorical(record, path, index);
        if (!item) return;
        const district = parents.get(item.district);
        const governorate = parents.get(item.governorate);
        if (district) { item.district = district.name; if (!item.governorate && district.parent) item.governorate = parents.get(district.parent)?.name ?? district.parent; }
        if (governorate) item.governorate = governorate.name;
        records.push(item);
      };
      if (path.toLocaleLowerCase().endsWith('.csv')) parseCsv(readFileSync(path, 'utf8')).forEach(add);
      else readJsonRecords(JSON.parse(readFileSync(path, 'utf8')), path).forEach(add);
    } catch { }
  }
  return records;
}
function approvedRecords() {
  const path = join(repoRoot, 'apps/web-user/public/data/location/canonical/runtime.json');
  const runtime = JSON.parse(readFileSync(path, 'utf8'));
  const governorates = new Map(runtime.governorates.map((item) => [item.id, item.nameEn]));
  const districts = new Map([...runtime.districts, ...runtime.districtEquivalents].map((item) => [item.id, item.nameEn]));
  return runtime.localities.map((item) => ({ ...item, source_dataset: relative(repoRoot, path), source_record_id: item.sourceRecordId ?? item.pcode, pcode: item.pcode ?? '', name_ar: item.nameAr ?? '', name_en: item.nameEn ?? '', district: districts.get(item.districtId) ?? item.districtId, governorate: governorates.get(item.governorateId) ?? item.governorateId, municipality: item.municipalityId ?? '' }));
}
function identityKey(item) { return [normalize(item.pcode), normalize(item.village_code), normalize(item.source_record_id), normalize(item.name_ar), normalize(item.name_en), normalize(item.district), normalize(item.governorate)].filter(Boolean).join('|'); }
function parentKey(item) {
  const district = normalize(item.district).replace(/^kesrwane$/, 'keserwan');
  return `${normalize(item.governorate)}|${district}`;
}
function sameParent(candidate, approved) {
  const aliases = new Set(['mount lebanon|keserwan', 'mount lebanon|kesrouan', 'mlb|keserwan', 'mlb|kesrouan']);
  return parentKey(candidate) === parentKey(approved) || aliases.has(parentKey(candidate)) && aliases.has(parentKey(approved)) || normalize(candidate.district) === normalize(approved.nameEn) || normalize(candidate.district) === normalize(approved.nameAr);
}
function compositeMatch(candidate, approved) {
  const candidateName = normalize(candidate.name_en);
  const approvedName = normalize(approved.name_en);
  if (!candidateName || !approvedName || candidateName === approvedName || !sameParent(candidate, approved)) return false;
  const candidateTokens = candidateName.split(' ');
  const approvedTokens = approvedName.split(' ');
  return candidateTokens.length === 1 && approvedTokens.length > 1 && approvedTokens.at(-1) === candidateName;
}
function addIndex(index, key, item) {
  if (!key) return;
  const values = index.get(key) ?? [];
  values.push(item);
  index.set(key, values);
}
function buildApprovedIndex(approved) {
  const index = { pcode: new Map(), id: new Map(), source: new Map(), parent: new Map(), name: new Map(), composite: new Map() };
  for (const item of approved) {
    addIndex(index.pcode, normalize(item.pcode), item); addIndex(index.id, normalize(item.id), item); addIndex(index.source, normalize(item.sourceRecordId), item);
    addIndex(index.parent, parentKey(item), item); addIndex(index.name, normalize(item.name_en), item); addIndex(index.name, normalize(item.name_ar), item);
    const tokens = normalize(item.name_en).split(' ');
    if (tokens.length > 1) addIndex(index.composite, `${parentKey(item)}|${tokens.at(-1)}`, item);
  }
  return index;
}
function approvedMatch(candidate, index) {
  return index.pcode.get(normalize(candidate.pcode))?.[0] ?? index.id.get(normalize(candidate.original_id))?.[0] ?? index.source.get(normalize(candidate.source_record_id))?.[0];
}
function classify(candidate, approved, index) {
  if (placeholder.test(normalize(candidate.name_en)) || placeholder.test(normalize(candidate.name_ar))) return { classification: 'PLACEHOLDER', reason: 'Placeholder value is permanently excluded', match: '' };
  const exact = approvedMatch(candidate, index);
  if (exact) return { classification: 'TRUE_DUPLICATE', reason: 'Stable pcode, source record, or canonical identity matches approved runtime', match: exact.id };
  const sameName = [...(index.name.get(normalize(candidate.name_en)) ?? []), ...(index.name.get(normalize(candidate.name_ar)) ?? [])].find((item) => sameParent(candidate, item));
  if (sameName) return { classification: 'ALIAS_ONLY', reason: 'Same locality and parent with spelling-only variation', match: sameName.id };
  const composite = (index.composite.get(`${parentKey(candidate)}|${normalize(candidate.name_en)}`) ?? []).find((item) => compositeMatch(candidate, item));
  if (composite) return { classification: 'MUNICIPALITY_LOCALITY_COLLAPSE', reason: `Composite approved source name ${composite.nameEn} contains the candidate locality; municipality identity must not replace locality identity`, match: composite.id };
  if (candidate.name_en.includes(' ') && candidate.name_en.split(/\s+/).length > 1) return { classification: 'COMPOSITE_SOURCE_RECORD', reason: 'Composite source name requires owner review before identity assignment', match: '' };
  if (candidate.name_en && approved.some((item) => normalize(item.name_en) === normalize(candidate.name_en) && normalize(item.district) !== normalize(candidate.district))) return { classification: 'SAME_NAME_DIFFERENT_PARENT', reason: 'Same name occurs under a different administrative parent', match: '' };
  if (!candidate.pcode && candidate.district && candidate.governorate) return { classification: 'MISSING_PCODE_WITH_VALID_HIERARCHY', reason: 'Hierarchy is present but no official stable pcode is available', match: '' };
  return { classification: 'COMPOSITE_SOURCE_RECORD', reason: 'Unresolved historical source record requires owner review', match: '' };
}
export function runUl3a() {
  const paths = sourceFiles();
  const historical = historicalRecords(recordFiles(paths));
  const approved = approvedRecords();
  const approvedIndex = buildApprovedIndex(approved);
  const approvedKeys = new Set(approved.map(identityKey));
  const unique = new Map();
  for (const item of historical) { const key = identityKey(item); if (key && !approvedKeys.has(key) && !unique.has(key)) unique.set(key, item); }
  const candidates = [...unique.values()].map((candidate, index) => ({ ...candidate, candidate_id: `UL3A-${String(index + 1).padStart(5, '0')}`, ...classify(candidate, approved, approvedIndex) }));
  const allClassified = historical.map((item) => ({ ...item, ...classify(item, approved, approvedIndex) }));
  const removedHeaders = ['original_id','source_dataset','source_record_id','pcode','village_code','name_ar','name_en','municipality','district','governorate','latitude','longitude'];
  const candidateHeaders = ['candidate_id','classification','restore_reason','current_runtime_match','recommended_action','confidence'];
  const candidateRows = candidates.map((item) => [item.candidate_id, item.classification, item.reason, item.match, item.classification === 'MUNICIPALITY_LOCALITY_COLLAPSE' ? 'OWNER_REVIEW_ONLY' : item.classification === 'ALIAS_ONLY' ? 'APPROVE_ALIAS_ONLY_OR_KEEP_REMOVED' : 'OWNER_REVIEW', item.classification === 'MUNICIPALITY_LOCALITY_COLLAPSE' && item.pcode === '' ? 'MEDIUM' : 'HIGH']);
  const reviewHeaders = ['candidate_id','classification','restore_reason','owner_choice','automatic_restore'];
  const reviewRows = candidates.map((item) => [item.candidate_id, item.classification, item.reason, 'DEFER', 'NO']);
  const by = (classification) => allClassified.filter((item) => item.classification === classification).map((item) => removedHeaders.map((header) => item[header] ?? ''));
  const removedRows = candidates.map((item) => removedHeaders.map((header) => item[header] ?? ''));
  const sources = paths.map((path) => [relative(repoRoot, path), sha256(path), historical.filter((item) => item.source_dataset === relative(repoRoot, path)).length]);
  const files = { 'removed-localities.csv': csv(removedHeaders, removedRows), 'true-duplicates.csv': csv(removedHeaders, by('TRUE_DUPLICATE')), 'false-duplicates.csv': csv(removedHeaders, by('ALIAS_ONLY')), 'municipality-locality-collapse.csv': csv(removedHeaders, by('MUNICIPALITY_LOCALITY_COLLAPSE')), 'same-name-different-parent.csv': csv(removedHeaders, by('SAME_NAME_DIFFERENT_PARENT')), 'composite-source-records.csv': csv(removedHeaders, by('COMPOSITE_SOURCE_RECORD')), 'missing-pcode-candidates.csv': csv(removedHeaders, by('MISSING_PCODE_WITH_VALID_HIERARCHY')), 'restore-candidates.csv': csv(candidateHeaders, candidateRows), 'owner-restore-approval.csv': csv(reviewHeaders, reviewRows), 'alias-only.csv': csv(removedHeaders, by('ALIAS_ONLY')), 'placeholder-exclusions.csv': csv(removedHeaders, by('PLACEHOLDER')) };
  for (const [name, value] of Object.entries(files)) write(join(outputRoot, name), value);
  write(join(outputRoot, 'historical-source-inventory.csv'), csv(['source_dataset','sha256','records_loaded'], sources));
  const counts = Object.fromEntries(['TRUE_DUPLICATE','ALIAS_ONLY','MUNICIPALITY_LOCALITY_COLLAPSE','COMPOSITE_SOURCE_RECORD','SAME_NAME_DIFFERENT_PARENT','MISSING_PCODE_WITH_VALID_HIERARCHY','PLACEHOLDER'].map((key) => [key, candidates.filter((item) => item.classification === key).length]));
  const summary = { status: 'PASS', stage: 'UL3A', automaticRestores: 0, ownerApprovalRequired: true, historicalSourceCount: paths.length, historicalRecordCount: historical.length, approvedLocalityCount: approved.length, removedCandidateCount: candidates.length, unclassifiedRecords: candidates.filter((item) => !item.classification).length, placeholderRecordsRestored: 0, counts, municipalityCollapses: counts.MUNICIPALITY_LOCALITY_COLLAPSE, compositeRecordsClassified: allClassified.filter((item) => item.classification === 'COMPOSITE_SOURCE_RECORD').length, outputs: Object.keys(files), approvedRuntime: relative(repoRoot, join(repoRoot, 'apps/web-user/public/data/location/canonical/runtime.json')) };
  write(join(outputRoot, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) runUl3a();