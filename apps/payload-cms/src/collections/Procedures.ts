import type { CollectionConfig } from "payload";
import { hasGatewayCapability } from "../auth/gatewayCapability";

const cmsCapability = (capability: string) => ({
  create: ({ req }: { req: { user?: unknown } }) => hasGatewayCapability(req.user, capability),
  update: ({ req }: { req: { user?: unknown } }) => hasGatewayCapability(req.user, capability),
});

const publicationAuthority = async ({ data, originalDoc, req }: {
  data?: Record<string, unknown>;
  originalDoc?: Record<string, unknown>;
  req: { user?: unknown };
}) => {
  const incomingStatus = data?._status === "published";
  const originalStatus = originalDoc?._status === "published";
  const publicationChanged = incomingStatus !== originalStatus;
  const publishedContentChanged = originalStatus && !publicationChanged;

  if ((incomingStatus || publicationChanged || publishedContentChanged)
    && !hasGatewayCapability(req.user, "cms.publish")) {
    throw new Error("CMS_PUBLISH_CAPABILITY_REQUIRED");
  }
};

export const Procedures: CollectionConfig = {
  slug: "procedures",
  versions: { drafts: true, maxPerDoc: 50 },
  admin: { useAsTitle: "procedureCode", defaultColumns: ["procedureCode", "title", "_status", "updatedAt"] },
  access: {
    read: ({ req }) => hasGatewayCapability(req.user, "cms.read"),
    create: cmsCapability("cms.create").create,
    update: cmsCapability("cms.edit").update,
    delete: ({ req }) => hasGatewayCapability(req.user, "cms.archive"),
  },
  hooks: {
    beforeChange: [publicationAuthority],
    beforeValidate: [({ data }) => {
      if (data?.procedureCode && !data.canonicalId) return { ...data, canonicalId: String(data.procedureCode) };
      if (data?.procedureCode && !/^proc-[a-z0-9]+$/i.test(String(data.procedureCode))) throw new Error("procedureCode must match proc-xxxx");
      return data;
    }],
  },
  fields: [
    { name: "canonicalId", type: "text", required: true, unique: true, index: true },
    { name: "procedureCode", type: "text", required: true, unique: true, index: true, admin: { description: "Stable WATANYBOT identity, format proc-xxxx." } },
    { name: "slug", type: "text", required: true, unique: true, index: true },
    { name: "title", type: "text", required: true, localized: true },
    { name: "summary", type: "textarea", localized: true },
    { name: "category", type: "text" },
    { name: "eligibility", type: "array", localized: true, fields: [{ name: "item", type: "text" }] },
    { name: "requirements", type: "array", localized: true, fields: [{ name: "item", type: "text" }] },
    { name: "steps", type: "array", localized: true, fields: [{ name: "item", type: "text" }] },
    { name: "fees", type: "array", fields: [{ name: "item", type: "text" }] },
    { name: "processingTime", type: "text", localized: true },
    { name: "locations", type: "array", localized: true, fields: [{ name: "item", type: "text" }] },
    { name: "contacts", type: "array", localized: true, fields: [{ name: "item", type: "text" }] },
    { name: "sourceAuthority", type: "text", required: true },
    { name: "sourceUrl", type: "text" },
    { name: "lastVerifiedAt", type: "date" },
    { name: "verifiedBy", type: "text" },
    { name: "reviewDueAt", type: "date" },
    { name: "notes", type: "textarea", localized: true },
    { name: "publicationState", type: "select", required: true, defaultValue: "DRAFT", options: [{ label: "Draft", value: "DRAFT" }, { label: "Published", value: "PUBLISHED" }] },
    { name: "workflowStatus", type: "select", required: true, defaultValue: "DRAFT", options: [{ label: "Draft", value: "DRAFT" }, { label: "Published", value: "PUBLISHED" }] },
    { name: "sourceSystem", type: "text", defaultValue: "PAYLOAD_CMS" },
  ],
};
