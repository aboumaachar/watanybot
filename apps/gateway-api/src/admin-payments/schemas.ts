import { z } from "zod";

const isoDateTimeStringSchema = z.string().trim().min(1).refine(
  (value) => Number.isFinite(Date.parse(value)),
  "invalid_datetime",
);

const nullableIsoDateTimeSchema = z.union([isoDateTimeStringSchema, z.null()]);

export const paymentQuestionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const paymentAnswerSchema = z.object({
  id: z.string().min(1),
  questionId: z.string().min(1),
  value: z.string().min(1),
  isActive: z.boolean(),
  activateAt: nullableIsoDateTimeSchema.default(null),
  expiresAt: nullableIsoDateTimeSchema.default(null),
  createdAt: z.string().min(1),
  createdBy: z.string().min(1),
});

export const announcementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  enabled: z.boolean(),
  createdAt: z.string().min(1),
});

export const adminPaymentsStoreSchema = z.object({
  questions: z.array(paymentQuestionSchema).default([]),
  answers: z.array(paymentAnswerSchema).default([]),
  announcements: z.array(announcementSchema).default([]),
});

export const createQuestionBodySchema = z.object({
  text: z.string().trim().min(1, "text required"),
  tags: z.array(z.string().trim().min(1)).default([]),
});

export const updateQuestionBodySchema = z.object({
  text: z.string().trim().min(1).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
}).refine((value) => value.text !== undefined || value.tags !== undefined, {
  message: "at_least_one_field_required",
});

export const createAnswerBodySchema = z.object({
  questionId: z.string().trim().min(1, "questionId required"),
  value: z.string().trim().min(1, "value required"),
  activateAt: nullableIsoDateTimeSchema.optional(),
  expiresAt: nullableIsoDateTimeSchema.optional(),
});

export const updateAnswerBodySchema = z.object({
  questionId: z.string().trim().min(1).optional(),
  value: z.string().trim().min(1).optional(),
  activateAt: nullableIsoDateTimeSchema.optional(),
  expiresAt: nullableIsoDateTimeSchema.optional(),
}).refine(
  (value) => value.questionId !== undefined
    || value.value !== undefined
    || value.activateAt !== undefined
    || value.expiresAt !== undefined,
  { message: "at_least_one_field_required" },
);

export const createAnnouncementBodySchema = z.object({
  text: z.string().trim().min(1, "text required"),
});

export const toggleAnnouncementBodySchema = z.object({
  enabled: z.boolean(),
});

export const adminPaymentsEntityParamsSchema = z.object({
  id: z.string().trim().min(1, "id required"),
});

export const listAnswersQuerySchema = z.object({
  questionId: z.string().trim().min(1).optional(),
  activeOnly: z.coerce.boolean().optional().default(false),
  scheduledOnly: z.coerce.boolean().optional().default(false),
});

export const listAnnouncementsQuerySchema = z.object({
  enabledOnly: z.coerce.boolean().optional().default(false),
});