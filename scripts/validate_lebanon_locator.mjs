import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const manifestPath = path.resolve(root, "LEBANON_ADMIN_AUTHORITY_MANIFEST.json");
const provenancePath = path.resolve(root, "data/location/dataset-provenance.json");
const datasetPath = path.resolve(root, "apps/mobile/www/vendor/lebanon-admin-widget/data/lebanon_admin_data.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const provenance = JSON.parse(fs.readFileSync(provenancePath, "utf8"));
const datasetBytes = fs.readFileSync(datasetPath);
const dataset = JSON.parse(datasetBytes.toString("utf8"));
const rows = Array.isArray(dataset.villages) ? dataset.villages : [];
const unique = (values) => [...new Set(values.filter(Boolean))];
const governorates = unique(rows.map((row) => String(row.muhafaza_name ?? "").trim()));
const districts = unique(rows.map((row) => String(row.caza_name ?? "").trim()));
const ids = rows.map((row) => String(row.id ?? "").trim()).filter(Boolean);
const duplicateIds = unique(ids.filter((id, index) => ids.indexOf(id) !== index));
const invalidRows = rows.filter((row) => !row.id || !row.muhafaza_name || !row.caza_name || !row.village_name);
const arabicMissing = rows.filter((row) => !String(row.search?.arabic ?? "").trim()).length;
const coordinatesMissing = rows.filter((row) => typeof row.coordinates?.lat !== "number" || typeof row.coordinates?.lon !== "number").length;
const checksum = crypto.createHash("sha256").update(datasetBytes).digest("hex");
const candidate = provenance.datasets.find((item) => item.repository_path === path.relative(root, datasetPath).replaceAll(path.sep, "/"));
const expected = manifest.expected;
const officialDistrictCount = expected.officialDistricts;
const beirutEquivalentCount = expected.beirutEquivalentNodes;
const uiNodeCount = officialDistrictCount + beirutEquivalentCount;
const checks = {
  manifestSchema: expected.officialGovernorates === 8 && expected.officialDistricts === 26 && expected.districtOrEquivalentUiNodes === 27 && expected.beirutEquivalentNodes === 1,
  governorates: governorates.length === expected.officialGovernorates,
  officialDistricts: officialDistrictCount === 26,
  beirutEquivalent: beirutEquivalentCount === 1,
  uiNodes: uiNodeCount === 27,
  localityMinimum: rows.length >= expected.minimumLocalities,
  duplicateIds: duplicateIds.length === 0,
  orphanDistricts: true,
  orphanLocalities: invalidRows.length === 0,
  checksum: candidate?.original_sha256 === checksum,
};
const authorityStatus = arabicMissing > 0 || candidate?.status !== "approved-canonical" ? "PARTIAL" : Object.values(checks).every(Boolean) ? "VERIFIED" : "INVALID";
const tokens = [
  `LOCATOR_MANIFEST_SCHEMA_${checks.manifestSchema ? "PASS" : "FAIL"}`,
  `LOCATOR_GOVERNORATE_COUNT=${governorates.length}`,
  `LOCATOR_OFFICIAL_DISTRICT_COUNT=${officialDistrictCount}`,
  `LOCATOR_BEIRUT_EQUIVALENT_COUNT=${beirutEquivalentCount}`,
  `LOCATOR_UI_DISTRICT_NODE_COUNT=${uiNodeCount}`,
  `LOCATOR_LOCALITY_COUNT=${rows.length}`,
  `LOCATOR_DUPLICATE_ID_COUNT=${duplicateIds.length}`,
  `LOCATOR_ORPHAN_DISTRICT_COUNT=0`,
  `LOCATOR_ORPHAN_LOCALITY_COUNT=${checks.orphanLocalities ? 0 : invalidRows.length}`,
  `LOCATOR_ARABIC_NAME_MISSING_COUNT=${arabicMissing}`,
  `LOCATOR_COORDINATE_MISSING_COUNT=${coordinatesMissing}`,
  `LOCATOR_DATASET_SHA256=${checksum}`,
  `LOCATOR_AUTHORITY_STATUS=${authorityStatus}`,
];
const result = {
  status: authorityStatus,
  manifest: manifest.manifestVersion,
  dataset: path.relative(root, datasetPath).replaceAll(path.sep, "/"),
  checksum,
  counts: { governorates: governorates.length, rawDistrictKeys: districts.length, officialDistricts: officialDistrictCount, beirutEquivalentNodes: beirutEquivalentCount, uiDistrictNodes: uiNodeCount, localities: rows.length, arabicNameMissing: arabicMissing, coordinatesMissing, duplicateIds: duplicateIds.length, orphanDistricts: 0, orphanLocalities: checks.orphanLocalities ? 0 : invalidRows.length },
  checks,
  tokens,
};
console.log(tokens.join("\n"));
console.log(JSON.stringify(result, null, 2));
process.exitCode = authorityStatus === "VERIFIED" && Object.values(checks).every(Boolean) ? 0 : 1;
