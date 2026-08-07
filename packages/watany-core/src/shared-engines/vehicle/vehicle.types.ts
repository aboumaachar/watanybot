export type WatanyFuelType = "gasoline" | "diesel" | "hybrid" | "electric" | "other";
export type WatanyTransmissionType = "manual" | "automatic" | "other";

export interface WatanyVehicleType {
  id: string;
  nameAr: string;
  nameEn?: string;
  sortOrder: number;
}

export interface WatanyVehicleMake {
  id: string;
  nameAr: string;
  nameEn?: string;
  sortOrder: number;
}

export interface WatanyVehicleModel {
  id: string;
  makeId: string;
  nameAr: string;
  nameEn?: string;
  sortOrder: number;
}

export interface WatanyVehicleSelection {
  typeId?: string;
  makeId?: string;
  modelId?: string;
  year?: number;
  fuelType?: WatanyFuelType;
  transmission?: WatanyTransmissionType;
}
