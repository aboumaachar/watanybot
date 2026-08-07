export type AidSystem = "alshoon" | "mfe";

export interface AlshoonGrantLevel {
  id: number;
  levelName: string;
  baseAmount: number;
  currency: string;
}

export interface AlshoonMultiplier {
  id: number;
  type: string;
  value: number;
}

export interface AlshoonAidData {
  grantLevels: AlshoonGrantLevel[];
  multipliers: AlshoonMultiplier[];
}

export interface MfeRate {
  levelName: string;
  levelNameEn: string;
  amount: number;
  schoolType: "official" | "non-official";
  requiresActualPaidAmount: boolean;
  sourceNote?: string;
}

export interface MfeSection {
  sectionId: string;
  title: string;
  subtitle: string;
  rates: MfeRate[];
}

export interface MfeAidData {
  sections: MfeSection[];
}

export interface AlshoonStudentInput {
  name: string;
  levelId: number;
  multiplierIds: number[];
}

export interface MfeStudentInput {
  name: string;
  sectionId: string;
  rateIndex: number;
  actualPaidAmount?: number | null;
}

export interface AidStudentResult {
  name: string;
  label: string;
  baseAmount: number;
  finalAmount: number;
  breakdown: string[];
  actualPaidAmount?: number | null;
  capApplied?: boolean;
  capReason?: string | null;
}

export interface AidCalculationResult {
  system: AidSystem;
  students: AidStudentResult[];
  familyTotal: number;
  monthlyAverage: number;
  currency: string;
}

export interface AidDatasetSummary {
  decreeNumber: string;
  academicYears: string;
  decreeDate: string;
  title: string;
  subtitle: string;
  sourceLabel: string;
  sourceStatus: string;
}

const ALSHOON_STORAGE_KEY = "alshoon_ministerial_grant";
const MFE_STORAGE_KEY = "mfe_official_tariff";

const DEFAULT_ALSHOON_DATA: AlshoonAidData = {
  grantLevels: [
    { id: 1, levelName: "الروضة الإبتدائي / Kindergarten-Primary", baseAmount: 350000, currency: "LBP" },
    { id: 2, levelName: "المتوسطة / Intermediate", baseAmount: 550000, currency: "LBP" },
    { id: 3, levelName: "الثانية / Secondary", baseAmount: 600000, currency: "LBP" },
    { id: 4, levelName: "الجامعة / University", baseAmount: 700000, currency: "LBP" },
  ],
  multipliers: [
    { id: 1, type: "عائلة شهيد / Martyr Family", value: 1.5 },
    { id: 2, type: "طالب معاق / Disabled Student", value: 1.3 },
    { id: 3, type: "دخل منخفض / Low Income", value: 1.2 },
  ],
};

const DEFAULT_MFE_DATA: MfeAidData = {
  sections: [
    {
      sectionId: "A",
      title: "📚 القسم الأول - التعليم الأكاديمي في لبنان",
      subtitle: "Section A - Academic Education in Lebanon",
      rates: [
        { levelName: "روضة ابتدائي - خاص غير مجاني", levelNameEn: "Kindergarten-Primary (Private not free)", amount: 119000000, schoolType: "non-official", requiresActualPaidAmount: true },
        { levelName: "روضة ابتدائي - خاص مجاني", levelNameEn: "Kindergarten-Primary (Private free)", amount: 59000000, schoolType: "non-official", requiresActualPaidAmount: true },
        { levelName: "روضة ابتدائي - رسمي", levelNameEn: "Kindergarten-Primary (Official)", amount: 59000000, schoolType: "official", requiresActualPaidAmount: false },
        { levelName: "متوسط - خاص غير مجاني", levelNameEn: "Intermediate (Private not free)", amount: 157000000, schoolType: "non-official", requiresActualPaidAmount: true },
        { levelName: "متوسط - خاص ليلي", levelNameEn: "Intermediate (Private evening)", amount: 80000000, schoolType: "non-official", requiresActualPaidAmount: true },
        { levelName: "متوسط - رسمي", levelNameEn: "Intermediate (Official)", amount: 80000000, schoolType: "official", requiresActualPaidAmount: false },
        { levelName: "ثانوي - خاص نهاري", levelNameEn: "Secondary (Private day)", amount: 200000000, schoolType: "non-official", requiresActualPaidAmount: true },
        { levelName: "ثانوي - خاص ليلي", levelNameEn: "Secondary (Private evening)", amount: 98000000, schoolType: "non-official", requiresActualPaidAmount: true },
        { levelName: "ثانوي - رسمي", levelNameEn: "Secondary (Official)", amount: 119000000, schoolType: "official", requiresActualPaidAmount: false },
        { levelName: "جامعي - الجامعة اللبنانية", levelNameEn: "University (Lebanese University)", amount: 132000000, schoolType: "official", requiresActualPaidAmount: false },
        { levelName: "جامعي - طب / هندسة / صيدلة", levelNameEn: "University (Medicine / Engineering / Pharmacy)", amount: 395000000, schoolType: "non-official", requiresActualPaidAmount: true },
        { levelName: "جامعي - باقي الاختصاصات", levelNameEn: "University (Other Specialties)", amount: 317000000, schoolType: "non-official", requiresActualPaidAmount: true },
      ],
    },
    {
      sectionId: "B",
      title: "🔧 القسم الثاني - التعليم المهني والتقني في لبنان",
      subtitle: "Section B - Technical & Vocational Education in Lebanon",
      rates: [
        { levelName: "متوسط مهني - خاص غير مجاني", levelNameEn: "Intermediate Technical (Private not free)", amount: 157000000, schoolType: "non-official", requiresActualPaidAmount: true },
        { levelName: "متوسط مهني - خاص ليلي", levelNameEn: "Intermediate Technical (Private evening)", amount: 80000000, schoolType: "non-official", requiresActualPaidAmount: true },
        { levelName: "متوسط مهني - رسمي", levelNameEn: "Intermediate Technical (Official)", amount: 80000000, schoolType: "official", requiresActualPaidAmount: false },
        { levelName: "ثانوي مهني - خاص غير مجاني", levelNameEn: "Secondary Technical (Private not free)", amount: 200000000, schoolType: "non-official", requiresActualPaidAmount: true },
        { levelName: "ثانوي مهني - خاص ليلي", levelNameEn: "Secondary Technical (Private evening)", amount: 80000000, schoolType: "non-official", requiresActualPaidAmount: true },
        { levelName: "ثانوي مهني - رسمي", levelNameEn: "Secondary Technical (Official)", amount: 80000000, schoolType: "official", requiresActualPaidAmount: false },
        { levelName: "شهادة الامتياز الفني - من معهد خاص", levelNameEn: "Technical Excellence Certificate (Private Institute)", amount: 317000000, schoolType: "non-official", requiresActualPaidAmount: true },
        { levelName: "شهادة الامتياز الفني - من معهد رسمي", levelNameEn: "Technical Excellence Certificate (Official Institute)", amount: 132000000, schoolType: "official", requiresActualPaidAmount: false },
      ],
    },
    {
      sectionId: "C",
      title: "🌍 القسم الثالث - التعليم في الخارج",
      subtitle: "Section C - Education Abroad",
      rates: [
        { levelName: "الخارج - روضة ابتدائي", levelNameEn: "Abroad (Kindergarten-Primary)", amount: 119000000, schoolType: "non-official", requiresActualPaidAmount: true, sourceNote: "يعتمد على قيمة الخاص غير المجاني في لبنان" },
        { levelName: "الخارج - متوسط", levelNameEn: "Abroad (Intermediate)", amount: 157000000, schoolType: "non-official", requiresActualPaidAmount: true, sourceNote: "يعتمد على قيمة الخاص غير المجاني في لبنان" },
        { levelName: "الخارج - ثانوي", levelNameEn: "Abroad (Secondary)", amount: 200000000, schoolType: "non-official", requiresActualPaidAmount: true, sourceNote: "يعتمد على قيمة الخاص غير المجاني في لبنان" },
        { levelName: "الخارج - جامعي طب / هندسة / صيدلة", levelNameEn: "Abroad University (Medicine / Engineering / Pharmacy)", amount: 395000000, schoolType: "non-official", requiresActualPaidAmount: true, sourceNote: "يعتمد على قيمة الخاص غير المجاني في لبنان" },
        { levelName: "الخارج - جامعي باقي الاختصاصات", levelNameEn: "Abroad University (Other Specialties)", amount: 317000000, schoolType: "non-official", requiresActualPaidAmount: true, sourceNote: "يعتمد على قيمة الخاص غير المجاني في لبنان" },
      ],
    },
  ],
};

function readStorageObject<T>(key: string): T | null {
  if (globalThis.window === undefined) return null;

  try {
    const raw = globalThis.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isValidAlshoonData(value: unknown): value is AlshoonAidData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AlshoonAidData>;
  return Array.isArray(candidate.grantLevels) && Array.isArray(candidate.multipliers);
}

function isValidMfeData(value: unknown): value is MfeAidData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MfeAidData>;
  return Array.isArray(candidate.sections);
}

export function loadAlshoonAidData(): AlshoonAidData {
  const stored = readStorageObject<unknown>(ALSHOON_STORAGE_KEY);
  return isValidAlshoonData(stored) ? stored : DEFAULT_ALSHOON_DATA;
}

export function loadMfeAidData(): MfeAidData {
  const stored = readStorageObject<unknown>(MFE_STORAGE_KEY);
  return isValidMfeData(stored) ? stored : DEFAULT_MFE_DATA;
}

export function getAidDatasetSummary(): AidDatasetSummary {
  return {
    decreeNumber: "2026/40",
    academicYears: "2025-2026",
    decreeDate: "2026-03-31",
    title: "تعرفة تعاونية موظفي الدولة",
    subtitle: "",
    sourceLabel: "تعرفة تعاونية موظفي الدولة",
    sourceStatus: "Latest scanned document",
  };
}

export function buildAidPrintReport(args: {
  summary: AidDatasetSummary;
  familyName: string;
  fileNumber: string;
  result: AidCalculationResult;
}): string {
  const { summary, familyName, fileNumber, result } = args;
  const optionalMeta = [
    familyName ? `الأسرة: ${familyName}` : "",
    fileNumber ? `رقم الملف: ${fileNumber}` : "",
  ].filter(Boolean);
  const lines = [
    summary.title,
    `القرار: ${summary.decreeNumber} - التاريخ: ${summary.decreeDate} - العام الدراسي: ${summary.academicYears}`,
    ...optionalMeta,
    "",
    ...result.students.map((student, index) => {
      const details = [
        `${index + 1}. ${student.name}`,
        `الفئة: ${student.label}`,
        `التعرفة الرسمية: ${student.baseAmount.toLocaleString("en-US")} ل.ل.`,
        `المبلغ النهائي: ${student.finalAmount.toLocaleString("en-US")} ل.ل.`,
      ];

      return details.join("\n");
    }),
    "",
    `الإجمالي العائلي: ${result.familyTotal.toLocaleString("en-US")} ل.ل.`,
    `المتوسط الشهري: ${result.monthlyAverage.toLocaleString("en-US")} ل.ل.`,
    "",
    "الحاسبة تقدم ارقام تقريبية ولا يمكن اعتبارها الارقام الرسمية النهائية لقيمة المساعدات المدرسية",
  ];

  return lines.join("\n");
}

export function buildAidHtmlReport(args: {
  summary: AidDatasetSummary;
  familyName: string;
  fileNumber: string;
  result: AidCalculationResult;
}): string {
  const { summary, familyName, fileNumber, result } = args;
  const rows = result.students.map((student, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(student.name)}</td>
          <td>${escapeHtml(student.label)}</td>
          <td>${student.baseAmount.toLocaleString("en-US")} ل.ل.</td>
          <td>${student.finalAmount.toLocaleString("en-US")} ل.ل.</td>
        </tr>`).join("");

  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(summary.title)}</title>
    <style>
      body { font-family: "Tahoma", "Segoe UI", sans-serif; background: #f4f6fb; color: #19253a; margin: 0; padding: 24px; }
      .sheet { max-width: 1100px; margin: 0 auto; background: white; border: 1px solid #ccd5e7; box-shadow: 0 10px 40px rgba(0,0,0,0.08); }
      .header { padding: 28px 32px; border-bottom: 3px solid #2f4f7f; background: linear-gradient(180deg, #f8fbff, #eef4ff); }
      .header h1 { margin: 0 0 8px; font-size: 28px; }
      .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; font-size: 14px; }
      .section { padding: 24px 32px; }
      .badge { display: inline-block; padding: 6px 10px; background: #e6eefc; border: 1px solid #c4d3f4; border-radius: 999px; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 14px; }
      th, td { border: 1px solid #d7deec; padding: 10px 12px; text-align: right; vertical-align: top; }
      th { background: #314f7f; color: white; }
      .summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
      .summary-card { padding: 14px; background: #f8fafd; border: 1px solid #d7deec; }
      .footer { padding: 20px 32px 32px; color: #4a5d7d; font-size: 13px; display: grid; gap: 12px; }
      .disclaimer { padding: 12px 14px; border: 1px solid #d7deec; background: #f8fafc; color: #24344f; border-radius: 10px; font-weight: 700; }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="header">
        <div class="badge">${escapeHtml(summary.sourceLabel)}</div>
        <h1>${escapeHtml(summary.title)}</h1>
        <div class="meta">
          <div>قرار رقم: ${escapeHtml(summary.decreeNumber)}</div>
          <div>التاريخ: ${escapeHtml(summary.decreeDate)}</div>
          <div>العام الدراسي: ${escapeHtml(summary.academicYears)}</div>
          ${familyName ? `<div>اسم الأسرة: ${escapeHtml(familyName)}</div>` : ""}
          ${fileNumber ? `<div>رقم الملف: ${escapeHtml(fileNumber)}</div>` : ""}
        </div>
      </div>
      <div class="section">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>الطالب</th>
              <th>الفئة</th>
              <th>التعرفة الرسمية</th>
              <th>المبلغ النهائي</th>
            </tr>
          </thead>
          <tbody>${rows}
          </tbody>
        </table>
        <div class="summary">
          <div class="summary-card">الإجمالي العائلي: ${result.familyTotal.toLocaleString("en-US")} ل.ل.</div>
          <div class="summary-card">المتوسط الشهري: ${result.monthlyAverage.toLocaleString("en-US")} ل.ل.</div>
        </div>
      </div>
      <div class="footer">
        <div>هذه الوثيقة أُنشئت من حاسبة المساعدات المدرسية بالاعتماد على تعرفة تعاونية موظفي الدولة.</div>
        <div class="disclaimer">الحاسبة تقدم ارقام تقريبية ولا يمكن اعتبارها الارقام الرسمية النهائية لقيمة المساعدات المدرسية</div>
      </div>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function calculateAlshoonAid(students: AlshoonStudentInput[], data = loadAlshoonAidData()): AidCalculationResult {
  if (students.length === 0) {
    throw new Error("At least one student is required");
  }

  const studentResults = students.map((student) => {
    const level = data.grantLevels.find((entry) => entry.id === student.levelId);
    if (!level) {
      throw new Error(`Unknown ALSHOON grant level: ${student.levelId}`);
    }

    const selectedMultipliers = data.multipliers.filter((entry) => student.multiplierIds.includes(entry.id));
    const totalFactor = selectedMultipliers.reduce((value, multiplier) => value * multiplier.value, 1);
    const finalAmount = Math.round(level.baseAmount * totalFactor);

    return {
      name: student.name.trim() || "طالب بدون اسم",
      label: level.levelName,
      baseAmount: level.baseAmount,
      finalAmount,
      breakdown: selectedMultipliers.length > 0
        ? selectedMultipliers.map((entry) => `${entry.type} × ${entry.value}`)
        : ["بدون عوامل مضاعفة"],
      actualPaidAmount: null,
      capApplied: false,
      capReason: null,
    } satisfies AidStudentResult;
  });

  const familyTotal = studentResults.reduce((sum, student) => sum + student.finalAmount, 0);
  return {
    system: "alshoon",
    students: studentResults,
    familyTotal,
    monthlyAverage: Math.round(familyTotal / 12),
    currency: data.grantLevels[0]?.currency ?? "LBP",
  };
}

export function calculateMfeAid(students: MfeStudentInput[], data = loadMfeAidData()): AidCalculationResult {
  if (students.length === 0) {
    throw new Error("At least one student is required");
  }

  const studentResults = students.map((student) => {
    const section = data.sections.find((entry) => entry.sectionId === student.sectionId);
    const rate = section?.rates[student.rateIndex];
    if (!section || !rate) {
      throw new Error(`Unknown MFE tariff selection: ${student.sectionId}/${student.rateIndex}`);
    }
    const finalAmount = rate.amount;

    return {
      name: student.name.trim() || "طالب بدون اسم",
      label: rate.levelName,
      baseAmount: rate.amount,
      finalAmount,
      breakdown: [
        section.title,
        rate.levelNameEn,
        "احتساب مباشر وفق التعرفة الرسمية المعتمدة",
        ...(rate.sourceNote ? [rate.sourceNote] : []),
      ],
      actualPaidAmount: null,
      capApplied: false,
      capReason: null,
    } satisfies AidStudentResult;
  });

  const familyTotal = studentResults.reduce((sum, student) => sum + student.finalAmount, 0);
  return {
    system: "mfe",
    students: studentResults,
    familyTotal,
    monthlyAverage: Math.round(familyTotal / 12),
    currency: "LBP",
  };
}