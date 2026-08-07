export type WatanyAddressMode = "registration" | "display" | "search" | "map" | "analytics";

export interface WatanyGovernorate {
  id: string;
  nameAr: string;
  nameEn?: string;
  sortOrder: number;
}

export interface WatanyCaza {
  id: string;
  governorateId: string;
  nameAr: string;
  nameEn?: string;
  sortOrder: number;
}

export interface WatanyMunicipality {
  id: string;
  cazaId: string;
  nameAr: string;
  nameEn?: string;
  sortOrder: number;
}

export interface WatanyVillage {
  id: string;
  municipalityId?: string;
  cazaId: string;
  nameAr: string;
  nameEn?: string;
  sortOrder: number;
}

export interface WatanyAddressSelection {
  governorateId?: string;
  cazaId?: string;
  municipalityId?: string;
  villageId?: string;
  gpsLat?: number;
  gpsLng?: number;
}

export interface WatanyAddressDisplay {
  selection: WatanyAddressSelection;
  labelAr: string;
  labelEn?: string;
}

export interface WatanyAddressCatalog {
  governorates: WatanyGovernorate[];
  cazas: WatanyCaza[];
  municipalities: WatanyMunicipality[];
  villages: WatanyVillage[];
}
