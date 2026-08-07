export type Language = 'ar' | 'en' | 'fr' | 'arabizi' | 'historical' | 'keyboard';
export type DatasetStatus = 'candidate' | 'validation-failed' | 'ready-for-owner-review' | 'approvedCanonical' | 'retired' | 'superseded' | 'rejected';
export type LocalityKind = 'village' | 'town' | 'city' | 'neighborhood' | 'municipality' | 'populated-place';

export type CoordinateMethod = 'official-point' | 'official-boundary-centroid' | 'verified-boundary-centroid' | 'named-place-mean' | 'repository-reference' | 'missing';

export type Country = Readonly<{ id: 'LB'; nameAr: string; nameEn: string; nameFr?: string | null }>;
export type Governorate = AdministrativeNode & Readonly<{ countryId: 'LB'; officialCode?: string | null; pcode?: string | null; normalizedAr: string; normalizedLatin: string }>;
export type District = AdministrativeNode & Readonly<{ officialCode?: string | null; pcode?: string | null; isOfficialDistrict: boolean; isUiSelectionNode: boolean }>;
export type DistrictEquivalent = Readonly<{ id: string; governorateId: string; recordType: 'governorate-district-equivalent'; nameAr: string; nameEn?: string | null; isOfficialDistrict: false; isUiSelectionNode: true; active: boolean; sourceReferences: readonly Provenance[] }>;
export type Municipality = AdministrativeNode & Readonly<{ districtOrEquivalentId: string; officialCode?: string | null }>;

export type Provenance = Readonly<{
  sourceId: string;
  publisher: string;
  title: string;
  uri?: string;
  retrievedAt: string;
  recordReference: string;
  authorityLevel: 'official' | 'institutional' | 'operational' | 'secondary';
}>;

export type CanonicalLocality = Readonly<{
  id: string;
  countryCode: 'LB';
  governorateId: string;
  districtId: string;
  municipalityId?: string | null;
  cadastralCode?: string | null;
  pcode?: string | null;
  nameAr: string;
  nameEn?: string | null;
  nameFr?: string | null;
  kind: LocalityKind;
  latitude: number | null;
  longitude: number | null;
  coordinateMethod?: CoordinateMethod;
  coordinateSource?: string | null;
  coordinateAccuracy?: string | null;
  coordinateVerifiedStatus?: 'verified' | 'unverified' | 'missing';
  verifiedStatus?: 'verified' | 'unverified' | 'unresolved';
  aliases: readonly string[];
  provenance: readonly Provenance[];
  sourceRecordId: string;
  active: boolean;
}>;

export type AdministrativeNode = Readonly<{
  id: string;
  code: string;
  governorateId?: string;
  parentId?: string;
  nameAr: string;
  nameEn?: string | null;
  nameFr?: string | null;
  aliases: readonly string[];
  provenance: readonly Provenance[];
  active: boolean;
}>;

export type CanonicalAlias = Readonly<{
  id: string;
  value: string;
  normalizedValue: string;
  language: Language;
  localityId: string;
  provenance: readonly Provenance[];
  active: boolean;
}>;

export type DatasetStatistics = Readonly<{
  governorates: number;
  districts: number;
  municipalities: number;
  localities: number;
  aliases: number;
  localitiesWithCoordinates: number;
  missingArabic: number;
  duplicateIds: number;
  orphanRows: number;
}>;

export type DatasetManifest = Readonly<{
  datasetId: string;
  version: string;
  schemaVersion: string;
  status: DatasetStatus;
  approvalStatus?: DatasetStatus;
  generatedAt?: string;
  approvedAt?: string | null;
  approvedBy?: readonly string[];
  approvalReference?: string | null;
  minimumApplicationVersion?: string;
  canonicalSha256: string;
  aliasSha256: string;
  releasedAt: string | null;
  approval: Readonly<{
    approvedBy: readonly string[];
    approvedAt: string | null;
    decisionReference: string | null;
  }>;
  sources: readonly Provenance[];
  statistics: DatasetStatistics;
  validationSummary?: Readonly<Record<string, string | number>>;
  knownLimitations?: readonly string[];
}>;

export type AuthorityDataset = Readonly<{
  manifest: DatasetManifest;
  governorates: readonly AdministrativeNode[];
  districts: readonly AdministrativeNode[];
  municipalities: readonly AdministrativeNode[];
  localities: readonly CanonicalLocality[];
  aliases: readonly CanonicalAlias[];
}>;

export type ValidationResult = Readonly<{
  ok: boolean;
  productionReady: boolean;
  status: 'VERIFIED' | 'PARTIAL' | 'INVALID';
  issues: readonly string[];
  statistics: DatasetStatistics;
}>;

export type AdministrativePlatform = Readonly<{
  dataset: AuthorityDataset;
  validation: () => ValidationResult;
  governorates: () => readonly AdministrativeNode[];
  districts: (governorateId?: string) => readonly AdministrativeNode[];
  municipalities: (districtId?: string) => readonly AdministrativeNode[];
  localities: (parentId?: string) => readonly CanonicalLocality[];
  hierarchy: (localityId: string) => Readonly<{ governorate: AdministrativeNode | null; district: AdministrativeNode | null; municipality: AdministrativeNode | null; locality: CanonicalLocality | null }>;
  lookup: (id: string) => CanonicalLocality | AdministrativeNode | null;
  search: (query: string, options?: Readonly<{ mode?: 'exact' | 'prefix' | 'contains'; language?: Language }>) => readonly CanonicalLocality[];
  aliases: () => readonly CanonicalAlias[];
  statistics: () => DatasetStatistics;
}>;
