import type { CollectionConfig } from "payload";
import { gatewaySsoStrategy } from "../auth/gatewaySsoStrategy";

export const GatewayAdmins: CollectionConfig = {
  slug: "gateway-admins",
  admin: { useAsTitle: "email" },
  auth: {
    disableLocalStrategy: true,
    strategies: [gatewaySsoStrategy],
  },
  fields: [
    { name: "gatewayUserId", type: "text", required: true, unique: true, index: true },
    { name: "email", type: "email", required: true },
    { name: "displayName", type: "text" },
    { name: "roleSnapshot", type: "text", required: true },
    { name: "capabilitySnapshot", type: "json" },
    { name: "lastAuthenticatedAt", type: "date" },
  ],
  access: {
    create: () => false,
    delete: () => false,
    update: () => false,
  },
};
