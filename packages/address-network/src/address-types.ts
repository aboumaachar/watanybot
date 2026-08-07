export type AddressFeatureFlags = {
  forceSharedAddressWidgetAppwide: boolean;
  gpsEnabledByDefault: boolean;
  mapPinEnabledByDefault: boolean;
  manualAddressAllowed: boolean;
  superAdminCanOverrideDefaults: boolean;
  defaultGovernorateId?: string;
  defaultCazaId?: string;
  defaultMunicipalityId?: string;
  defaultVillageId?: string;
  dataQualityStatus: string;
};

export type AddressValue = {
  governorateId?: string;
  governorateName?: string;
  cazaId?: string;
  cazaName?: string;
  municipalityId?: string;
  municipalityName?: string;
  villageId?: string;
  villageName?: string;
  latitude?: number;
  longitude?: number;
  manualPin?: boolean;
  manualText?: string;
};

export interface AddressSelection extends AddressValue {}

export interface AddressWidgetValue extends AddressValue {}

export type AddressWidgetFeatureFlags = {
  gpsEnabled?: boolean;
  mapEnabled?: boolean;
  manualPinEnabled?: boolean;
};

export type AddressOption = {
  id: string;
  parentId?: string;
  labelAr: string;
  labelEn: string;
  enabled: boolean;
  latitude?: number;
  longitude?: number;
};

type AddressNamedRow = {
  id: string;
  nameAr: string;
  nameEn: string;
  enabled: boolean;
  latitude?: number;
  longitude?: number;
};

export interface AddressGovernorate extends AddressNamedRow {}

export interface AddressCaza extends AddressNamedRow {
  governorateId: string;
}

export interface AddressMunicipality extends AddressNamedRow {
  governorateId: string;
  cazaId: string;
}

export interface AddressVillage extends AddressNamedRow {
  governorateId: string;
  cazaId: string;
  municipalityId: string;
}