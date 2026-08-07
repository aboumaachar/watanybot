/**
 * build_salary_kb.mjs  (v5 — full 23-column xlsx)
 *
 * Reads sources/primary/salaries/salary_full.csv (exported from salary.xlsx)
 * and produces:
 *   kb/salaries/salariesIndex.json  — full lookup table keyed "rank||degree"
 *   kb/salaries/rankMeta.json       — ranks, family allowance, medal choices
 *
 * Column map (A–W):
 *   A  Category         الفئة
 *   B  Rank             الرتبة
 *   C  Degree           الدرجة
 *   D  BasicSalary      أساس الراتب
 *   E  degree_value     قيمة الدرجة
 *   F  vetsalary        المعاش التقاعدي الأساسي (85%)
 *   G  تجهيزات          متممات تجهيزات (جدول 6)
 *   H  سائق             بدل سائق
 *   I  منصب             متممات منصب (جدول 6)
 *   J  2025             منحة 2025
 *   K  13020            مرسوم 13020
 *   L  11227/2          مرسوم 11227/2
 *   M  11227/1          مرسوم 11227/1
 *   N  2022             موازنة 2022
 *   O  2019             قيمة 2019
 *   P  2026             المعاش الشهري 2026 (ل.ل.)
 *   Q  2026 $           المعاش 2026 بالدولار
 *   R  2019 $           المعاش 2019 بالدولار
 *   S  2019-%           نسبة 2019
 *   T  6 salary         الزيادة السادسة (ل.ل.)
 *   U  total salary 2026  المعاش الإجمالي 2026 بالدولار بعد الزيادة
 *   V  6-%              نسبة الزيادة
 *   W  50-%             نسبة 50%
 *
 * Run:  node scripts/build_salary_kb.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "sources", "primary", "salaries");
const OUT = path.join(ROOT, "kb", "salaries");

fs.mkdirSync(OUT, { recursive: true });

/* ────── 1. Parse salary_full.csv → salariesIndex.json ────── */
const csvPath = path.join(SRC, "salary_full.csv");
if (!fs.existsSync(csvPath)) {
  console.error("❌ salary_full.csv not found. Run: python scripts/_read_xlsx.py first");
  process.exit(1);
}
const csv = fs.readFileSync(csvPath, "utf8").trim().split("\n");
const headers = csv[0].split(",").map(h => h.trim());
console.log(`Headers (${headers.length}): ${headers.join(" | ")}`);

const salariesIndex = {};
const num = (s) => { const n = parseFloat(s); return isNaN(n) ? 0 : n; };

for (let i = 1; i < csv.length; i++) {
  const cols = csv[i].split(",").map(s => s.trim());
  if (cols.length < 20) continue;
  const [category, rank, degreeStr, basicSalary, degreeValue, vetSalary,
         equipment, driver, position, grant2025, d13020, d11227_2, d11227_1,
         budget2022, val2019, pension2026, pension2026usd, val2019usd,
         pct2019, sixSalary, totalSalary2026usd, sixPct, fiftyPct] = cols;

  const degree = parseInt(degreeStr, 10);
  const key = `${rank}||${degree}`;
  salariesIndex[key] = {
    category, rank, degree,
    // Core salary
    basicSalary:   num(basicSalary),     // D: أساس الراتب
    degreeValue:   num(degreeValue),      // E: قيمة الدرجة
    vetSalary:     num(vetSalary),        // F: المعاش التقاعدي الأساسي
    // Table 6 supplements (pre-computed in xlsx)
    equipment:     num(equipment),        // G: تجهيزات
    driver:        num(driver),           // H: سائق
    position:      num(position),         // I: منصب
    // Social aids (pre-computed in xlsx)
    grant2025:     num(grant2025),        // J: منحة 2025
    d13020:        num(d13020),           // K: مرسوم 13020
    d11227_2:      num(d11227_2),         // L: مرسوم 11227/2
    d11227_1:      num(d11227_1),         // M: مرسوم 11227/1
    budget2022:    num(budget2022),       // N: موازنة 2022
    val2019:       num(val2019),          // O: قيمة 2019
    // Totals (pre-computed in xlsx — the key answers)
    pension2026:      num(pension2026),      // P: المعاش الشهري 2026 (ل.ل.)
    pension2026usd:   num(pension2026usd),   // Q: المعاش 2026 بالدولار
    val2019usd:       num(val2019usd),       // R: 2019 بالدولار
    pct2019:          num(pct2019),          // S: نسبة 2019
    sixSalary:        num(sixSalary),        // T: الزيادة السادسة (ل.ل.)
    totalSalary2026usd: num(totalSalary2026usd), // U: الإجمالي 2026 بعد الزيادة ($)
    sixPct:           num(sixPct),           // V: نسبة الزيادة
    fiftyPct:         num(fiftyPct),         // W: نسبة 50%
  };
}

fs.writeFileSync(path.join(OUT, "salariesIndex.json"), JSON.stringify(salariesIndex, null, 2), "utf8");
console.log(`✓ salariesIndex.json — ${Object.keys(salariesIndex).length} entries (23 cols each)`);

/* ────── 2. Build rankMeta.json ────── */
const allRanks = [];
const seen = new Set();
for (let i = 1; i < csv.length; i++) {
  const cols = csv[i].split(",").map(s => s.trim());
  if (cols.length < 6) continue;
  const [category, rank] = cols;
  if (!seen.has(rank)) {
    seen.add(rank);
    const maxDeg = Object.keys(salariesIndex)
      .filter(k => k.startsWith(rank + "||"))
      .map(k => parseInt(k.split("||")[1], 10))
      .reduce((a, b) => Math.max(a, b), 1);
    allRanks.push({ rank, category, maxDegree: maxDeg });
  }
}

// Medal values from medal_kb.json (Article 24)
const medalKbPath = path.join(SRC, "medal_kb.json");
let ornamentChoices = [];
if (fs.existsSync(medalKbPath)) {
  const medalKb = JSON.parse(fs.readFileSync(medalKbPath, "utf8"));
  const medals = medalKb.medal_kb?.medals || {};
  // Cedar Order tiers
  if (medals.cedar_order?.ranks) {
    for (const [tier_ar, data] of Object.entries(medals.cedar_order.ranks)) {
      ornamentChoices.push({
        id: `cedar_${data.english.toLowerCase().replace(/ /g, "_")}`,
        name_ar: `وسام الأرز — ${tier_ar}`,
        annualValue: data.annual_benefit_lbp,
        monthlyValue: data.monthly_benefit_lbp,
      });
    }
  }
  // Military medal
  if (medals.military_medal) {
    ornamentChoices.push({
      id: "military_medal",
      name_ar: "الميدالية العسكرية",
      annualValue: medals.military_medal.annual_benefit_lbp,
      monthlyValue: medals.military_medal.monthly_benefit_lbp,
    });
  }
  console.log(`✓ Loaded ${ornamentChoices.length} medal choices from medal_kb.json`);
} else {
  // Fallback: compute from salary table
  const ref = (rank) => salariesIndex[`${rank}||1`]?.basicSalary || 0;
  ornamentChoices = [
    { id: "cedar_knight",        name_ar: "وسام الأرز — فارس",       annualValue: Math.round(ref("ملازم") / 2), monthlyValue: Math.round(ref("ملازم") / 2 / 12) },
    { id: "cedar_officer",       name_ar: "وسام الأرز — ضابط",       annualValue: Math.round(ref("رائد") / 2),  monthlyValue: Math.round(ref("رائد") / 2 / 12) },
    { id: "cedar_commander",     name_ar: "وسام الأرز — كومندور",    annualValue: Math.round(ref("عقيد") / 2),  monthlyValue: Math.round(ref("عقيد") / 2 / 12) },
    { id: "cedar_grand_officer", name_ar: "وسام الأرز — ضابط أكبر",  annualValue: Math.round(ref("عميد") / 2),  monthlyValue: Math.round(ref("عميد") / 2 / 12) },
    { id: "cedar_grand_cordon",  name_ar: "وسام الأرز — وشاح أكبر",  annualValue: Math.round(ref("لواء") / 2),  monthlyValue: Math.round(ref("لواء") / 2 / 12) },
    { id: "military_medal",      name_ar: "الميدالية العسكرية",        annualValue: Math.round(ref("رقيب") / 2),  monthlyValue: Math.round(ref("رقيب") / 2 / 12) },
  ];
}

const rankMeta = {
  description: "بيانات الرتب وبدلات الأوسمة — حاسبة المعاش التقاعدي (v5)",
  familyAllowance: { wife: 60000, perChild: 33000 },
  familyAllowanceAfterRaise: {
    wife: 2100000,
    perChild: 1160000,
    note_ar: "القيم المقترحة بعد إقرار الزيادة في مجلس النواب — لم تُقرّ نهائياً بعد",
  },
  usdRate: 89500,
  ranks: allRanks,
  ornamentChoices,
  note_ar: "جدول الرواتب يحتوي على جميع القيم المُحتسبة مسبقاً. يُضاف فقط: تعويض عائلي + أوسمة.",
  socialAids: {
    budget_2022: {
      type: "multiplier_with_caps",
      multiplier: 2,
      base_excludes: ["family_allowance", "ornaments"],
      min_total_including_base: 500000,
      max_increase: 12000000,
    },
    decree_11227: {
      type: "multiplier",
      multiplier: 4,
      base_excludes: ["family_allowance", "ornaments"],
    },
    decree_11227_2: {
      type: "multiplier_with_floor",
      multiplier: 3,
      base_excludes: ["family_allowance", "ornaments"],
      floor: 7000000,
    },
    decree_13020: {
      type: "multiplier_with_floor",
      multiplier: 3,
      base_excludes: ["family_allowance", "ornaments"],
      floor: 7000000,
    },
    grant_12m: {
      type: "fixed",
      amount: 12000000,
    },
  },
};

fs.writeFileSync(path.join(OUT, "rankMeta.json"), JSON.stringify(rankMeta, null, 2), "utf8");
console.log(`✓ rankMeta.json — ${allRanks.length} ranks, ${ornamentChoices.length} medal choices`);

console.log(`\n✅ KB files written to ${OUT}`);
