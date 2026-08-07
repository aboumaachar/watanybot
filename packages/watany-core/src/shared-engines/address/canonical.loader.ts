import type {
  CanonicalDatasetManifest,
  CanonicalDistrict,
  CanonicalDistrictEquivalent,
  CanonicalLocality,
  CanonicalLocatorCatalog,
  CanonicalLocatorDataset,
  DatasetValidationResult,
} from "./canonical.types";

export type CanonicalRuntimeGovernorate = Readonly<{ id: string; nameAr: string; nameEn?: string | null }>;
export type CanonicalRuntimeDistrict = Readonly<{ id: string; governorateId: string; nameAr: string; nameEn?: string | null }>;
export type CanonicalRuntimeLocality = Readonly<{
  id: string;
  governorateId: string;
  districtId: string;
  pcode: string;
  nameAr: string;
  nameEn?: string | null;
  aliases: string[];
}>;
export type CanonicalRuntime = Readonly<{
  schemaVersion: string;
  datasetId: string;
  datasetVersion: string;
  approvalStatus: "approvedCanonical";
  governorates: CanonicalRuntimeGovernorate[];
  districts: CanonicalRuntimeDistrict[];
  districtEquivalents: CanonicalRuntimeDistrict[];
  localities: CanonicalRuntimeLocality[];
  aliases: ReadonlyArray<Record<string, unknown>>;
}>;

const CANONICAL_RUNTIME_URL = "/data/location/canonical/runtime.json";
const CANONICAL_MANIFEST_URL = "/data/location/canonical/manifest.json";

const normalize = (value: string): string => value.trim().toLocaleLowerCase("ar").replace(/[\u064B-\u065F\u0670]/g, "").replace(/[-_\s]+/g, "");
const byArabicName = <T extends { nameAr: string | null }>(left: T, right: T): number => (left.nameAr ?? "").localeCompare(right.nameAr ?? "", "ar") || String(left.nameAr ?? "").localeCompare(String(right.nameAr ?? ""));
const unique = <T>(values: T[]): T[] => [...new Set(values)];

export class CanonicalLocatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalLocatorError";
  }
}

function validateDataset(dataset: CanonicalLocatorDataset, expectedSha256: string): DatasetValidationResult {
  const { manifest, localities } = dataset;
  const governorateIds = new Set(manifest.governorates.map((item) => item.id));
  const districtIds = new Set(manifest.districts.map((item) => item.id));
  const equivalentIds = new Set(manifest.districtEquivalents.map((item) => item.id));
  const allParentIds = new Set([...districtIds, ...equivalentIds]);
  const allIds = [
    ...manifest.governorates.map((item) => item.id),
    ...manifest.districts.map((item) => item.id),
    ...manifest.districtEquivalents.map((item) => item.id),
    ...localities.map((item) => item.id),
  ];
  const duplicateIds = allIds.length - unique(allIds).length;
  const orphanDistricts = [...manifest.districts, ...manifest.districtEquivalents].filter((item) => !governorateIds.has(item.governorateId)).length;
  const orphanLocalities = localities.filter((item) => !governorateIds.has(item.governorateId) || !allParentIds.has(item.districtOrEquivalentId)).length;
  const arabicNameMissing = localities.filter((item) => !item.nameAr?.trim()).length;
  const coordinatesMissing = localities.filter((item) => typeof item.latitude !== "number" || typeof item.longitude !== "number").length;
  const issues: string[] = [];

  if (manifest.status !== "approvedCanonical") issues.push("DATASET_NOT_APPROVED_CANONICAL");
  if (manifest.sha256 !== expectedSha256) issues.push("DATASET_CHECKSUM_MISMATCH");
  if (manifest.governorates.length !== 8) issues.push("GOVERNORATE_COUNT_INVALID");
  if (manifest.districts.length !== 26) issues.push("OFFICIAL_DISTRICT_COUNT_INVALID");
  if (manifest.districtEquivalents.length !== 1) issues.push("BEIRUT_EQUIVALENT_COUNT_INVALID");
  if (manifest.districts.length + manifest.districtEquivalents.length !== 27) issues.push("UI_DISTRICT_NODE_COUNT_INVALID");
  if (localities.length < 1500) issues.push("LOCALITY_MINIMUM_INVALID");
  if (duplicateIds > 0) issues.push("DUPLICATE_CANONICAL_IDS");
  if (orphanDistricts > 0) issues.push("ORPHAN_DISTRICTS");
  if (orphanLocalities > 0) issues.push("ORPHAN_LOCALITIES");
  if (arabicNameMissing > 0) issues.push("ARABIC_NAMES_MISSING");

  const structuralFailure = issues.some((issue) => [
    "DATASET_CHECKSUM_MISMATCH",
    "GOVERNORATE_COUNT_INVALID",
    "OFFICIAL_DISTRICT_COUNT_INVALID",
    "BEIRUT_EQUIVALENT_COUNT_INVALID",
    "UI_DISTRICT_NODE_COUNT_INVALID",
    "LOCALITY_MINIMUM_INVALID",
    "DUPLICATE_CANONICAL_IDS",
    "ORPHAN_DISTRICTS",
    "ORPHAN_LOCALITIES",
  ].includes(issue));
  return {
    ok: !structuralFailure,
    productionReady: !structuralFailure && manifest.status === "approvedCanonical" && arabicNameMissing === 0,
    status: structuralFailure ? "INVALID" : arabicNameMissing > 0 || manifest.status !== "approvedCanonical" ? "PARTIAL" : "VERIFIED",
    issues,
    counts: {
      governorates: manifest.governorates.length,
      officialDistricts: manifest.districts.length,
      districtEquivalents: manifest.districtEquivalents.length,
      uiDistrictNodes: manifest.districts.length + manifest.districtEquivalents.length,
      localities: localities.length,
      arabicNameMissing,
      coordinatesMissing,
      duplicateIds,
      orphanDistricts,
      orphanLocalities,
    },
  };
}

export function sha256Hex(content: string): string {
  const words = new Uint32Array(64);
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const bytes = new TextEncoder().encode(content);
  const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  padded.set(bytes); padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer); view.setUint32(padded.length - 4, bytes.length * 8);
  let [a, b, c, d, e, f, g, h] = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index++) words[index] = view.getUint32(offset + index * 4);
    for (let index = 16; index < 64; index++) { const x = words[index - 15]; const y = words[index - 2]; words[index] = (((x >>> 7) ^ (x << 25) ^ (x >>> 18) ^ (x << 14) ^ (x >>> 3)) + words[index - 16] + ((y >>> 17) ^ (y << 15) ^ (y >>> 19) ^ (y << 13) ^ (y >>> 10)) + words[index - 7]) | 0; }
    let [aa, bb, cc, dd, ee, ff, gg, hh] = [a, b, c, d, e, f, g, h];
    for (let index = 0; index < 64; index++) { const s1 = (ee >>> 6) ^ (ee << 26) ^ (ee >>> 11) ^ (ee << 21) ^ (ee >>> 25) ^ (ee << 7); const ch = (ee & ff) ^ (~ee & gg); const t1 = (hh + s1 + ch + constants[index] + words[index]) | 0; const s0 = (aa >>> 2) ^ (aa << 30) ^ (aa >>> 13) ^ (aa << 19) ^ (aa >>> 22) ^ (aa << 10); const maj = (aa & bb) ^ (aa & cc) ^ (bb & cc); const t2 = (s0 + maj) | 0; [hh, gg, ff, ee, dd, cc, bb, aa] = [gg, ff, ee, (dd + t1) | 0, cc, bb, aa, (t1 + t2) | 0]; }
    [a, b, c, d, e, f, g, h] = [(a + aa) | 0, (b + bb) | 0, (c + cc) | 0, (d + dd) | 0, (e + ee) | 0, (f + ff) | 0, (g + gg) | 0, (h + hh) | 0];
  }
  return [a, b, c, d, e, f, g, h].map((value) => (value >>> 0).toString(16).padStart(8, "0")).join("");
}

let canonicalRuntimePromise: Promise<CanonicalRuntime> | undefined;

async function validateCanonicalRuntime(runtime: CanonicalRuntime, manifest: { approvalStatus?: string; datasetVersion?: string; artifactHashes?: Record<string, string> }, runtimeText: string): Promise<CanonicalRuntime> {
  if (runtime.approvalStatus !== "approvedCanonical" || manifest.approvalStatus !== "approvedCanonical") throw new CanonicalLocatorError("DATASET_NOT_APPROVED_CANONICAL");
  if (runtime.governorates.length !== 8 || runtime.districts.length !== 25 || runtime.districtEquivalents.length !== 1 || runtime.localities.length !== 1545) throw new CanonicalLocatorError("CANONICAL_RUNTIME_COUNTS_INVALID");
  const ids = [...runtime.governorates, ...runtime.districts, ...runtime.districtEquivalents, ...runtime.localities].map((item) => item.id);
  if (ids.length !== new Set(ids).size) throw new CanonicalLocatorError("DUPLICATE_CANONICAL_IDS");
  const expectedHash = manifest.artifactHashes?.["runtime.json"];
  return expectedHash && expectedHash !== "" ? globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(runtimeText)).then((digest) => {
    const actualHash = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
    if (actualHash !== expectedHash) throw new CanonicalLocatorError("CANONICAL_RUNTIME_HASH_MISMATCH");
    return runtime;
  }) : runtime;
}

export function loadCanonicalRuntime(fetchImpl: typeof fetch = fetch): Promise<CanonicalRuntime> {
  if (!canonicalRuntimePromise) {
    canonicalRuntimePromise = Promise.all([
      fetchImpl(CANONICAL_RUNTIME_URL).then((response) => response.ok ? response.text() : Promise.reject(new CanonicalLocatorError(`CANONICAL_RUNTIME_HTTP_${response.status}`))),
      fetchImpl(CANONICAL_MANIFEST_URL).then((response) => response.ok ? response.json() : Promise.reject(new CanonicalLocatorError(`CANONICAL_MANIFEST_HTTP_${response.status}`))),
    ]).then(([runtimeText, manifest]) => validateCanonicalRuntime(JSON.parse(runtimeText) as CanonicalRuntime, manifest, runtimeText)).catch((error) => {
      canonicalRuntimePromise = undefined;
      throw error;
    });
  }
  return canonicalRuntimePromise;
}

export function loadCanonicalLocatorDataset(input: { manifest: CanonicalDatasetManifest; dataset: Omit<CanonicalLocatorDataset, "manifest">; datasetText: string; expectedSha256?: string }): CanonicalLocatorCatalog {
  const expectedSha256 = input.expectedSha256 ?? sha256Hex(input.datasetText);
  const dataset: CanonicalLocatorDataset = { manifest: input.manifest, ...input.dataset };
  const validation = validateDataset(dataset, expectedSha256);
  if (!validation.ok) throw new CanonicalLocatorError(validation.issues.join(","));
  if (input.manifest.status !== "approvedCanonical") throw new CanonicalLocatorError("DATASET_NOT_APPROVED_CANONICAL");

  const districts = [...dataset.manifest.districts, ...dataset.manifest.districtEquivalents];
  const governorates = () => [...dataset.manifest.governorates].sort((a, b) => a.displayOrder - b.displayOrder || a.nameAr.localeCompare(b.nameAr, "ar"));
  const districtsFor = (governorateId?: string) => dataset.manifest.districts.filter((item) => !governorateId || item.governorateId === governorateId).sort(byArabicName);
  const localitiesFor = (districtOrEquivalentId: string) => dataset.localities.filter((item) => item.districtOrEquivalentId === districtOrEquivalentId).sort(byArabicName);
  const search = (query: string) => {
    const needle = normalize(query);
    if (!needle) return [];
    return dataset.localities.filter((item) => [item.nameAr, item.nameEn, item.nameFr, ...item.aliases].filter(Boolean).some((value) => normalize(String(value)).includes(needle))).sort(byArabicName);
  };
  return {
    dataset,
    validationResult: validation,
    search,
    lookup: (id) => dataset.localities.find((item) => item.id === id) ?? null,
    governorates,
    districts: districtsFor,
    localities: localitiesFor,
    aliases: () => [...dataset.aliases],
    validation: () => validation,
    listGovernorates: governorates,
    listDistricts: districtsFor,
    listDistrictOrEquivalents: (governorateId) => districts.filter((item) => !governorateId || item.governorateId === governorateId).sort(byArabicName),
    listLocalities: localitiesFor,
    searchLocalities: search,
  };
}

export function validateCanonicalLocatorDataset(dataset: CanonicalLocatorDataset, expectedSha256: string): DatasetValidationResult {
  return validateDataset(dataset, expectedSha256);
}
