import type { AddressWidgetContract, AddressWidgetLabels, AddressWidgetValue } from "../contracts/address-widget-contract";

export const addressWidgetDefaultAdapter: AddressWidgetContract = {
  featureKey: "address-widget",
  version: "0.1.0",
  validateValue(value: AddressWidgetValue) {
    const errors: string[] = [];
    if (!value || typeof value !== "object") errors.push("Address value is required.");
    if (value?.latitude !== undefined && typeof value.latitude !== "number") errors.push("Latitude must be numeric.");
    if (value?.longitude !== undefined && typeof value.longitude !== "number") errors.push("Longitude must be numeric.");
    return { ok: errors.length === 0, errors };
  },
  getDefaultLabels(): AddressWidgetLabels {
    return {
      governorate: "Governorate",
      caza: "Caza",
      municipality: "Municipality",
      village: "Village",
      useGps: "Use GPS",
      useMap: "Use map"
    };
  }
};
