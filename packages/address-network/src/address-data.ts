import type {
  AddressCaza,
  AddressFeatureFlags,
  AddressGovernorate,
  AddressMunicipality,
  AddressOption,
  AddressVillage
} from "./address-types";

export const defaultAddressFeatureFlags: AddressFeatureFlags = {
  forceSharedAddressWidgetAppwide: true,
  gpsEnabledByDefault: false,
  mapPinEnabledByDefault: false,
  manualAddressAllowed: true,
  superAdminCanOverrideDefaults: true,
  defaultGovernorateId: "MLB",
  defaultCazaId: "MLB-KES",
  defaultMunicipalityId: "MUN-JOUNIEH",
  defaultVillageId: "VIL-SARBA",
  dataQualityStatus: "SEED_REVIEW_REQUIRED"
};

export const GOVERNORATES: AddressGovernorate[] = [
  { id: "BEY", nameAr: "بيروت", nameEn: "Beirut", enabled: true },
  { id: "MLB", nameAr: "جبل لبنان", nameEn: "Mount Lebanon", enabled: true },
  { id: "NLB", nameAr: "الشمال", nameEn: "North Lebanon", enabled: true },
  { id: "AKK", nameAr: "عكار", nameEn: "Akkar", enabled: true },
  { id: "BEQ", nameAr: "البقاع", nameEn: "Bekaa", enabled: true },
  { id: "BHB", nameAr: "بعلبك الهرمل", nameEn: "Baalbek-Hermel", enabled: true },
  { id: "SLB", nameAr: "الجنوب", nameEn: "South Lebanon", enabled: true },
  { id: "NAB", nameAr: "النبطية", nameEn: "Nabatieh", enabled: true }
];

export const CAZAS: AddressCaza[] = [
  { id: "MLB-KES", governorateId: "MLB", nameAr: "كسروان", nameEn: "Keserwan", enabled: true },
  { id: "BEY-BEY", governorateId: "BEY", nameAr: "بيروت", nameEn: "Beirut", enabled: true }
];

export const MUNICIPALITIES: AddressMunicipality[] = [
  {
    id: "MUN-JOUNIEH",
    governorateId: "MLB",
    cazaId: "MLB-KES",
    nameAr: "جونية",
    nameEn: "Jounieh",
    enabled: true,
    latitude: 33.9808,
    longitude: 35.6178
  },
  {
    id: "MUN-BEIRUT",
    governorateId: "BEY",
    cazaId: "BEY-BEY",
    nameAr: "بلدية بيروت",
    nameEn: "Beirut Municipality",
    enabled: true,
    latitude: 33.8938,
    longitude: 35.5018
  }
];

export const VILLAGES: AddressVillage[] = [
  {
    id: "VIL-SARBA",
    governorateId: "MLB",
    cazaId: "MLB-KES",
    municipalityId: "MUN-JOUNIEH",
    nameAr: "صربا",
    nameEn: "Sarba",
    enabled: true,
    latitude: 33.9797,
    longitude: 35.6311
  },
  {
    id: "VIL-JOUNIEH",
    governorateId: "MLB",
    cazaId: "MLB-KES",
    municipalityId: "MUN-JOUNIEH",
    nameAr: "جونية",
    nameEn: "Jounieh",
    enabled: true,
    latitude: 33.9808,
    longitude: 35.6178
  },
  {
    id: "VIL-BEIRUT-CENTRAL",
    governorateId: "BEY",
    cazaId: "BEY-BEY",
    municipalityId: "MUN-BEIRUT",
    nameAr: "بيروت",
    nameEn: "Beirut",
    enabled: true,
    latitude: 33.8938,
    longitude: 35.5018
  }
];

function toOption(
  row: {
    id: string;
    nameAr: string;
    nameEn: string;
    enabled: boolean;
    latitude?: number;
    longitude?: number;
  },
  parentId?: string
): AddressOption {
  return {
    id: row.id,
    parentId,
    labelAr: row.nameAr,
    labelEn: row.nameEn,
    enabled: row.enabled,
    latitude: row.latitude,
    longitude: row.longitude
  };
}

export const governorateOptions: AddressOption[] = GOVERNORATES.map((row) => toOption(row));

export const cazaOptions: AddressOption[] = CAZAS.map((row) => toOption(row, row.governorateId));

export const municipalityOptions: AddressOption[] = MUNICIPALITIES.map((row) => toOption(row, row.cazaId));

export const villageOptions: AddressOption[] = VILLAGES.map((row) => toOption(row, row.municipalityId));