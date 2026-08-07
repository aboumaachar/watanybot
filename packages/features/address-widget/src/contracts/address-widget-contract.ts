export type AddressWidgetSource = "manual-select" | "gps" | "map" | "imported";

export interface AddressWidgetValue {
  governorateId?: string;
  cazaId?: string;
  municipalityId?: string;
  villageId?: string;
  latitude?: number;
  longitude?: number;
  source?: AddressWidgetSource;
}

export interface AddressWidgetLabels {
  governorate: string;
  caza: string;
  municipality: string;
  village: string;
  useGps: string;
  useMap: string;
}

export interface AddressWidgetContract {
  featureKey: "address-widget";
  version: string;
  validateValue(value: AddressWidgetValue): { ok: boolean; errors: string[] };
  getDefaultLabels(): AddressWidgetLabels;
}
