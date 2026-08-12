/**
 * Inline salary routes — GET /api/salary, GET /api/salary/meta, POST /api/salary/calc.
 * Extracted from server.ts — these are the v4 pension calculator endpoints
 * (separate from the legacy routes/salary.js module).
 */
import type { FastifyPluginAsync } from "fastify";
import { normalizeArabic } from "@watany/shared/arabic";
import { Agent } from "undici";

const MOF_RETIRED_INFO_URL = "https://eservices.finance.gov.lb/RetiredInfo.aspx";
const MOF_RETIRED_INFO_BASE_URL = "https://eservices.finance.gov.lb/";
const MOF_REQUEST_TIMEOUT_MS = 20000;
const MOF_TLS_FALLBACK_AGENT = new Agent({ connect: { rejectUnauthorized: false } });
const MOF_GENERIC_VALIDATION_ERROR = "خطأ في رقم السجل أو في المعلومات المدخلة";
const MOF_UPSTREAM_UNAVAILABLE_ERROR = "تعذّر الوصول من الخادم إلى خدمة وزارة المالية الرسمية حالياً. يمكنك فتح المصدر الرسمي مباشرةً والمحاولة لاحقاً.";

interface PensionAttestationBody {
  fullName?: string;
  fatherName?: string;
  surname?: string;
  pensionNumber?: string;
}

interface SalaryKnowledgeBase {
  salariesIndex?: Record<string, Record<string, unknown>>;
  rankMeta?: Record<string, unknown>;
}

function salaryMetaCounts(kb: SalaryKnowledgeBase | null) {
  const rankMeta = (kb?.rankMeta || {}) as {
    ranks?: Array<{ maxDegree?: number }>;
    ornamentChoices?: Array<unknown>;
    sourceVersion?: string;
  };
  const ranks = Array.isArray(rankMeta.ranks) ? rankMeta.ranks : [];
  const rankCount = ranks.length;
  const degreeCount = ranks.reduce((sum, rankRow) => sum + Math.max(0, Number(rankRow?.maxDegree || 0)), 0);
  const ornamentChoices = Array.isArray(rankMeta.ornamentChoices) ? rankMeta.ornamentChoices : [];
  const medalCount = ornamentChoices.length;
  const salaryEntries = Object.keys(kb?.salariesIndex || {}).length;
  const metadataReady = rankCount > 0 && salaryEntries > 0;

  return {
    metadataReady,
    rankCount,
    degreeCount,
    medalCount,
    salaryEntries,
    sourceVersion: typeof rankMeta.sourceVersion === "string" ? rankMeta.sourceVersion : "",
  };
}

function extractHtmlField(html: string, fieldName: string): string {
  const pattern = new RegExp(`name=["']${fieldName}["'][^>]*value=["']([^"']*)["']`, "i");
  return pattern.exec(html)?.[1]?.trim() || "";
}

function extractHtmlFormAction(html: string, fallbackUrl: string): string {
  const action = /<form\b[^>]*action=["']([^"']*)["']/i.exec(html)?.[1]?.trim() || "";
  if (!action || /^javascript:/i.test(action)) {
    return fallbackUrl;
  }

  try {
    return new URL(action, fallbackUrl).toString();
  } catch {
    return fallbackUrl;
  }
}

function collectCookieHeader(response: Response): string {
  const responseHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof responseHeaders.getSetCookie === "function") {
    return responseHeaders.getSetCookie()
      .map((value) => value.split(";", 1)[0]?.trim())
      .filter(Boolean)
      .join("; ");
  }

  const raw = response.headers.get("set-cookie");
  return raw ? raw.split(";", 1)[0]?.trim() || "" : "";
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function extractMofErrorMessage(html: string): string {
  const errorMatch = /<span[^>]+(?:id|name)=["'][^"']*lblMessage[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(html);
  return errorMatch ? stripHtml(errorMatch[1]) : "";
}

function isMofErrQueryFailure(html: string): boolean {
  return /RetiredInfo\.aspx\?Err=1/i.test(html)
    && /name=["']txtfirstname["']/i.test(html)
    && /name=["']txtfathername["']/i.test(html)
    && /name=["']txtshohra["']/i.test(html)
    && /name=["']txttakaodNb["']/i.test(html);
}

function sanitizeOfficialDocumentHtml(html: string): string {
  let next = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  if (/<head[^>]*>/i.test(next)) {
    next = next.replace(/<head([^>]*)>/i, `<head$1><base href="${MOF_RETIRED_INFO_BASE_URL}" /><meta charset="utf-8" />`);
  } else {
    next = `<head><base href="${MOF_RETIRED_INFO_BASE_URL}" /><meta charset="utf-8" /></head>${next}`;
  }

  return next;
}

function isMofTlsVerificationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const directMessage = error.message || "";
  const cause = (error as any).cause as { code?: string; message?: string } | undefined;
  const causeMessage = cause?.message || "";
  const causeCode = cause?.code || "";

  return causeCode === "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
    || /unable to verify the first certificate/i.test(directMessage)
    || /unable to verify the first certificate/i.test(causeMessage)
    || /unable to verify the leaf signature/i.test(directMessage)
    || /unable to verify the leaf signature/i.test(causeMessage);
}

function serializeMofError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { value: error };
  }

  const cause = (error as Error & { cause?: { code?: string; message?: string } }).cause;
  return {
    name: error.name,
    message: error.message,
    causeCode: cause?.code,
    causeMessage: cause?.message,
  };
}

async function fetchMofWithTlsFallback(url: string, init: RequestInit, log: { warn: (context: Record<string, unknown>, message: string) => void }): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    if (!isMofTlsVerificationError(error)) {
      throw error;
    }

    log.warn({ url }, "MOF upstream TLS verification failed; retrying with certificate verification disabled for this host");
    return fetch(url, {
      ...(init as RequestInit & { dispatcher?: Agent }),
      ...(MOF_TLS_FALLBACK_AGENT ? ({ dispatcher: MOF_TLS_FALLBACK_AGENT } as any) : {}),
    });
  }
}

interface SalaryInlineRoutesOptions {
  getKb: () => SalaryKnowledgeBase | null;
}

function findSalaryRow(salariesIndex: Record<string, Record<string, unknown>>, rank: string, degree: string) {
  const exactKey = `${rank}||${degree}`;
  if (salariesIndex[exactKey]) return salariesIndex[exactKey];

  const normalizedRank = normalizeArabic(rank);
  for (const [key, value] of Object.entries(salariesIndex)) {
    const [rowRank, rowDegree] = key.split("||");
    if (rowDegree === degree && normalizeArabic(String(rowRank || "")) === normalizedRank) {
      return value;
    }
  }
  return null;
}

export const salaryInlineRoutes: FastifyPluginAsync<SalaryInlineRoutesOptions> = async (app, { getKb }) => {
  app.get("/api/salary", { config: { rateLimit: { max: 300, timeWindow: "1 minute" } } }, async (req, reply) => {
    const q = (req.query || {}) as Record<string, string | undefined>;
    const rank = String(q.rank || "").trim();
    const degree = (q.degree == null || String(q.degree).trim() === "") ? "1" : String(q.degree).trim();

    const kb = getKb();
    if (!kb?.salariesIndex) return reply.code(500).send({ ok: false, error: "KB not loaded" });

    const row = findSalaryRow(kb.salariesIndex, rank, degree);
    if (!row) return reply.code(404).send({ ok: false, error: "No salary found", rank, degree });

    return reply.send({
      ok: true,
      result: {
        rank_ar: row.rank,
        degree: row.degree,
        category: row.category,
        basicSalary: row.basicSalary,
        degreeValue: row.degreeValue,
        vetSalary: row.vetSalary,
        equipment: row.equipment,
        driver: row.driver,
        position: row.position,
        grant2025: row.grant2025,
        d13020: row.d13020,
        d11227_2: row.d11227_2,
        d11227_1: row.d11227_1,
        budget2022: row.budget2022,
        pension2026: row.pension2026,
        pension2026usd: row.pension2026usd,
        sixSalary: row.sixSalary,
        totalSalary2026usd: row.totalSalary2026usd,
      },
    });
  });

  // GET: salary KB metadata for the calculator UI
  app.get("/api/salary/meta", { config: { rateLimit: { max: 300, timeWindow: "1 minute" } } }, async (_req, reply) => {
    const kb = getKb();
    if (!kb) return reply.code(500).send({ ok: false, error: "KB not loaded" });
    const meta = kb.rankMeta || {};
    return reply.send({
      ok: true,
      ranks: meta.ranks || [],
      familyAllowance: meta.familyAllowance || { wife: 60000, perChild: 33000 },
      familyAllowanceAfterRaise: meta.familyAllowanceAfterRaise || { wife: 2100000, perChild: 1160000, note_ar: "القيم المقترحة بعد إقرار الزيادة في مجلس النواب" },
      ornamentChoices: meta.ornamentChoices || [],
      usdRate: meta.usdRate || 89500,
    });
  });

  // GET: compatibility endpoint expected by runtime smoke scripts
  app.get("/api/salary/grades", { config: { rateLimit: { max: 300, timeWindow: "1 minute" } } }, async (_req, reply) => {
    const kb = getKb();
    if (!kb) return reply.code(500).send({ ok: false, error: "KB not loaded" });

    const meta = kb.rankMeta || {};
    const ranks = Array.isArray((meta as { ranks?: unknown[] }).ranks)
      ? ((meta as { ranks?: Array<{ rank?: string; category?: string; maxDegree?: number }> }).ranks || [])
      : [];

    const grades = ranks
      .map((row) => {
        const rank = typeof row.rank === "string" ? row.rank.trim() : "";
        if (!rank) return null;

        const maxDegree = Math.max(1, Number(row.maxDegree || 1));
        return {
          rank,
          category: typeof row.category === "string" ? row.category : "",
          maxDegree,
          degrees: Array.from({ length: maxDegree }, (_unused, idx) => idx + 1),
        };
      })
      .filter((entry): entry is { rank: string; category: string; maxDegree: number; degrees: number[] } => entry !== null);

    return reply.send({ ok: true, count: grades.length, grades });
  });

  app.get("/api/salary/health", { config: { rateLimit: { max: 300, timeWindow: "1 minute" } } }, async (_req, reply) => {
    const kb = getKb();
    if (!kb) {
      return reply.code(503).send({
        ok: false,
        module: "salary",
        status: "server_unavailable",
        metadataReady: false,
        rankCount: 0,
        degreeCount: 0,
        medalCount: 0,
        sourceVersion: "",
        sourceFiles: ["kb/salaries/salariesIndex.json", "kb/salaries/rankMeta.json"],
        databaseConnected: false,
        checkedAt: new Date().toISOString(),
      });
    }

    const counts = salaryMetaCounts(kb);
    let status: "ready" | "partial_data_loaded" | "metadata_missing" = "metadata_missing";
    if (counts.metadataReady) {
      status = "ready";
    } else if (counts.rankCount > 0 || counts.salaryEntries > 0) {
      status = "partial_data_loaded";
    }

    return reply.send({
      ok: true,
      module: "salary",
      status,
      metadataReady: counts.metadataReady,
      rankCount: counts.rankCount,
      degreeCount: counts.degreeCount,
      medalCount: counts.medalCount,
      sourceVersion: counts.sourceVersion,
      sourceFiles: ["kb/salaries/salariesIndex.json", "kb/salaries/rankMeta.json"],
      databaseConnected: true,
      checkedAt: new Date().toISOString(),
    });
  });

  // POST: pension calculation — pension2026 (P) + family + medals
  app.post<{ Body: Record<string, unknown> }>("/api/salary/calc", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    const b = req.body || {};
    const rank = typeof b.rank === "string" ? b.rank.trim() : "";
    let degree = "1";
    if (typeof b.degree === "string") {
      degree = b.degree.trim() || "1";
    } else if (typeof b.degree === "number") {
      degree = String(b.degree);
    }
    if (!rank) return reply.code(400).send({ ok: false, error: "rank is required" });

    const kb = getKb();
    if (!kb?.salariesIndex) return reply.code(500).send({ ok: false, error: "KB not loaded" });

    const salariesIndex = kb.salariesIndex;
    const rankMeta = kb.rankMeta || {};
    const row = findSalaryRow(salariesIndex, rank, degree);
    if (!row) return reply.code(404).send({ ok: false, error: "No salary found", rank, degree });

    const basePension = Number(row.vetSalary || 0);
    const tableSupplements = Number(row.equipment || 0) + Number(row.driver || 0) + Number(row.position || 0);
    const socialAids = Number(row.grant2025 || 0)
      + Number(row.d13020 || 0)
      + Number(row.d11227_2 || 0)
      + Number(row.d11227_1 || 0)
      + Number(row.budget2022 || 0);
    const grossPension2026 = basePension + tableSupplements + socialAids;
    const deduction15Pct = Number(row.officialDeduction2026 || 0) > 0
      ? Number(row.officialDeduction2026)
      : Math.round(basePension * 0.015);
    const pension2026 = Math.max(0, grossPension2026 - deduction15Pct);
    const usdRate = Number(rankMeta.usdRate || 89500);

    // Family allowance
    const married = !!b.married;
    const kidsCount = Math.max(0, Number(b.kidsCount || 0));
    const fa = (rankMeta.familyAllowance || { wife: 60000, perChild: 33000 }) as { wife: number; perChild: number };
    const wifeAllowance = married ? fa.wife : 0;
    const childAllowance = kidsCount * fa.perChild;
    const familyTotal = wifeAllowance + childAllowance;

    // Medals
    const selectedOrnaments: string[] = Array.isArray(b.selectedOrnaments) ? b.selectedOrnaments as string[] : [];
    const ornChoices = (rankMeta.ornamentChoices || []) as Array<{ id: string; name_ar: string; monthlyValue: number; annualValue: number }>;
    const ornLookup: Record<string, typeof ornChoices[0]> = {};
    for (const o of ornChoices) ornLookup[o.id] = o;
    const medalItems: Array<{ id: string; name_ar: string; monthlyValue: number; annualValue: number }> = [];
    let medalsTotal = 0;
    for (const id of selectedOrnaments) {
      const o = ornLookup[id];
      if (!o) continue;
      const monthlyValue = o.monthlyValue;
      medalItems.push({ id: o.id, name_ar: o.name_ar, monthlyValue, annualValue: monthlyValue * 12 });
      medalsTotal += monthlyValue;
    }

    const totalPension = pension2026 + familyTotal + medalsTotal;
    const totalPensionUsd = totalPension / usdRate;

    // Section 2: 6th salary raise
    const sixSalary = Number(row.sixSalary || 0);
    const faAfterRaise = (rankMeta.familyAllowanceAfterRaise || { wife: 2100000, perChild: 1160000 }) as { wife: number; perChild: number };
    const wifeAfterRaise = married ? faAfterRaise.wife : 0;
    const childAfterRaise = kidsCount * faAfterRaise.perChild;
    const familyAfterRaiseTotal = wifeAfterRaise + childAfterRaise;
    const pensionAfterSixRaise = Math.max(0, grossPension2026 + sixSalary - deduction15Pct);
    const totalAfterSixRaise = pensionAfterSixRaise + familyAfterRaiseTotal + medalsTotal;
    const totalAfterSixRaiseUsd = totalAfterSixRaise / usdRate;

    // Section 3: 50% of 2019 raise
    const val2019 = Number(row.val2019 || 0);
    const val2019usd = Number(row.val2019usd || 0);
    const fiftyPctTargetUsd = Number(row.fiftyPct || 0);
    const fiftyPctTargetLbp = Math.round(fiftyPctTargetUsd * usdRate);
    const additionalRaise = Math.max(0, fiftyPctTargetLbp - grossPension2026);
    const pensionAfterFiftyPct = Math.max(0, grossPension2026 + additionalRaise - deduction15Pct);
    const totalAfterFiftyPct = pensionAfterFiftyPct + familyAfterRaiseTotal + medalsTotal;
    const totalAfterFiftyPctUsd = totalAfterFiftyPct / usdRate;

    return reply.send({
      ok: true,
      input: { rank, degree: Number(degree), category: row.category, married, kidsCount, selectedOrnaments },
      breakdown: {
        basicSalary: Number(row.basicSalary || 0),
        vetSalary: basePension,
        deduction15Pct,
        equipment: Number(row.equipment || 0),
        driver: Number(row.driver || 0),
        position: Number(row.position || 0),
        aids: {
          grant2025: Number(row.grant2025 || 0),
          d13020: Number(row.d13020 || 0),
          d11227_2: Number(row.d11227_2 || 0),
          d11227_1: Number(row.d11227_1 || 0),
          budget2022: Number(row.budget2022 || 0),
        },
        pension2026,
        pension2026usd: Math.round((pension2026 / usdRate) * 100) / 100,
        familyAllowance: { wife: wifeAllowance, children: childAllowance, total: familyTotal },
        medals: { items: medalItems, total: medalsTotal },
      },
      totalPension,
      totalPensionUsd: Math.round(totalPensionUsd * 100) / 100,
      raise: {
        sixSalary,
        pensionAfterSixRaise,
        pensionAfterSixRaiseUsd: Math.round((pensionAfterSixRaise / usdRate) * 100) / 100,
        familyAfterRaise: { wife: wifeAfterRaise, children: childAfterRaise, total: familyAfterRaiseTotal },
        totalAfterSixRaise,
        totalAfterSixRaiseUsd: Math.round(totalAfterSixRaiseUsd * 100) / 100,
        sixPct: Number(row.sixPct || 0),
      },
      fiftyPctRaise: {
        val2019,
        val2019usd: Math.round(val2019usd * 100) / 100,
        fiftyPctTargetUsd: Math.round(fiftyPctTargetUsd * 100) / 100,
        fiftyPctTargetLbp,
        additionalRaise,
        pensionAfterFiftyPct,
        pensionAfterFiftyPctUsd: Math.round((pensionAfterFiftyPct / usdRate) * 100) / 100,
        familyAfterRaise: { wife: wifeAfterRaise, children: childAfterRaise, total: familyAfterRaiseTotal },
        totalAfterFiftyPct,
        totalAfterFiftyPctUsd: Math.round(totalAfterFiftyPctUsd * 100) / 100,
      },
      usdRate,
    });
  });

  app.post<{ Body: PensionAttestationBody }>("/api/pension/attestation", async (req, reply) => {
    return reply.code(409).send({
      ok: false,
      error: "إفادة الراتب متاحة فقط عبر خدمة وزارة المالية الرسمية. افتح المصدر الرسمي مباشرةً من موطني.",
      source: "mof",
      sourceUrl: MOF_RETIRED_INFO_URL,
      reason: "external_only",
    });
  });
};
