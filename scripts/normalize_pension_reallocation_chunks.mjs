import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");

const targetFiles = [
  path.join(root, "watany_kb_tables_v4", "watany_rag_chunks_v4.jsonl"),
  path.join(root, "data", "kb_rebuild_v4", "output", "full_v4", "watany_rag_chunks_v4.jsonl"),
];

const faqPrompts = (title) => [
  title,
  `شو إجراء ${title}`,
  `وين بقدّم ${title}`,
  `شو الوراق لـ ${title}`,
  `قديش بتاخد وقت ${title}`,
  `قديش بتكلف ${title}`,
];

const specs = {
  "proc-0175": {
    title: "طلب إعادة تخصيص معاش تقاعدي للزوجة",
    documents: "المستندات الأساسية لإعادة التخصيص مع المستندات الإضافية الخاصة بالزوجة.",
    notes: "المستندات الأساسية لإعادة التخصيص مع المستندات الإضافية الخاصة بالزوجة، وتشمل النماذج الأساسية ت7 وت8 وت9.",
    tags: ["زوجة", "مستفيدة", "إعادة تخصيص معاش"],
  },
  "proc-0176": {
    title: "طلب إعادة تخصيص معاش تقاعدي للزوج",
    documents: "المستندات الأساسية لإعادة التخصيص مع المستندات الإضافية الخاصة بالزوج.",
    notes: "المستندات الأساسية لإعادة التخصيص مع المستندات الإضافية الخاصة بالزوج، وتشمل النماذج الأساسية ت7 وت8 وت9.",
    tags: ["زوج", "مستفيد", "إعادة تخصيص معاش"],
  },
  "proc-0177": {
    title: "طلب إعادة تخصيص معاش تقاعدي للابنة العزباء",
    documents: "المستندات الأساسية لإعادة التخصيص مع المستندات الإضافية الخاصة بالابنة العزباء.",
    notes: "المستندات الأساسية لإعادة التخصيص مع المستندات الإضافية الخاصة بالابنة العزباء، وتشمل النماذج الأساسية ت7 وت8 وت9.",
    tags: ["ابنة", "عزباء", "إعادة تخصيص معاش"],
  },
  "proc-0178": {
    title: "طلب إعادة تخصيص معاش تقاعدي للابنة العزباء القاصر",
    documents: "المستندات الأساسية لإعادة التخصيص مع المستندات الإضافية الخاصة بالابنة العزباء القاصر.",
    notes: "المستندات الأساسية لإعادة التخصيص مع المستندات الإضافية الخاصة بالابنة العزباء القاصر، وتشمل النماذج الأساسية ت7 وت8 وت9.",
    tags: ["ابنة", "عزباء", "قاصر", "إعادة تخصيص معاش"],
  },
  "proc-0179": {
    title: "طلب إعادة تخصيص معاش تقاعدي للابنة الأرملة",
    documents: "المستندات الأساسية لإعادة التخصيص مع المستندات الإضافية الخاصة بالابنة الأرملة.",
    notes: "المستندات الأساسية لإعادة التخصيص مع المستندات الإضافية الخاصة بالابنة الأرملة، وتشمل النماذج الأساسية ت7 وت8 وت9 والإقرار أو التعهد المطلوب من المستفيدة.",
    tags: ["ابنة", "أرملة", "إعادة تخصيص معاش"],
    removeKeywords: ["دليل"],
  },
  "proc-0180": {
    title: "طلب إعادة تخصيص معاش تقاعدي للابنة المطلقة",
    documents: "المستندات الأساسية لإعادة التخصيص مع المستندات الإضافية الخاصة بالابنة المطلقة.",
    notes: "المستندات الأساسية لإعادة التخصيص مع المستندات الإضافية الخاصة بالابنة المطلقة، وتشمل النماذج الأساسية ت7 وت8 وت9 والإقرار أو التعهد المطلوب من المستفيدة.",
    tags: ["ابنة", "مطلقة", "إعادة تخصيص معاش"],
    removeKeywords: ["دليل"],
  },
  "proc-0181": {
    title: "طلب إعادة تخصيص معاش تقاعدي للابن الذي يتابع الدراسة",
    documents: "المستندات الأساسية لإعادة التخصيص مع المستندات الإضافية الخاصة بالابن الذي يتابع الدراسة.",
    notes: "المستندات الأساسية لإعادة التخصيص مع المستندات الإضافية الخاصة بالابن الذي يتابع الدراسة، وتشمل النماذج الأساسية ت7 وت8 وت9 وإفادة مدرسية أو جامعية مصدقة عند الاقتضاء.",
    tags: ["ابن", "دراسة", "طالب", "إعادة تخصيص معاش"],
  },
};

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function stripKeywords(items, removeKeywords = []) {
  if (!removeKeywords.length) {
    return items || [];
  }

  const removed = new Set(removeKeywords);
  return (items || []).filter((item) => !removed.has(item));
}

function normalizeLine(line) {
  if (!line.includes('"canonical_id"')) {
    return line;
  }

  const record = JSON.parse(line);
  const canonicalId = record.metadata?.canonical_id;
  const spec = specs[canonicalId];
  if (!spec) {
    return line;
  }

  const prompts = faqPrompts(spec.title);
  const faqText = prompts
    .map((prompt) => `س: ${prompt}\nج: تُراجع معاملة ${spec.title} لدى وزارة المالية وفق المستندات والخطوات الواردة في التحديث الصادر من KB Studio.`)
    .join("\n");

  if (record.chunk_type === "overview") {
    record.text = `${spec.title}\n${spec.notes}\nالفئة: الخدمات المالية\nأسئلة المستخدم الشائعة: ${prompts.join(" | ")}`;
  }

  if (record.chunk_type === "documents") {
    record.text = `- ${spec.documents}`;
  }

  if (record.chunk_type === "legal") {
    record.text = `- mof : ${spec.title}`;
  }

  if (record.chunk_type === "faq") {
    record.text = faqText;
  }

  if (record.chunk_type === "notes") {
    record.text = `- ${spec.notes}`;
  }

  record.metadata.title_ar = spec.title;
  record.metadata.keywords_ar = unique([
    ...stripKeywords(record.metadata.keywords_ar, spec.removeKeywords),
    ...spec.tags,
  ]);
  record.metadata.semantic_tags = unique([
    ...stripKeywords(record.metadata.semantic_tags, spec.removeKeywords),
    ...spec.tags,
  ]);

  return JSON.stringify(record, undefined, 0);
}

for (const filePath of targetFiles) {
  const source = fs.readFileSync(filePath, "utf8");
  const updated = source
    .split(/\r?\n/)
    .map(normalizeLine)
    .join("\n");
  fs.writeFileSync(filePath, updated, "utf8");
  console.log(`normalized ${path.relative(root, filePath)}`);
}