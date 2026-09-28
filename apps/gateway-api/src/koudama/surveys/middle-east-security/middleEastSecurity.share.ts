import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import * as XLSX from "xlsx";
import {
  getMiddleEastSecurityApplication,
  listAllMiddleEastSecurityApplications,
  listMiddleEastSecurityApplications,
} from "./middleEastSecurity.repository.js";
import type { MiddleEastSecurityApplication } from "./middleEastSecurity.types.js";

const SHARE_TOKEN_MIN_LENGTH = 32;
const SHARE_ROUTE_OPTIONS = {
  config: { public: true },
  logLevel: "silent" as const,
};

export type SharedMiddleEastSecurityApplication = {
  id: string;
  full_name: string;
  birth_date: string;
  age_years?: number | string;
  birth_place: string;
  address: string | null;
  mohafaza?: string;
  caza?: string;
  village?: string;
  phone: string;
  preferred_location: string;
  arabic_read: string;
  arabic_write: string;
  english_read: string;
  english_write: string;
  security_training: boolean;
  security_training_details?: string;
  ngo_experience: boolean;
  ngo_details?: string;
  notes?: string;
  status: string;
  followUpStatus: string;
  createdAt: string;
  updatedAt: string;
};

function configuredShareTokens(): string[] {
  return [
    process.env.MES_SHARE_TOKEN,
    ...(process.env.MES_SHARE_TOKENS || "").split(","),
  ].filter((value): value is string => Boolean(value && value.trim().length >= SHARE_TOKEN_MIN_LENGTH))
    .map((value) => value.trim());
}

export function isValidMiddleEastSecurityShareToken(token: string): boolean {
  const supplied = Buffer.from(token || "", "utf8");
  if (supplied.length < SHARE_TOKEN_MIN_LENGTH) return false;
  return configuredShareTokens().some((configured) => {
    const expected = Buffer.from(configured, "utf8");
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  });
}

export function toSharedMiddleEastSecurityApplication(
  item: MiddleEastSecurityApplication,
): SharedMiddleEastSecurityApplication {
  return {
    id: item.id,
    full_name: item.full_name,
    birth_date: item.birth_date,
    age_years: item.age_years,
    birth_place: item.birth_place,
    address: item.address ?? null,
    mohafaza: item.mohafaza ?? undefined,
    caza: item.caza ?? undefined,
    village: item.village ?? undefined,
    phone: item.phone,
    preferred_location: item.preferred_location,
    arabic_read: item.arabic_read,
    arabic_write: item.arabic_write,
    english_read: item.english_read,
    english_write: item.english_write,
    security_training: item.security_training === true || item.security_training === "true" || item.security_training === "نعم",
    security_training_details: item.security_training_details,
    ngo_experience: item.ngo_experience === true || item.ngo_experience === "true" || item.ngo_experience === "نعم",
    ngo_details: item.ngo_details,
    notes: item.notes,
    status: item.status,
    followUpStatus: item.followUpStatus,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function shareTokenFromRequest(request: any): string {
  return String(request.params?.shareToken ?? "");
}

function requireShareCapability(request: any, reply: any): boolean {
  reply.header("cache-control", "no-store").header("referrer-policy", "no-referrer");
  if (isValidMiddleEastSecurityShareToken(shareTokenFromRequest(request))) return true;
  reply.code(404).send({ error: "not_found" });
  return false;
}

function sharedFilters(request: any) {
  return {
    q: request.query?.q,
    status: request.query?.status,
    followUpStatus: request.query?.follow_up_status,
    page: request.query?.page,
    pageSize: request.query?.page_size,
  };
}

function exportRows(items: SharedMiddleEastSecurityApplication[]) {
  return items.map((item) => ({
    "Reference": item.id,
    "Full name": item.full_name,
    "Birth date": item.birth_date,
    "Age in years": item.age_years ?? "غير مسجل",
    "Birth place": item.birth_place,
    "Address": item.address || "",
    "Village": item.village || "",
    "Caza": item.caza || "",
    "Mohafaza": item.mohafaza || "",
    "Phone": item.phone,
    "Preferred location": item.preferred_location,
    "Arabic reading": item.arabic_read,
    "Arabic writing": item.arabic_write,
    "English reading": item.english_read,
    "English writing": item.english_write,
    "Previous security training": item.security_training ? "نعم" : "لا",
    "Security training details": item.security_training_details || "",
    "Previous NGO experience": item.ngo_experience ? "نعم" : "لا",
    "NGO details": item.ngo_details || "",
    "Notes": item.notes || "",
    "Status": item.status,
    "Follow-up": item.followUpStatus,
    "Submitted at": item.createdAt,
    "Updated at": item.updatedAt,
  }));
}

export async function registerMiddleEastSecurityShareRoutes(app: FastifyInstance): Promise<void> {
  const listPath = "/api/share/jobs/middle-east-security/:shareToken/applications";
  const detailPath = "/api/share/jobs/middle-east-security/:shareToken/applications/:id";
  const exportPath = "/api/share/jobs/middle-east-security/:shareToken/export.xlsx";

  app.get(listPath, SHARE_ROUTE_OPTIONS, async (request: any, reply) => {
    if (!requireShareCapability(request, reply)) return;
    try {
      const result = await listMiddleEastSecurityApplications(sharedFilters(request));
      return reply.send({
        ...result,
        items: result.items.map(toSharedMiddleEastSecurityApplication),
      });
    } catch (error) {
      request.log.error({ err: error }, "middle_east_security_share_list_failed");
      return reply.code(503).send({ error: "share_unavailable" });
    }
  });

  app.get(detailPath, SHARE_ROUTE_OPTIONS, async (request: any, reply) => {
    if (!requireShareCapability(request, reply)) return;
    try {
      const item = await getMiddleEastSecurityApplication(String(request.params?.id ?? ""));
      return item
        ? reply.send({ item: toSharedMiddleEastSecurityApplication(item) })
        : reply.code(404).send({ error: "not_found" });
    } catch (error) {
      request.log.error({ err: error }, "middle_east_security_share_detail_failed");
      return reply.code(503).send({ error: "share_unavailable" });
    }
  });

  app.get(exportPath, SHARE_ROUTE_OPTIONS, async (request: any, reply) => {
    if (!requireShareCapability(request, reply)) return;
    try {
      const result = await listAllMiddleEastSecurityApplications({
        q: request.query?.q,
        status: request.query?.status,
        followUpStatus: request.query?.follow_up_status,
      });
      const rows = exportRows(result.items.map(toSharedMiddleEastSecurityApplication));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Applications");
      const workbookBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
      const date = new Date().toISOString().slice(0, 10);
      return reply
        .header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("content-disposition", `attachment; filename="Middle_East_Security_Applications_${date}.xlsx"`)
        .send(workbookBuffer);
    } catch (error) {
      request.log.error({ err: error }, "middle_east_security_share_export_failed");
      return reply.code(503).send({ error: "export_unavailable" });
    }
  });
}
