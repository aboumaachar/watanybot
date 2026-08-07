export type LocalityType =
  | "village"
  | "town"
  | "city"
  | "neighborhood"
  | "municipality"
  | "cadastral-locality"
  | "populated-place"
  | "administrative-center";

export type VerifiedStatus = "verified" | "unverified" | "needs-review" | "rejected";

export type CanonicalGovernorate = Readonly<{
  id: string;
  canonicalCode: string;
  pcode?: string;
  nameAr: string;
  nameEn?: string;
  nameFr?: string;
  normalizedName: string;
  latitude?: number | null;
  longitude?: number | null;
  boundaryReference?: string | null;
  displayOrder: number;
  active: boolean;
  datasetVersion: string;
  sourceReference: string;
}>;

export type CanonicalDistrict = Readonly<{
  id: string;
  governorateId: string;
  canonicalCode: string;
  pcode?: string;
  nameAr: string;
  nameEn?: string;
  nameFr?: string;
  aliases: string[];
  latitude?: number | null;
  longitude?: number | null;
  isBeirutEquivalent: false;
  active: boolean;
  datasetVersion: string;
  sourceReference: string;
}>;

export type CanonicalDistrictEquivalent = Readonly<{
  id: string;
  governorateId: string;
  canonicalCode: string;
  nameAr: string;
  nameEn?: string;
  aliases: string[];
  equivalentTo?: string;
  isBeirutEquivalent: boolean;
  active: boolean;
  datasetVersion: string;
  sourceReference: string;
}>;

export type CanonicalLocality = Readonly<{
  id: string;
  governorateId: string;
  districtOrEquivalentId: string;
  nameAr: string | null;
  nameEn?: string | null;
  nameFr?: string | null;
  aliases: string[];
  localityType: LocalityType;
  latitude: number | null;
  longitude: number | null;
  sourceDatasetId: string;
  sourceRecordId: string;
  verifiedStatus: VerifiedStatus;
}>;

export type CanonicalLocalityAlias = Readonly<{
  id: string;
  localityId: string;
  value: string;
  normalizedValue: string;
  language: "ar" | "en" | "fr" | "arabizi" | "historical" | "keyboard";
  sourceReference: string;
  active: boolean;
}>;

export type CanonicalDatasetManifest = Readonly<{
  datasetId: string;
  version: string;
  status: "approvedCanonical" | "candidate" | "rejected";
  sha256: string;
  sourceReference: string;
  governorates: CanonicalGovernorate[];
  districts: CanonicalDistrict[];
  districtEquivalents: CanonicalDistrictEquivalent[];
}>;

export type CanonicalLocatorDataset = Readonly<{
  manifest: CanonicalDatasetManifest;
  localities: CanonicalLocality[];
  aliases: CanonicalLocalityAlias[];
}>;

export type DatasetValidationResult = Readonly<{
  ok: boolean;
  productionReady: boolean;
  status: "VERIFIED" | "PARTIAL" | "INVALID";
  issues: string[];
  counts: Readonly<{
    governorates: number;
    officialDistricts: number;
    districtEquivalents: number;
    uiDistrictNodes: number;
    localities: number;
    arabicNameMissing: number;
    coordinatesMissing: number;
    duplicateIds: number;
    orphanDistricts: number;
    orphanLocalities: number;
  }>;
}>;

export type CanonicalLocatorCatalog = Readonly<{
  dataset: CanonicalLocatorDataset;
  validationResult: DatasetValidationResult;
  search(query: string): CanonicalLocality[];
  lookup(id: string): CanonicalLocality | null;
  governorates(): CanonicalGovernorate[];
  districts(governorateId?: string): CanonicalDistrict[];
  localities(districtOrEquivalentId: string): CanonicalLocality[];
  aliases(): CanonicalLocalityAlias[];
  validation(): DatasetValidationResult;
  listGovernorates(): CanonicalGovernorate[];
  listDistricts(governorateId?: string): CanonicalDistrict[];
  listDistrictOrEquivalents(governorateId?: string): Array<CanonicalDistrict | CanonicalDistrictEquivalent>;
  listLocalities(districtOrEquivalentId: string): CanonicalLocality[];
  searchLocalities(query: string): CanonicalLocality[];
}>;
