/**
 * build_defense_law_kb.js
 * Build an independent KB from "قانون الدفاع الوطني.txt" into JSONL + CSV for Watany bot RAG.
 *
 * Expected input (default):
 *   /xampp/htdocs/projectx/watany/doc/قانون الدفاع الوطني.txt
 *
 * Outputs (default):
 *   /xampp/htdocs/projectx/watany/doc/kb/defense_law.kb.jsonl
 *   /xampp/htdocs/projectx/watany/doc/kb/defense_law.kb.csv
 *   /xampp/htdocs/projectx/watany/doc/kb/defense_law_outline.json
 *
 * Notes:
 * - This script chunks the law by: الباب -> الفصل -> المادة
 * - Each "مادة" becomes one KB record.
 */

const fs = require("fs");
const path = require("path");

function normalizeArabicWhitespace(s) {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function safeSlug(s) {
  return s
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-z0-9]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function csvEscape(val) {
  const s = String(val ?? "");
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readTextFile(filePath) {
  return normalizeArabicWhitespace(fs.readFileSync(filePath, "utf8"));
}

/**
 * Parse structure:
 * - "الباب ..." lines
 * - "الفصل ..." lines
 * - "المادة رقم" lines start an article block
 */
function parseDefenseLaw(raw) {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  let currentBab = null;
  let currentFasl = null;

  /** @type {Array<{
   *   babTitle: string, faslTitle: string,
   *   articleNo: number, articleTitle: string,
   *   articleText: string
   * }>} */
  const articles = [];

  let activeArticle = null;

  const babRe = /^الباب\s+(.+?)\s*:?$/;                 // الباب الثالث : - الادارة والمحاسبة ...
  const faslRe = /^الفصل\s+(.+?)\s*:?$/;               // الفصل الثاني : - الرواتب ...
  const maddaRe = /^المادة\s+(\d+)\s*(.*)$/;           // المادة 69 / المادة 80 ...

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const babMatch = line.match(babRe);
    if (babMatch) {
      currentBab = "الباب " + babMatch[1].trim();
      continue;
    }

    const faslMatch = line.match(faslRe);
    if (faslMatch) {
      currentFasl = "الفصل " + faslMatch[1].trim();
      continue;
    }

    const maddaMatch = line.match(maddaRe);
    if (maddaMatch) {
      // push previous article
      if (activeArticle) {
        activeArticle.articleText = normalizeArabicWhitespace(activeArticle.articleText);
        articles.push(activeArticle);
      }

      const articleNo = Number(maddaMatch[1]);
      const trailing = (maddaMatch[2] || "").trim();
      // sometimes title is on next line, so keep trailing if present.
      const articleTitle = trailing ? trailing : `مادة ${articleNo}`;

      activeArticle = {
        babTitle: currentBab || "غير محدد (باب)",
        faslTitle: currentFasl || "غير محدد (فصل)",
        articleNo,
        articleTitle,
        articleText: `المادة ${articleNo} ${trailing}`.trim()
      };
      continue;
    }

    // accumulate article body
    if (activeArticle) {
      activeArticle.articleText += "\n" + line;
    }
  }

  // push last article
  if (activeArticle) {
    activeArticle.articleText = normalizeArabicWhitespace(activeArticle.articleText);
    articles.push(activeArticle);
  }

  return articles;
}

function buildTags({ babTitle, faslTitle, articleNo, articleText }) {
  const tags = new Set();

  tags.add("قانون");
  tags.add("قانون_الدفاع_الوطني");
  tags.add(safeSlug(babTitle));
  tags.add(safeSlug(faslTitle));
  tags.add(`مادة_${articleNo}`);

  // lightweight keyword tagging for retrieval (expand later)
  const t = articleText;

  if (/(راتب|رواتب|تعويض|تعويضات)/.test(t)) tags.add("رواتب_وتعويضات");
  if (/(تقاعد|معاش|تعويض الصرف)/.test(t)) tags.add("تقاعد");
  if (/(الترقية|ترقية)/.test(t)) tags.add("ترقية");
  if (/(العقوبات|العقوبة|تأديب)/.test(t)) tags.add("انضباط_وعقوبات");
  if (/(طبابة|معالجة)/.test(t)) tags.add("طبابة");

  return Array.from(tags);
}

function buildOutline(articles) {
  const outline = {};
  for (const a of articles) {
    if (!outline[a.babTitle]) outline[a.babTitle] = {};
    if (!outline[a.babTitle][a.faslTitle]) outline[a.babTitle][a.faslTitle] = [];
    outline[a.babTitle][a.faslTitle].push({
      articleNo: a.articleNo,
      articleTitle: a.articleTitle
    });
  }
  return outline;
}

function main() {
  const INPUT =
    process.env.DEFENSE_LAW_INPUT ||
    "C:/xampp/htdocs/projectx/watany/doc/قانون الدفاع الوطني.txt";

  const OUT_DIR =
    process.env.KB_OUT_DIR ||
    "C:/xampp/htdocs/projectx/watany/doc/kb";

  ensureDir(OUT_DIR);

  if (!fs.existsSync(INPUT)) {
    console.error(`❌ Input file not found: ${INPUT}`);
    console.error("Set DEFENSE_LAW_INPUT env var or place the file in the default path.");
    process.exit(1);
  }

  const raw = readTextFile(INPUT);
  const articles = parseDefenseLaw(raw);

  if (!articles.length) {
    console.error("❌ No articles parsed. Check the source formatting (must contain lines starting with 'المادة').");
    process.exit(1);
  }

  const outline = buildOutline(articles);

  // JSONL KB output
  const jsonlPath = path.join(OUT_DIR, "defense_law.kb.jsonl");
  const csvPath = path.join(OUT_DIR, "defense_law.kb.csv");
  const outlinePath = path.join(OUT_DIR, "defense_law_outline.json");

  const jsonlStream = fs.createWriteStream(jsonlPath, { encoding: "utf8" });
  const csvStream = fs.createWriteStream(csvPath, { encoding: "utf8" });

  // CSV header
  csvStream.write(
    [
      "kb_id",
      "source",
      "bab",
      "fasl",
      "article_no",
      "article_title",
      "tags",
      "text_preview",
      "text_full"
    ].join(",") + "\n"
  );

  for (const a of articles) {
    const kbId = `deflaw:article:${a.articleNo}`;
    const tags = buildTags(a);

    const record = {
      kb_id: kbId,
      source: "قانون الدفاع الوطني",
      source_file: path.basename(INPUT),
      hierarchy: {
        bab: a.babTitle,
        fasl: a.faslTitle
      },
      article_no: a.articleNo,
      title: a.articleTitle,
      tags,
      language: "ar",
      text: a.articleText,
      // internal retrieval hints
      retrieval: {
        primary_keys: [`المادة ${a.articleNo}`],
        query_aliases: [
          `مادة ${a.articleNo}`,
          `المادة رقم ${a.articleNo}`,
          `${a.babTitle} ${a.faslTitle} المادة ${a.articleNo}`
        ]
      },
      // citations are local file pointers (useful for UI linking later)
      citations: [
        {
          type: "local_file",
          file: path.basename(INPUT),
          ref: `المادة ${a.articleNo}`
        }
      ]
    };

    jsonlStream.write(JSON.stringify(record, null, 0) + "\n");

    const preview = a.articleText.slice(0, 160).replace(/\n/g, " ");
    csvStream.write(
      [
        csvEscape(kbId),
        csvEscape("قانون الدفاع الوطني"),
        csvEscape(a.babTitle),
        csvEscape(a.faslTitle),
        csvEscape(a.articleNo),
        csvEscape(a.articleTitle),
        csvEscape(tags.join("|")),
        csvEscape(preview),
        csvEscape(a.articleText)
      ].join(",") + "\n"
    );
  }

  fs.writeFileSync(outlinePath, JSON.stringify(outline, null, 2), "utf8");

  jsonlStream.end();
  csvStream.end();

  console.log("✅ Defense Law KB built successfully:");
  console.log(" - JSONL:", jsonlPath);
  console.log(" - CSV:", csvPath);
  console.log(" - Outline:", outlinePath);
  console.log(`📌 Parsed articles count: ${articles.length}`);
}

main();
