/**
 * Watany - Build KB (index.html + Daleel.docx + قانون الدفاع الوطني.txt)
 * AND build Salary Calculator model (salaries.xlsx) in one run.
 *
 * Run:
 *   npm i
 *   npx ts-node scripts/build_kb_and_salary.ts
 *
 * Expected local project paths (adjust if needed):
 *   ./doc/index.html
 *   ./doc/Daleel.docx
 *   ./doc/قانون الدفاع الوطني.txt
 *   ./doc/salaries.xlsx
 *
 * Output:
 *   ./out/kb_chunks.jsonl
 *   ./out/forms_catalog.json
 *   ./out/salary_rules.json
 *   ./out/salary_test_cases.json
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

// npm i cheerio mammoth xlsx zod
import * as cheerio from "cheerio";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { z } from "zod";

type KBChunk = {
  id: string;
  source: "index.html" | "Daleel.docx" | "defense_law";
  title: string;
  text: string;
  url?: string;
  tags: string[];
  metadata: Record<string, any>;
};

type FormLink = {
  label_ar: string;
  url: string;
  form_code?: string; // e.g. "ت7"
  category?: string;  // e.g. "مستندات اعادة التخصيص الأساسية"
};

type DaleelCase = {
  case_no?: number;           // "المعاملة رقم 30"
  title?: string;             // short title
  audience_scope?: string;    // RET_GENERAL, ...
  domain?: string;            // pension_payment, ...
  life_event?: string;        // divorce, death, ...
  mentioned_forms?: string[]; // ت2, ت12 ...
  phones?: string[];
  links?: string[];
  eligibility?: string;
  required_docs?: string[];
  reference_text?: string;
};

type SalaryInput = {
  rank: string;          // e.g. "جندي"
  degree: number;        // step/degree number
  isRetired: boolean;    // always true for your use-case, but keep flexible
  isMarried: boolean;
  kidsCount: number;
  ornamentsType?: string;   // tbd
  socialAid?: number;       // optional extra or override
  specialCategory?: "OFFICER" | "MOAHEL" | "MOAHEL_AWAL" | "OTHER";
};

type SalaryResult = {
  baseSalary: number;
  retiredDeduction: number;
  familyAllowance: number;
  ornamentsValue: number;
  socialAid: number;
  total: number;
  breakdown: Record<string, number>;
};

const ROOT = process.cwd();
const DOC_DIR = path.resolve(ROOT, "doc");
const OUT_DIR = path.resolve(ROOT, "out");

const FILES = {
  indexHtml: path.resolve(DOC_DIR, "index.html"),
  daleelDocx: path.resolve(DOC_DIR, "Daleel.docx"),
  defenseLawTxt: path.resolve(DOC_DIR, "قانون الدفاع الوطني.txt"),
  salariesXlsx: path.resolve(DOC_DIR, "salaries.xlsx"),
};

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function sha1(s: string) {
  return crypto.createHash("sha1").update(s).digest("hex");
}

function cleanText(s: string) {
  return (s || "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseArabicFormCode(label: string): string | undefined {
  // matches: " - ت7" or "ت7" with Arabic digit? commonly Latin digits inside.
  const m = label.match(/(?:^|\s|-|–|—)(ت\d+)\b/);
  return m?.[1];
}

/** -----------------------------
 * 1) INDEX.HTML => links catalog + KB chunks
 * ----------------------------- */
function buildFromIndexHtml(htmlPath: string): { links: FormLink[]; chunks: KBChunk[] } {
  const html = fs.readFileSync(htmlPath, "utf-8");
  const $ = cheerio.load(html);

  const links: FormLink[] = [];
  $("a[href]").each((_, el) => {
    const url = String($(el).attr("href") || "").trim();
    const label_ar = cleanText($(el).text());
    if (!url || !label_ar) return;

    // ignore anchors/js
    if (url.startsWith("#") || url.startsWith("javascript:")) return;

    const form_code = parseArabicFormCode(label_ar);

    links.push({
      label_ar,
      url,
      form_code,
    });
  });

  // De-dup by (label,url)
  const uniq = new Map<string, FormLink>();
  for (const l of links) uniq.set(`${l.label_ar}||${l.url}`, l);
  const finalLinks = Array.from(uniq.values());

  const chunks: KBChunk[] = finalLinks.map((l) => ({
    id: `index_${sha1(l.label_ar + "|" + l.url)}`,
    source: "index.html",
    title: l.label_ar,
    text: `رابط مستند/نموذج: ${l.label_ar}\nالرابط: ${l.url}`,
    url: l.url,
    tags: ["forms", "documents", ...(l.form_code ? [l.form_code] : [])],
    metadata: {
      form_code: l.form_code || null,
    },
  }));

  return { links: finalLinks, chunks };
}

/** -----------------------------
 * 2) DALEEL.DOCX => structured cases + KB chunks
 * ----------------------------- */
async function buildFromDaleelDocx(docxPath: string): Promise<{ cases: DaleelCase[]; chunks: KBChunk[] }> {
  const result = await mammoth.extractRawText({ path: docxPath });
  const raw = cleanText(result.value);

  // Split by "المعاملة رقم"
  const parts = raw.split(/\n(?=المعاملة رقم\s*\d+)/g);

  const cases: DaleelCase[] = [];
  const chunks: KBChunk[] = [];

  for (const part of parts) {
    if (!part.includes("المعاملة رقم")) continue;

    const caseNo = (() => {
      const m = part.match(/المعاملة رقم\s*(\d+)/);
      return m ? Number(m[1]) : undefined;
    })();

    const title = (() => {
      const firstLine = part.split("\n")[0] || "";
      // "المعاملة رقم 30 - حق البنت ..."
      const m = firstLine.match(/المعاملة رقم\s*\d+\s*-\s*(.+)$/);
      return cleanText(m?.[1] || "");
    })();

    const audience = (part.match(/نطاق التطبيق \(Audience Scope\)\s*\n\s*([A-Z0-9_]+)/)?.[1] || "").trim() || undefined;
    const domain = (part.match(/تصنيف المجال \(Domain\)\s*\n\s*([a-z0-9_]+)/)?.[1] || "").trim() || undefined;
    const lifeEvent = (part.match(/الحدث الحياتي \(Life Event\)\s*\n\s*([a-z0-9_]+)/)?.[1] || "").trim() || undefined;

    const mentionedForms = (() => {
      const forms: string[] = [];
      const re = /\bت\d+\b/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(part))) forms.push(m[0]);
      return Array.from(new Set(forms));
    })();

    const links = (() => {
      const found: string[] = [];
      const re = /https?:\/\/[^\s]+/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(part))) found.push(m[0].replace(/[)\],.]+$/, ""));
      return Array.from(new Set(found));
    })();

    const phones = (() => {
      const found: string[] = [];
      // simple: sequences like 1320/1904
      const re = /\b\d{3,5}\/\d{3,5}\b/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(part))) found.push(m[0]);
      return Array.from(new Set(found));
    })();

    const eligibility = (() => {
      const m = part.match(/شروط الاستحقاق.*?\n([\s\S]*?)(?:\n\s*\n|النص المرجعي|$)/);
      return cleanText(m?.[1] || "");
    })();

    const requiredDocs = (() => {
      // Heuristic: detect section "المستندات المطلوبة" then list-like lines until "ملاحظ" or blank
      const m = part.match(/المستندات المطلوبة[\s\S]*?\n([\s\S]*?)(?:\nملاحظ|النص المرجعي|$)/);
      if (!m) return [];
      const block = cleanText(m[1]);
      const lines = block.split("\n").map(cleanText).filter(Boolean);
      // keep only lines that look like docs (not headings)
      return lines.filter((ln) => ln.length >= 4);
    })();

    const referenceText = (() => {
      const m = part.match(/النص المرجعي\s*\(كما ورد في الدليل\)\s*\n([\s\S]*)$/);
      return cleanText(m?.[1] || "");
    })();

    const dc: DaleelCase = {
      case_no: caseNo,
      title: title || undefined,
      audience_scope: audience,
      domain,
      life_event: lifeEvent,
      mentioned_forms: mentionedForms.length ? mentionedForms : undefined,
      phones: phones.length ? phones : undefined,
      links: links.length ? links : undefined,
      eligibility: eligibility || undefined,
      required_docs: requiredDocs.length ? requiredDocs : undefined,
      reference_text: referenceText || undefined,
    };

    cases.push(dc);

    // KB chunk (one per case)
    const chunkText = [
      `المعاملة رقم: ${caseNo ?? "غير محدد"}`,
      title ? `العنوان: ${title}` : "",
      domain ? `التصنيف: ${domain}` : "",
      lifeEvent ? `الحدث الحياتي: ${lifeEvent}` : "",
      eligibility ? `شروط الاستحقاق:\n${eligibility}` : "",
      requiredDocs?.length ? `المستندات المطلوبة:\n- ${requiredDocs.join("\n- ")}` : "",
      mentionedForms?.length ? `نماذج مذكورة: ${mentionedForms.join(", ")}` : "",
      links?.length ? `روابط:\n- ${links.join("\n- ")}` : "",
      phones?.length ? `هواتف: ${phones.join(", ")}` : "",
      referenceText ? `النص المرجعي:\n${referenceText}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    chunks.push({
      id: `daleel_${caseNo ?? sha1(part).slice(0, 10)}`,
      source: "Daleel.docx",
      title: `المعاملة رقم ${caseNo ?? "?"}${title ? " - " + title : ""}`,
      text: chunkText,
      tags: [
        "procedures",
        "retired_military",
        ...(domain ? [domain] : []),
        ...(lifeEvent ? [lifeEvent] : []),
        ...(mentionedForms || []),
      ],
      metadata: {
        case_no: caseNo ?? null,
        domain: domain ?? null,
        life_event: lifeEvent ?? null,
      },
    });
  }

  return { cases, chunks };
}

/** -----------------------------
 * 3) DEFENSE LAW TXT => articles (المادة X) chunks
 * ----------------------------- */
function buildFromDefenseLawTxt(txtPath: string): { chunks: KBChunk[] } {
  const raw = cleanText(fs.readFileSync(txtPath, "utf-8"));

  // Split on "المادة <num>"
  const parts = raw.split(/\n(?=المادة\s+\d+)/g);

  const chunks: KBChunk[] = [];
  for (const part of parts) {
    const m = part.match(/^المادة\s+(\d+)/);
    if (!m) continue;
    const artNo = Number(m[1]);

    // Keep the first ~40 lines or whole part (some articles are short)
    const title = `قانون الدفاع الوطني - المادة ${artNo}`;
    const text = cleanText(part);

    // tags: detect pensions/retirement keywords
    const tags = ["defense_law", `article_${artNo}`];
    if (/(تقاعد|معاش|تعويض الصرف)/.test(text)) tags.push("pension", "retirement");
    if (/(رواتب|تعويضات)/.test(text)) tags.push("salary", "compensation");

    chunks.push({
      id: `law_${artNo}`,
      source: "defense_law",
      title,
      text,
      tags,
      metadata: { article_no: artNo },
    });
  }

  return { chunks };
}

/** -----------------------------
 * 4) SALARIES.XLSX => base salary lookup
 *
 * Your Sheet1 has columns:
 *   اساس 2008, غلا معيشة, درجة قدديمة, راتب جديد, درجة جديدة,
 *   then rank columns (جندي, جندي اول, عريف, عريف اول...) containing degree numbers.
 *
 * We construct a mapping:
 *   baseSalary[rank][degree] = "راتب جديد" (or fallback "اساس 2008"+"غلا معيشة"...)
 * ----------------------------- */
function loadBaseSalaries(xlsxPath: string) {
  const wb = XLSX.readFile(xlsxPath, { cellDates: false });
  const sheetName = wb.SheetNames.includes("Sheet1") ? "Sheet1" : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });

  // Discover rank columns (Arabic rank headers often appear as keys)
  // We'll treat any column key that is Arabic rank and not one of the known numeric columns as rank column.
  const knownCols = new Set(["اساس 2008", "غلا معيشة", "درجة قدديمة", "راتب جديد", "درجة جديدة"]);

  const colNames = Object.keys(rows[0] || {});
  const rankCols = colNames.filter((c) => !knownCols.has(c) && c && typeof c === "string" && /[ء-ي]/.test(c));

  const baseSalary: Record<string, Record<number, number>> = {};

  for (const r of rows) {
    const newSalary = Number(r["راتب جديد"] ?? 0) || 0;
    // Degree number is stored under each rank column (e.g. "جندي": 1,2,3,...)
    for (const rank of rankCols) {
      const degree = Number(r[rank] ?? 0);
      if (!degree || degree < 1) continue;

      if (!baseSalary[rank]) baseSalary[rank] = {};
      // Use راتب جديد as the salary value for that degree
      baseSalary[rank][degree] = newSalary;
    }
  }

  return { sheetName, rankCols, baseSalary };
}

/** -----------------------------
 * 5) Salary Rules + Calculator
 * ----------------------------- */
const SalaryInputSchema = z.object({
  rank: z.string().min(1),
  degree: z.number().int().min(1),
  isRetired: z.boolean(),
  isMarried: z.boolean(),
  kidsCount: z.number().int().min(0),
  ornamentsType: z.string().optional(),
  socialAid: z.number().optional(),
  specialCategory: z.enum(["OFFICER", "MOAHEL", "MOAHEL_AWAL", "OTHER"]).optional(),
});

type SalaryRules = {
  retiredDeductionRate: number;  // 0.15
  wifeAllowance: number;         // 60000
  kidAllowance: number;          // 33000
  ornaments: Record<string, number>; // TBD table
  specialCategoryExtra: Record<string, number>; // OFFICER/MOAHEL/MOAHEL_AWAL extras (TBD)
};

function computeSalary(
  inputRaw: SalaryInput,
  baseSalaryTable: Record<string, Record<number, number>>,
  rules: SalaryRules
): SalaryResult {
  const input = SalaryInputSchema.parse(inputRaw);

  const base = baseSalaryTable?.[input.rank]?.[input.degree];
  if (!base || base <= 0) {
    throw new Error(
      `Base salary not found for rank="${input.rank}" degree="${input.degree}". Add it to salaries.xlsx or adjust parsing.`
    );
  }

  const specialKey = input.specialCategory || "OTHER";
  const specialExtra = rules.specialCategoryExtra[specialKey] || 0;

  const ornamentsValue = input.ornamentsType ? (rules.ornaments[input.ornamentsType] || 0) : 0;

  const familyAllowance =
    (input.isMarried ? rules.wifeAllowance : 0) + Math.max(0, input.kidsCount) * rules.kidAllowance;

  const gross = base + specialExtra + ornamentsValue;

  const retiredDeduction = input.isRetired ? gross * rules.retiredDeductionRate : 0;

  const socialAid = input.socialAid ? Number(input.socialAid) : 0;

  const total = gross - retiredDeduction + familyAllowance + socialAid;

  return {
    baseSalary: base,
    retiredDeduction,
    familyAllowance,
    ornamentsValue,
    socialAid,
    total,
    breakdown: {
      base,
      specialExtra,
      ornamentsValue,
      gross,
      retiredDeduction,
      familyAllowance,
      socialAid,
      total,
    },
  };
}

/** -----------------------------
 * 6) Merge Forms: Index links + Daleel mentioned forms
 * We create a forms catalog keyed by (تX)
 * ----------------------------- */
function buildFormsCatalog(indexLinks: FormLink[], daleelCases: DaleelCase[]) {
  const forms: Record<string, any> = {};

  // from index.html links
  for (const l of indexLinks) {
    if (!l.form_code) continue;
    if (!forms[l.form_code]) {
      forms[l.form_code] = {
        form_code: l.form_code,
        labels: [],
        links: [],
        used_in_cases: [],
        required_docs_from_cases: [],
      };
    }
    forms[l.form_code].labels.push(l.label_ar);
    forms[l.form_code].links.push(l.url);
  }

  // from Daleel.docx references
  for (const c of daleelCases) {
    const usedForms = c.mentioned_forms || [];
    for (const f of usedForms) {
      if (!forms[f]) {
        forms[f] = {
          form_code: f,
          labels: [],
          links: [],
          used_in_cases: [],
          required_docs_from_cases: [],
        };
      }
      forms[f].used_in_cases.push({
        case_no: c.case_no ?? null,
        title: c.title ?? null,
        domain: c.domain ?? null,
        life_event: c.life_event ?? null,
      });

      if (c.required_docs?.length) {
        forms[f].required_docs_from_cases.push({
          case_no: c.case_no ?? null,
          required_docs: c.required_docs,
        });
      }
    }
  }

  // de-dup arrays
  for (const key of Object.keys(forms)) {
    forms[key].labels = Array.from(new Set(forms[key].labels));
    forms[key].links = Array.from(new Set(forms[key].links));
  }

  return forms;
}

/** -----------------------------
 * MAIN
 * ----------------------------- */
async function main() {
  ensureDir(OUT_DIR);

  // 1) index.html
  if (!fs.existsSync(FILES.indexHtml)) throw new Error(`Missing: ${FILES.indexHtml}`);
  const { links: indexLinks, chunks: indexChunks } = buildFromIndexHtml(FILES.indexHtml);

  // 2) Daleel.docx
  if (!fs.existsSync(FILES.daleelDocx)) throw new Error(`Missing: ${FILES.daleelDocx}`);
  const { cases: daleelCases, chunks: daleelChunks } = await buildFromDaleelDocx(FILES.daleelDocx);

  // 3) Defense Law
  if (!fs.existsSync(FILES.defenseLawTxt)) throw new Error(`Missing: ${FILES.defenseLawTxt}`);
  const { chunks: lawChunks } = buildFromDefenseLawTxt(FILES.defenseLawTxt);

  // KB: merge all
  const kb: KBChunk[] = [...indexChunks, ...daleelChunks, ...lawChunks];

  // write KB jsonl
  const kbJsonl = kb.map((c) => JSON.stringify(c)).join("\n") + "\n";
  fs.writeFileSync(path.resolve(OUT_DIR, "kb_chunks.jsonl"), kbJsonl, "utf-8");

  // Forms catalog: links + daleel mapping
  const formsCatalog = buildFormsCatalog(indexLinks, daleelCases);
  fs.writeFileSync(path.resolve(OUT_DIR, "forms_catalog.json"), JSON.stringify(formsCatalog, null, 2), "utf-8");

  // 4) Salaries
  if (!fs.existsSync(FILES.salariesXlsx)) {
    console.warn(`WARN: Missing salaries file: ${FILES.salariesXlsx}. Salary outputs will be skipped.`);
    return;
  }

  const { sheetName, rankCols, baseSalary } = loadBaseSalaries(FILES.salariesXlsx);

  // Your rule set (editable)
  const rules: SalaryRules = {
    retiredDeductionRate: 0.15, // you required 15% deduction for all retired
    wifeAllowance: 60000,
    kidAllowance: 33000,
    ornaments: {
      // TBD values (examples only)
      NONE: 0,
      // "وسام_1": 0,
      // "وسام_2": 0,
    },
    specialCategoryExtra: {
      // you said: "for ranks of officers and مؤهل and مؤهل اول compute additional values"
      // Add the actual extras later once you define them.
      OFFICER: 0,
      MOAHEL: 0,
      MOAHEL_AWAL: 0,
      OTHER: 0,
    },
  };

  fs.writeFileSync(path.resolve(OUT_DIR, "salary_rules.json"), JSON.stringify(rules, null, 2), "utf-8");

  // Example test cases (edit to match your real ranks/degrees)
  const tests: SalaryInput[] = [
    { rank: "جندي", degree: 1, isRetired: true, isMarried: true, kidsCount: 2, ornamentsType: "NONE", socialAid: 0, specialCategory: "OTHER" },
    { rank: "عريف", degree: 3, isRetired: true, isMarried: false, kidsCount: 0, ornamentsType: "NONE", socialAid: 100000, specialCategory: "OTHER" },
  ];

  const results = tests.map((t) => {
    let out: any = null;
    let err: string | null = null;
    try {
      out = computeSalary(t, baseSalary, rules);
    } catch (e: any) {
      err = String(e?.message || e);
    }
    return { input: t, output: out, error: err };
  });

  fs.writeFileSync(
    path.resolve(OUT_DIR, "salary_test_cases.json"),
    JSON.stringify(
      {
        parsedFromSheet: sheetName,
        detectedRankColumns: rankCols,
        note: "If a rank/degree is missing, fix salaries.xlsx OR adjust parsing assumptions in loadBaseSalaries().",
        results,
      },
      null,
      2
    ),
    "utf-8"
  );

  console.log("Done.");
  console.log(`KB chunks: ${kb.length} => out/kb_chunks.jsonl`);
  console.log(`Forms catalog keys: ${Object.keys(formsCatalog).length} => out/forms_catalog.json`);
  console.log(`Salary ranks detected: ${rankCols.length} => out/salary_test_cases.json`);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
