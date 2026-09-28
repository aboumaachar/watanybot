import { promises as fs } from "node:fs";
import path from "node:path";
import type { MiddleEastSecurityInput } from "./middleEastSecurity.types.js";

type CanonicalRuntime = {
  approvalStatus?: string;
  datasetVersion?: string;
  governorates?: Array<{ id?: string; nameAr?: string }>;
  districts?: Array<{ id?: string; governorateId?: string; nameAr?: string }>;
  districtEquivalents?: Array<{ id?: string; governorateId?: string; nameAr?: string }>;
  localities?: Array<{ id?: string; governorateId?: string; districtId?: string; pcode?: string; nameAr?: string }>;
};

export type MiddleEastSecurityAddress = {
  address: string | null;
  mohafaza: string | null;
  mohafaza_id: string | null;
  caza: string | null;
  caza_id: string | null;
  village: string | null;
  village_id: string | null;
  village_pcode: string | null;
  location_dataset_version: string | null;
  location_approval_status: string | null;
};

const RUNTIME_PATHS = [
  path.resolve(process.cwd(), "apps", "web-user", "public", "data", "location", "canonical", "runtime.json"),
  path.resolve(process.cwd(), "apps", "web-user", "dist", "data", "location", "canonical", "runtime.json"),
  path.resolve(process.cwd(), "..", "web-user", "public", "data", "location", "canonical", "runtime.json"),
  path.resolve(process.cwd(), "..", "web-user", "dist", "data", "location", "canonical", "runtime.json"),
  path.resolve(process.cwd(), "packages", "lebanese-administrative-authority", "releases", "1.1.1", "runtime.json"),
  path.resolve(process.cwd(), "..", "..", "packages", "lebanese-administrative-authority", "releases", "1.1.1", "runtime.json"),
];

let runtimePromise: Promise<CanonicalRuntime> | undefined;

const clean = (value: unknown): string => String(value ?? "").trim();

async function loadCanonicalRuntime(): Promise<CanonicalRuntime> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      let lastError: unknown;
      for (const runtimePath of RUNTIME_PATHS) {
        try {
          const runtime = JSON.parse(await fs.readFile(runtimePath, "utf8")) as CanonicalRuntime;
          if (runtime.approvalStatus !== "approvedCanonical" || runtime.datasetVersion !== "1.1.1") {
            throw new Error("ADDRESS_DATASET_NOT_APPROVED");
          }
          if (
            runtime.governorates?.length !== 8
            || runtime.districts?.length !== 25
            || runtime.districtEquivalents?.length !== 1
            || runtime.localities?.length !== 1545
          ) {
            throw new Error("ADDRESS_DATASET_COUNTS_INVALID");
          }
          return runtime;
        } catch (error) {
          lastError = error;
        }
      }
      throw new Error(`ADDRESS_DATA_UNAVAILABLE:${lastError instanceof Error ? lastError.message : "runtime_not_found"}`);
    })().catch((error) => {
      runtimePromise = undefined;
      throw error;
    });
  }
  return runtimePromise;
}

function hasStructuredAddress(input: MiddleEastSecurityInput): boolean {
  return [
    input.mohafaza,
    input.mohafaza_id,
    input.caza,
    input.caza_id,
    input.village,
    input.village_id,
  ].some((value) => clean(value));
}

export async function resolveMiddleEastSecurityAddress(input: MiddleEastSecurityInput): Promise<MiddleEastSecurityAddress> {
  const legacyAddress = clean(input.address);
  if (!hasStructuredAddress(input)) {
    if (!legacyAddress) throw new Error("MISSING_REQUIRED_FIELD");
    return {
      address: legacyAddress,
      mohafaza: null,
      mohafaza_id: null,
      caza: null,
      caza_id: null,
      village: null,
      village_id: null,
      village_pcode: null,
      location_dataset_version: null,
      location_approval_status: null,
    };
  }

  const mohafazaId = clean(input.mohafaza_id);
  const cazaId = clean(input.caza_id);
  const villageId = clean(input.village_id);
  if (!mohafazaId || !cazaId || !villageId) throw new Error("MISSING_REQUIRED_FIELD");

  const runtime = await loadCanonicalRuntime();
  const governorate = runtime.governorates?.find((item) => item.id === mohafazaId);
  if (!governorate) throw new Error("INVALID_MOHAFAZA");

  const district = [...(runtime.districts ?? []), ...(runtime.districtEquivalents ?? [])]
    .find((item) => item.id === cazaId);
  if (!district || district.governorateId !== governorate.id) throw new Error("INVALID_CAZA_HIERARCHY");

  const locality = runtime.localities?.find((item) => item.id === villageId);
  if (!locality || locality.governorateId !== governorate.id || locality.districtId !== district.id) {
    throw new Error("INVALID_VILLAGE_HIERARCHY");
  }

  const suppliedLabels = [
    [input.mohafaza, governorate.nameAr],
    [input.caza, district.nameAr],
    [input.village, locality.nameAr],
  ] as const;
  if (suppliedLabels.some(([supplied, canonical]) => clean(supplied) && clean(supplied) !== clean(canonical))) {
    throw new Error("INVALID_ADDRESS_LABEL");
  }

  const mohafaza = clean(governorate.nameAr);
  const caza = clean(district.nameAr);
  const village = clean(locality.nameAr);
  return {
    address: legacyAddress || [mohafaza, caza, village].join(" - "),
    mohafaza,
    mohafaza_id: governorate.id || null,
    caza,
    caza_id: district.id || null,
    village,
    village_id: locality.id || null,
    village_pcode: clean(locality.pcode) || null,
    location_dataset_version: runtime.datasetVersion || null,
    location_approval_status: runtime.approvalStatus || null,
  };
}
