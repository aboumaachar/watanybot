export type ApprovedGovernorate = Readonly<{ id: string; nameAr: string; nameEn: string }>;
export type ApprovedDistrict = Readonly<{ id: string; governorateId: string; nameAr: string; nameEn: string }>;
export type ApprovedLocality = Readonly<{ id: string; governorateId: string; districtId: string; pcode: string; nameAr: string; nameEn: string; aliases: string[] }>;
export type ApprovedRuntime = Readonly<{
  schemaVersion: string;
  datasetId: string;
  datasetVersion: "1.1.1";
  approvalStatus: "approvedCanonical";
  governorates: ApprovedGovernorate[];
  districts: ApprovedDistrict[];
  districtEquivalents: ApprovedDistrict[];
  localities: ApprovedLocality[];
  aliases: ReadonlyArray<Record<string, unknown>>;
}>;

const RUNTIME_URL = "/data/location/canonical/runtime.json";
const MANIFEST_URL = "/data/location/canonical/manifest.json";
let runtimePromise: Promise<ApprovedRuntime> | undefined;

async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`UL2_RUNTIME_INVALID_${field}`);
  return value.trim();
}

function validateRows(runtime: ApprovedRuntime): ApprovedRuntime {
  if (runtime.approvalStatus !== "approvedCanonical" || runtime.datasetVersion !== "1.1.1") throw new Error("UL2_DATASET_NOT_APPROVED_CANONICAL");
  if (runtime.governorates.length !== 8 || runtime.districts.length !== 25 || runtime.districtEquivalents.length !== 1) throw new Error("UL2_HIERARCHY_COUNTS_INVALID");
  const governorateIds = new Set(runtime.governorates.map((item) => item.id));
  const districtIds = new Set([...runtime.districts, ...runtime.districtEquivalents].map((item) => item.id));
  if (governorateIds.size !== runtime.governorates.length || districtIds.size !== 26) throw new Error("UL2_DUPLICATE_CANONICAL_ID");
  for (const item of [...runtime.governorates, ...runtime.districts, ...runtime.districtEquivalents]) requireText(item.nameAr, "ARABIC_NAME");
  const localityIds = new Set<string>();
  for (const item of runtime.localities) {
    if (localityIds.has(item.id) || !governorateIds.has(item.governorateId) || !districtIds.has(item.districtId)) throw new Error("UL2_LOCALITY_INTEGRITY_INVALID");
    localityIds.add(item.id);
    requireText(item.nameAr, "LOCALITY_ARABIC_NAME");
  }
  return runtime;
}

export async function validateApprovedRuntime(runtime: ApprovedRuntime): Promise<ApprovedRuntime> {
  return validateRows(runtime);
}

export async function loadApprovedRuntime(fetchImpl: typeof fetch = fetch): Promise<ApprovedRuntime> {
  if (!runtimePromise) {
    runtimePromise = Promise.all([
      fetchImpl(RUNTIME_URL).then(async (response) => response.ok ? response.text() : Promise.reject(new Error(`UL2_RUNTIME_HTTP_${response.status}`))),
      fetchImpl(MANIFEST_URL).then((response) => response.ok ? response.json() : Promise.reject(new Error(`UL2_MANIFEST_HTTP_${response.status}`))),
    ]).then(async ([runtime, manifest]) => {
      if (manifest.approvalStatus !== "approvedCanonical" || manifest.datasetVersion !== "1.1.1") throw new Error("UL2_DATASET_NOT_APPROVED_CANONICAL");
      if (manifest.artifactHashes?.["runtime.json"] && manifest.artifactHashes["runtime.json"] !== await sha256Hex(runtime)) throw new Error("UL2_RUNTIME_HASH_MISMATCH");
      return validateRows(JSON.parse(runtime) as ApprovedRuntime);
    }).catch((error) => { runtimePromise = undefined; throw error; });
  }
  return runtimePromise;
}

export async function getGovernorates(): Promise<ApprovedGovernorate[]> { return (await loadApprovedRuntime()).governorates; }
export async function getDistricts(governorateId?: string): Promise<ApprovedDistrict[]> {
  const runtime = await loadApprovedRuntime();
  return [...runtime.districts, ...runtime.districtEquivalents].filter((item) => !governorateId || item.governorateId === governorateId);
}
export async function getLocalities(districtId?: string): Promise<ApprovedLocality[]> {
  return (await loadApprovedRuntime()).localities.filter((item) => !districtId || item.districtId === districtId);
}
export async function searchLocalities(query: string): Promise<ApprovedLocality[]> {
  const needle = query.trim().toLocaleLowerCase();
  return (await loadApprovedRuntime()).localities.filter((item) => [item.nameAr, item.nameEn, ...item.aliases].some((value) => value.toLocaleLowerCase().includes(needle)));
}
export async function resolveLegacyValue(value: string): Promise<ApprovedLocality | undefined> {
  const needle = value.trim().toLocaleLowerCase();
  return (await loadApprovedRuntime()).localities.find((item) => [item.nameAr, item.nameEn, ...item.aliases].some((candidate) => candidate.toLocaleLowerCase() === needle));
}
