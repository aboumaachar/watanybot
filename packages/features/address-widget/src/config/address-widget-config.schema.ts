export interface AddressWidgetConfig {
  language: "ar" | "en" | "mixed";
  requireGovernorate: boolean;
  requireCaza: boolean;
  requireMunicipality: boolean;
  requireVillage: boolean;
  enableGps: boolean;
  enableMap: boolean;
}

export const defaultAddressWidgetConfig: AddressWidgetConfig = {
  language: "ar",
  requireGovernorate: true,
  requireCaza: true,
  requireMunicipality: false,
  requireVillage: false,
  enableGps: true,
  enableMap: true
};
