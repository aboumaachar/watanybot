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

export const Documents: CollectionConfig = {
  slug: "documents",
  versions: { drafts: true, maxPerDoc: 50 },
  admin: { useAsTitle: "canonicalId", defaultColumns: ["canonicalId", "titleAr", "_status", "updatedAt"] },
  access: {
    read: ({ req }) => hasGatewayCapability(req.user, "cms.read"),
    create: cmsCapability("cms.create").create,
    update: cmsCapability("cms.edit").update,
    delete: ({ req }) => hasGatewayCapability(req.user, "cms.archive"),
  },
  hooks: {
    beforeChange: [publicationAuthority],
  },
  fields: [
    { name: "canonicalId", type: "text", required: true, unique: true, index: true },
    { name: "businessIdentifier", type: "text", index: true },
    { name: "titleAr", type: "text", required: true },
    { name: "titleEn", type: "text" },
    { name: "descriptionAr", type: "textarea" },
    { name: "descriptionEn", type: "textarea" },
    { name: "officialReference", type: "text" },
    { name: "assetType", type: "text" },
    { name: "documentType", type: "text" },
    { name: "fileFormat", type: "text" },
    { name: "mimeType", type: "text" },
    { name: "originalFilename", type: "text" },
    { name: "storagePath", type: "text" },
    { name: "publicUrl", type: "text" },
    { name: "sourceAuthority", type: "text" },
    { name: "sourceUrl", type: "text" },
    { name: "publicationState", type: "select", required: true, defaultValue: "DRAFT", options: [{ label: "Draft", value: "DRAFT" }, { label: "Published", value: "PUBLISHED" }] },
    { name: "workflowStatus", type: "select", required: true, defaultValue: "DRAFT", options: [{ label: "Draft", value: "DRAFT" }, { label: "Published", value: "PUBLISHED" }] },
    { name: "sourceSystem", type: "text", defaultValue: "PAYLOAD_CMS" },
    { name: "tags", type: "array", fields: [{ name: "item", type: "text" }] },
    { name: "procedureRelations", type: "relationship", relationTo: "procedures", hasMany: true },
    { name: "sources", type: "array", fields: [{ name: "sourceId", type: "text" }, { name: "sourcePath", type: "text" }, { name: "anchor", type: "text" }] },
  ],
};