import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { requireRole } from "../auth/rbac.js";

const RANKS = new Set([
  "جندي", "جندي اول", "عريف", "عريف اول", "رقيب", "رقيب اول",
  "معاون", "معاون اول", "مؤهل", "مؤهل اول", "ملازم", "ملازم اول",
  "نقيب", "رائد", "مقدم", "عقيد", "عميد", "لواء", "عماد",
]);

const SERVICES = new Set([
  "الجيش اللبناني",
  "قوى الأمن الداخلي",
  "الأمن العام",
  "أمن الدولة",
  "شرطة مجلس النواب",
  "الجمارك",
]);

type AddressValue = {
  governorateId?: string;
  governorateName?: string;
  cazaId?: string;
  cazaName?: string;
  municipalityId?: string;
  municipalityName?: string;
  villageId?: string;
  villageName?: string;
  latitude?: number;
  longitude?: number;
  manualPin?: boolean;
  manualText?: string;
};

type Veterans2019Application = {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  service: string;
  rank: string;
  address: AddressValue;
  retirementDate: string;
  benchmarkCode: "BEFORE_2019_10_17" | "ON_OR_AFTER_2019_10_17";
  benchmarkLabel: string;
  depositMonth: string;
  depositYear: "2019" | "2020";
  amount: number;
  problemSummary?: string;
  submittedAt: string;
};

function cleanText(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function dataFilePath(): string {
  const configuredFile = cleanText(process.env.VETERANS_2019_DATA_FILE, 600);
  if (configuredFile) return path.resolve(configuredFile);

  const sharedMediaDir = cleanText(process.env.WATANY_ARTICLE_MEDIA_DIR, 600);
  if (sharedMediaDir) {
    return path.join(path.dirname(path.resolve(sharedMediaDir)), "veterans-2019", "applications.jsonl");
  }

  const cwd = process.cwd();
  const base = path.basename(cwd).toLowerCase() === "gateway-api"
    ? cwd
    : path.join(cwd, "apps", "gateway-api");
  return path.join(base, "data", "veterans-2019", "applications.jsonl");
}

function normalizeAddress(value: unknown): AddressValue {
  if (!value || typeof value !== "object") return {};
  const input = value as Record<string, unknown>;
  const numberOrUndefined = (candidate: unknown) => {
    const parsed = Number(candidate);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  return {
    governorateId: cleanText(input.governorateId, 120) || undefined,
    governorateName: cleanText(input.governorateName, 120) || undefined,
    cazaId: cleanText(input.cazaId, 120) || undefined,
    cazaName: cleanText(input.cazaName, 120) || undefined,
    municipalityId: cleanText(input.municipalityId, 120) || undefined,
    municipalityName: cleanText(input.municipalityName, 120) || undefined,
    villageId: cleanText(input.villageId, 120) || undefined,
    villageName: cleanText(input.villageName, 120) || undefined,
    latitude: numberOrUndefined(input.latitude),
    longitude: numberOrUndefined(input.longitude),
    manualPin: input.manualPin === true,
    manualText: cleanText(input.manualText, 300) || undefined,
  };
}

function benchmarkFor(retirementDate: string) {
  if (retirementDate < "2019-10-17") {
    return {
      code: "BEFORE_2019_10_17" as const,
      label: "قبل 17 تشرين الأول 2019",
    };
  }
  return {
    code: "ON_OR_AFTER_2019_10_17" as const,
    label: "في 17 تشرين الأول 2019 أو بعده",
  };
}

function validateBody(body: unknown): { ok: true; value: Omit<Veterans2019Application, "id" | "submittedAt" | "benchmarkCode" | "benchmarkLabel" | "depositYear"> } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "INVALID_BODY" };
  const input = body as Record<string, unknown>;
  const fullName = cleanText(input.fullName, 150);
  const phone = cleanText(input.phone, 40);
  const email = cleanText(input.email, 180);
  const service = cleanText(input.service, 100);
  const rank = cleanText(input.rank, 80);
  const retirementDate = cleanText(input.retirementDate, 10);
  const depositMonth = cleanText(input.depositMonth, 7);
  const amount = Number(input.amount);
  const problemSummary = cleanText(input.problemSummary, 500);
  const address = normalizeAddress(input.address);

  if (fullName.length < 3) return { ok: false, error: "FULL_NAME_REQUIRED" };
  if (phone.length < 5) return { ok: false, error: "PHONE_REQUIRED" };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) return { ok: false, error: "EMAIL_INVALID" };
  if (!SERVICES.has(service)) return { ok: false, error: "SERVICE_INVALID" };
  if (!RANKS.has(rank)) return { ok: false, error: "RANK_INVALID" };
  if (!/^2019-\d{2}-\d{2}$/u.test(retirementDate) || retirementDate < "2019-01-01" || retirementDate > "2019-12-31") {
    return { ok: false, error: "RETIREMENT_DATE_INVALID" };
  }
  if (!/^(2019|2020)-(0[1-9]|1[0-2])$/u.test(depositMonth)) return { ok: false, error: "DEPOSIT_MONTH_INVALID" };
  if (!Number.isFinite(amount)) return { ok: false, error: "AMOUNT_INVALID" };
  if (!address.governorateId || !address.cazaId) return { ok: false, error: "ADDRESS_REQUIRED" };

  return {
    ok: true,
    value: { fullName, phone, email: email || undefined, service, rank, address, retirementDate, depositMonth, amount, problemSummary: problemSummary || undefined },
  };
}

async function appendApplication(record: Veterans2019Application): Promise<void> {
  const file = dataFilePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(record)}\n`, "utf8");
}

async function readApplications(): Promise<Veterans2019Application[]> {
  const file = dataFilePath();
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const records: Veterans2019Application[] = [];
  const lines = raw.split(/\r?\n/u).filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    try {
      records.push(JSON.parse(lines[index]) as Veterans2019Application);
    } catch {
      throw new Error(`VETERANS_2019_STORE_CORRUPT_LINE_${index + 1}`);
    }
  }
  return records.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

function addressSummary(address: AddressValue): string {
  return [
    address.governorateName || address.governorateId,
    address.cazaName || address.cazaId,
    address.villageName || address.villageId,
  ].filter(Boolean).join(" - ");
}

function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[=+\-@]/u.test(text)) text = `'${text}`;
  return `"${text.replace(/"/gu, '""')}"`;
}

function toCsv(records: Veterans2019Application[]): string {
  const header = [
    "رقم الطلب", "الاسم الثلاثي", "الهاتف", "البريد الإلكتروني", "السلك", "الرتبة",
    "العنوان", "المشكلة باختصار", "تاريخ التقاعد", "تصنيف 17 تشرين", "شهر/سنة دخول التعويض",
    "القيمة التقريبية ل.ل.", "تاريخ التسجيل",
  ];
  const rows = records.map((record) => [
    record.id, record.fullName, record.phone, record.email || "", record.service, record.rank,
    addressSummary(record.address), record.problemSummary || "", record.retirementDate, record.benchmarkLabel, record.depositMonth,
    record.amount, record.submittedAt,
  ]);
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

export async function veterans2019Routes(server: FastifyInstance): Promise<void> {
  server.post("/api/veterans-2019/applications", async (request, reply) => {
    if (process.env.VETERANS_2019_SURVEY_OPEN !== "1") {
      return reply.code(410).send({ ok: false, error: "SURVEY_CLOSED" });
    }
    const validated = validateBody(request.body);
    if (!validated.ok) return reply.code(400).send({ ok: false, error: validated.error });

    const submittedAt = new Date().toISOString();
    const benchmark = benchmarkFor(validated.value.retirementDate);
    const compactDate = submittedAt.slice(0, 10).replace(/-/gu, "");
    const record: Veterans2019Application = {
      id: `VET2019-${compactDate}-${randomUUID().slice(0, 8).toUpperCase()}`,
      ...validated.value,
      benchmarkCode: benchmark.code,
      benchmarkLabel: benchmark.label,
      depositYear: validated.value.depositMonth.slice(0, 4) as "2019" | "2020",
      submittedAt,
    };
    await appendApplication(record);
    return reply.code(201).send({ ok: true, applicationId: record.id, submittedAt: record.submittedAt });
  });

  server.get("/api/veterans-2019/applications", { preHandler: requireRole("admin") }, async () => {
    const applications = await readApplications();
    return { ok: true, count: applications.length, applications };
  });

  server.get("/api/veterans-2019/applications/export.csv", { preHandler: requireRole("admin") }, async (_request, reply) => {
    const applications = await readApplications();
    return reply
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", 'attachment; filename="veterans-2019-applications.csv"')
      .send(toCsv(applications));
  });

  server.get("/api/veterans-2019/applications/export.json", { preHandler: requireRole("admin") }, async (_request, reply) => {
    const applications = await readApplications();
    return reply
      .header("content-type", "application/json; charset=utf-8")
      .header("content-disposition", 'attachment; filename="veterans-2019-applications.json"')
      .send({ ok: true, count: applications.length, applications });
  });
}

export default veterans2019Routes;
