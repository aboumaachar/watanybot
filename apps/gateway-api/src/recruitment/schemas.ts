import { z } from "zod";

const isoDateStringSchema = z.string().trim().min(1).refine(
  (value) => Number.isFinite(Date.parse(value)),
  "invalid_datetime",
);

const optionalIsoDateStringSchema = z.union([isoDateStringSchema, z.null()]).optional();
const optionalTrimmedStringSchema = z.union([z.string().trim().min(1), z.null()]).optional();
const stringArraySchema = z.array(z.string().trim().min(1)).default([]);
const statusSchema = z.enum(["draft", "published", "expired", "cancelled"]);

export const recruitmentAnnouncementSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  apparatusName: z.string().trim().min(1),
  announcementNumber: z.string().trim().min(1).optional(),
  startDate: isoDateStringSchema.optional(),
  endDate: isoDateStringSchema.optional(),
  status: statusSchema,
  conditions: stringArraySchema,
  requiredDocuments: stringArraySchema,
  eligibleCategories: stringArraySchema,
  applicationLocation: z.string().trim().min(1).optional(),
  applicationMethod: z.string().trim().min(1).optional(),
  sourceName: z.string().trim().min(1).optional(),
  sourceUrl: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
  createdAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1),
  createdBy: z.string().trim().min(1),
});

export const recruitmentStoreSchema = z.object({
  announcements: z.array(recruitmentAnnouncementSchema).default([]),
});

export const recruitmentEntityParamsSchema = z.object({
  id: z.string().trim().min(1, "id required"),
});

export const createRecruitmentAnnouncementBodySchema = z.object({
  title: z.string().trim().min(1, "title required"),
  apparatusName: z.string().trim().min(1, "apparatusName required"),
  announcementNumber: optionalTrimmedStringSchema,
  startDate: optionalIsoDateStringSchema,
  endDate: optionalIsoDateStringSchema,
  status: statusSchema.default("draft"),
  conditions: stringArraySchema,
  requiredDocuments: stringArraySchema,
  eligibleCategories: stringArraySchema,
  applicationLocation: optionalTrimmedStringSchema,
  applicationMethod: optionalTrimmedStringSchema,
  sourceName: optionalTrimmedStringSchema,
  sourceUrl: optionalTrimmedStringSchema,
  notes: optionalTrimmedStringSchema,
});

export const updateRecruitmentAnnouncementBodySchema = z.object({
  title: z.string().trim().min(1).optional(),
  apparatusName: z.string().trim().min(1).optional(),
  announcementNumber: optionalTrimmedStringSchema,
  startDate: optionalIsoDateStringSchema,
  endDate: optionalIsoDateStringSchema,
  status: statusSchema.optional(),
  conditions: z.array(z.string().trim().min(1)).optional(),
  requiredDocuments: z.array(z.string().trim().min(1)).optional(),
  eligibleCategories: z.array(z.string().trim().min(1)).optional(),
  applicationLocation: optionalTrimmedStringSchema,
  applicationMethod: optionalTrimmedStringSchema,
  sourceName: optionalTrimmedStringSchema,
  sourceUrl: optionalTrimmedStringSchema,
  notes: optionalTrimmedStringSchema,
}).refine((value) => Object.values(value).some((entry) => entry !== undefined), {
  message: "at_least_one_field_required",
});

export const listRecruitmentAnnouncementsQuerySchema = z.object({
  status: statusSchema.optional(),
  apparatus: z.string().trim().min(1).optional(),
  publicOnly: z.coerce.boolean().optional().default(false),
});