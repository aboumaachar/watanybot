#!/usr/bin/env python3
"""Rebuild the full veterans procedures KB for both gateway JSONL and v4 SQLite runtimes."""

from __future__ import annotations

import argparse
import hashlib
from html import escape
import importlib.util
import json
import re
import sys
import shutil
import zipfile
from xml.etree import ElementTree as ET
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple


REPO_ROOT = Path(__file__).resolve().parents[3]
SOURCE_CARDS = REPO_ROOT / "apps" / "api-backend" / "data" / "kb_v2" / "cards" / "procedures.jsonl"
TAXONOMY_PATH = REPO_ROOT / "data" / "kb_rebuild_v4" / "categories.v2.json"
CANONICAL_OUTPUT = REPO_ROOT / "data" / "kb_rebuild_v4" / "full_procedures.canonical.json"
FULL_BUILD_OUTPUT = REPO_ROOT / "data" / "kb_rebuild_v4" / "output" / "full_v4"
GATEWAY_KB_ROOT = REPO_ROOT / "kb_vnext"
GATEWAY_DATA_DIR = GATEWAY_KB_ROOT / "data"
GATEWAY_FLOWS_DIR = GATEWAY_DATA_DIR / "flows"
GATEWAY_ATTACHMENTS_DIR = REPO_ROOT / "apps" / "gateway-api" / "data" / "kb" / "attachments" / "procedures"
RUNTIME_SQLITE = REPO_ROOT / "watany_kb_tables_v4" / "Watany_KB_v4.sqlite"
RUNTIME_CHUNKS = REPO_ROOT / "watany_kb_tables_v4" / "watany_rag_chunks_v4.jsonl"
RUNTIME_SUMMARY = REPO_ROOT / "watany_kb_tables_v4" / "build_summary.json"

DOMAIN_CATEGORY_MAP = {
    "medical": "health_medical",
    "pension": "financial",
    "payments": "financial",
    "severance": "financial",
    "mof": "financial",
    "school": "education",
    "survivors": "death_inheritance",
    "general": "administrative",
    "labor": "legal_documentation",
    "employment": "administrative",
    "medals": "administrative",
}

SUBCATEGORY_DEFAULTS = {
    "health_medical": "medical_assistance",
    "financial": "",
    "education": "",
    "death_inheritance": "death_procedures",
    "administrative": "changes_updates",
    "legal_documentation": "",
    "family_benefits": "dependent_management",
    "licenses_permits": "",
    "parent_coverage": "",
    "spouse_coverage": "",
    "digital_services": "",
    "memberships": "",
}

AUDIENCE_BY_DOMAIN = {
    "medical": "RET_ARMY_ONLY",
    "school": "RET_ALL_FORCES_FINANCE",
    "pension": "RET_ALL_FORCES_FINANCE",
    "payments": "RET_ALL_FORCES_FINANCE",
    "severance": "RET_ALL_FORCES_FINANCE",
    "mof": "RET_ALL_FORCES_FINANCE",
    "survivors": "RET_ARMY_FAMILIES",
}

LAW_PRIORITY = {
    "قانون الدفاع الوطني": 0,
    "نظام التقاعد والصرف من الخدمة": 1,
}

CANONICAL_REQUIRED_FIELDS = {
    "canonical_id",
    "doc_topic_no",
    "category_id",
    "title_ar",
    "short_description_ar",
    "audience_scope",
    "applies_to",
    "user_questions",
    "keywords_ar",
    "semantic_tags",
    "updated_date",
    "primary_authority",
    "required_documents",
    "steps",
    "eligibility_rules",
    "links_contacts",
    "governing_laws",
    "faqs",
    "important_notes",
    "related_topics",
    "source",
}

APPLIES_TO_ALIASES = {
    "retired_military": "retired_military",
    "retired_isf": "retired_isf",
    "active_military": "active_military",
    "family_members": "family_members",
    "dependents": "dependents",
    "heirs": "heirs",
    "all_veterans": "all_veterans",
}

ARABIC_STOPWORDS = {
    "الى",
    "إلى",
    "على",
    "عن",
    "من",
    "في",
    "مع",
    "أو",
    "و",
    "ثم",
    "بعد",
    "قبل",
    "هذا",
    "هذه",
    "ذلك",
    "تلك",
    "لدى",
    "ضمن",
    "عند",
    "لمن",
    "عليه",
    "عليها",
    "يمكن",
    "يجب",
    "يرجى",
    "حسب",
    "كون",
    "كونه",
    "كما",
    "وقد",
    "تم",
    "يتم",
    "بعده",
    "حول",
    "بين",
    "إذا",
    "اذا",
    "أي",
    "اية",
    "أية",
    "طلب",
    "الموافقة",
    "على",
    "رقم",
    "نموذج",
    "أنموذج",
}

PLACEHOLDER_PATTERNS = (
    "خبرني التفاصيل المطلوبة",
    "وبعطيك الطريق الصح",
    "يُستكمل الجواب",
)

DOCUMENT_HINTS = (
    "صورة عن",
    "نسخة عن",
    "نسخة طبق",
    "اخراج قيد",
    "إخراج قيد",
    "افادة",
    "إفادة",
    "وثيقة",
    "بيان قيد",
    "هوية",
    "جواز",
    "طلب ",
    "نموذج",
    "تقرير",
    "حكم",
    "إيصال",
    "براءة",
    "دفتر",
    "شهادة",
    "سجل",
    "مستند",
    "مضبطة",
)

STEP_PREFIXES = (
    "تجهيز",
    "تقديم",
    "استلام",
    "متابعة",
    "شراء",
    "إرفاق",
    "مراجعة",
    "الحضور",
    "إبراز",
)

TITLE_SUBCATEGORY_HINTS = {
    "بطاقة": ("health_medical", "service_cards"),
    "طبابة": ("health_medical", "medical_assistance"),
    "معالجة": ("health_medical", "medical_assistance"),
    "سجل صحي": ("health_medical", "medical_records"),
    "دواء": ("health_medical", "prescriptions"),
    "تعويض عائلي": ("family_benefits", "children_benefits"),
    "مساعدة مدرسية": ("family_benefits", "children_benefits"),
    "التقديمات المدرسية": ("education", ""),
    "إفادة دراسة": ("education", ""),
    "تصديق": ("education", ""),
    "وفاة": ("death_inheritance", "death_procedures"),
    "إرث": ("death_inheritance", "inheritance_rights"),
    "وارث": ("death_inheritance", "inheritance_rights"),
    "زوجة": ("spouse_coverage", ""),
    "زوج": ("spouse_coverage", ""),
    "والدة": ("parent_coverage", ""),
    "والد": ("parent_coverage", ""),
    "رخصة": ("licenses_permits", ""),
    "اذن": ("licenses_permits", ""),
    "إذن": ("licenses_permits", ""),
    "تصريح": ("legal_documentation", ""),
    "إفادة": ("legal_documentation", ""),
    "مستند": ("legal_documentation", ""),
    "معاش": ("financial", ""),
    "تقاعد": ("financial", ""),
    "توطين": ("financial", ""),
    "حساب مصرفي": ("financial", ""),
}

NOISE_TITLE_PATTERNS = (
    re.compile(r"^transaction_\d+$", re.IGNORECASE),
    re.compile(r"^mof$", re.IGNORECASE),
    re.compile(r"^\d+[-_].+"),
)

NOISE_TITLE_PREFIXES = (
    "المستندات الإضافية",
    "المستندات الاضافية",
    "مستندات اعادة التخصيص",
    "دليل تصديق",
    "جدول رقم",
    "في حال كان حفيد المتقاعد",
    "في حال كان حفيد المتقاعد/ة",
    "في حال كان حفيد المتقاعد يعاني",
)

NOISE_CONTENT_MARKERS = (
    "jQuery(\"a[href$=",
    "addClass(\"active-trail\")",
    "body{font-family:",
    "Pensioners - Local Copy",
    "نسخة محلية مبنية",
)

NOISE_FRAGMENT_MARKERS = (
    "1/1 ",
    "1/2 ",
    "1/3 ",
    "/g3",
)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def read_jsonl(path: Path) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        rows.append(json.loads(line))
    return rows


def split_text_lines(text: str) -> List[str]:
    lines = [normalize_spaces(part) for part in re.split(r"[\n\r]+", text or "")]
    return [line for line in lines if line]


def split_text_fragments(text: str) -> List[str]:
    fragments = []
    for chunk in re.split(r"[\n\r]+|(?<=[\.؟!])\s+|\s+-\s+", text or ""):
        value = normalize_spaces(chunk)
        if value:
            fragments.append(value)
    return fragments


def contains_placeholder(text: str) -> bool:
    normalized = normalize_spaces(text)
    return any(pattern in normalized for pattern in PLACEHOLDER_PATTERNS)


def is_document_candidate(text: str) -> bool:
    normalized = normalize_spaces(text)
    if not normalized or contains_placeholder(normalized):
        return False
    if normalized.startswith("أنموذج رقم") or normalized.startswith("نموذج رقم"):
        return False
    if normalized.startswith("الموضوع") or normalized.startswith("أتشرف بطلب") or normalized.startswith("بناءً") or normalized.startswith("بناء على"):
        return False
    if any(hint in normalized for hint in DOCUMENT_HINTS):
        return True
    if normalized.startswith("ربطاً") or normalized.startswith("ربطا"):
        return True
    if re.match(r"^[0-9١-٩]+[\.)-]", normalized):
        return True
    return False


def infer_doc_type_id(name: str) -> str:
    if "هوية" in name or "قيد" in name:
        return "DOC_CIVIL_STATUS_FAMILY"
    if "إفادة" in name and ("دراسة" in name or "مدرس" in name or "جامع" in name):
        return "DOC_ENROLLMENT"
    if "ضمان" in name:
        return "DOC_NSSF"
    if "بطاقة" in name:
        return "DOC_SERVICE_CARD"
    if "دفتر" in name:
        return "DOC_RET_BOOK"
    if "تقرير" in name:
        return "DOC_MEDICAL_REPORT"
    if "حكم" in name:
        return "DOC_COURT_ORDER"
    if "طلب" in name or "نموذج" in name:
        return "DOC_APPLICATION"
    return "DOC_OTHER"


def infer_issuer_guess(name: str) -> str:
    if "مختار" in name or "قيد" in name or "هوية" in name:
        return "mukhtar"
    if "ضمان" in name:
        return "nssf"
    if "جامعة" in name or "مدرس" in name or "دراسة" in name:
        return "school_university"
    if "وزارة المالية" in name or "تقاعد" in name or "مضبطة" in name:
        return "finance_retirement"
    if "الجيش" in name or "بطاقة" in name or "خدمات" in name:
        return "lebanese_army"
    if "حكم" in name or "وثيقة" in name:
        return "court_or_civil_registry"
    return "unknown"


def infer_copy_type(name: str) -> str:
    if "صورة" in name or "نسخة" in name:
        return "copy"
    if "أصل" in name or "اصل" in name:
        return "original"
    return "unspecified"


def infer_condition_rule(name: str) -> str:
    if "دراسة" in name or "طالب" in name:
        return "study"
    if "زواج" in name or "زوج" in name:
        return "marital_status"
    if "وفاة" in name or "ارث" in name or "إرث" in name:
        return "death"
    if "إعاقة" in name or "تقرير" in name or "طبي" in name:
        return "medical"
    if "هوية" in name or "قيد" in name:
        return "identity"
    return "general"


def extract_documents_from_text(raw_summary: str, raw_notes: str) -> List[str]:
    docs: List[str] = []
    capture = False
    for line in split_text_lines(raw_notes or raw_summary):
        if line.startswith("المستندات المطلوبة"):
            capture = True
            continue
        if capture and line.startswith("الموضوع"):
            capture = False
        if is_document_candidate(line):
            cleaned = re.sub(r"^(ربطاً|ربطا)\s*[:：-]?\s*", "", line).strip("-: ")
            docs.append(cleaned)
            continue
        if capture and len(line) > 8:
            docs.append(line)
    return unique_strings(docs)


def extract_note_highlights(text: str) -> List[str]:
    highlights: List[str] = []
    for fragment in split_text_fragments(text):
        if contains_placeholder(fragment):
            continue
        if any(token in fragment for token in ("ربطاً", "في حال", "ملاحظة", "على أن", "يمكن", "يجب", "خلال", "بعد")):
            highlights.append(fragment)
        elif fragment.startswith("الموضوع") or fragment.startswith("أتشرف"):
            highlights.append(fragment)
    return unique_strings(highlights)[:6]


def extract_keyword_candidates(*values: str) -> List[str]:
    tokens: List[str] = []
    for value in values:
        for token in re.findall(r"[\u0600-\u06FF]{3,}", value or ""):
            if token in ARABIC_STOPWORDS:
                continue
            tokens.append(token)
    return unique_strings(tokens)


def derive_short_description(title_ar: str, authority_name: str, docs: List[str]) -> str:
    if authority_name and authority_name != "الجهة المختصة":
        if docs:
            return f"إجراء لتقديم {title_ar} لدى {authority_name} مع إرفاق المستندات المؤيدة الواردة في النموذج المرجعي."
        return f"إجراء لتقديم {title_ar} لدى {authority_name} ومتابعة النتيجة مع المرجع المختص."
    if docs:
        return f"إجراء يوضح كيفية تقديم {title_ar} مع المستندات الأساسية المرتبطة بهذه المعاملة."
    return f"إجراء يوضح كيفية تقديم {title_ar} ومتابعة هذه المعاملة لدى الجهة المختصة."


def derive_user_questions(title_ar: str, formal: str, card: Dict[str, Any]) -> List[str]:
    generic = [
        f"كيف أقدّم {title_ar}؟",
        f"ما هي الأوراق المطلوبة لـ {title_ar}؟",
        f"أين أقدّم {title_ar}؟",
        f"ما هي خطوات {title_ar}؟",
    ]
    prompts = [entry.get("q", "") for entry in card.get("ask_min_lb", []) if isinstance(entry, dict) and not contains_placeholder(entry.get("q", ""))]
    return unique_strings([title_ar, formal, *generic, *prompts])[:10]


def derive_keywords(title_ar: str, formal: str, authority_name: str, card: Dict[str, Any], notes: str) -> List[str]:
    return unique_strings([
        *listify_strings(card.get("topic_tags", [])),
        *extract_keyword_candidates(title_ar, authority_name, notes),
        formal,
        normalize_spaces(str(card.get("domain") or "")),
    ])[:14]


def has_procedure_shape(title: str, summary: str, notes: str, source_files: List[str]) -> bool:
    title_norm = normalize_spaces(title)
    combined = "\n".join(part for part in [summary, notes] if part)
    if title_norm.startswith("LP-") or "أنموذج رقم" in combined or "نموذج رقم" in combined:
        return True
    if "الموضوع : طلب" in combined or "الموضوع: طلب" in combined:
        return True
    if title_norm.startswith("طلب ") or title_norm.startswith("طلب"):
        return True
    return any(file_name.lower().endswith(".docx") for file_name in source_files)


def is_noisy_legacy_card(card: Dict[str, Any]) -> bool:
    title = normalize_spaces(str(card.get("title_formal") or card.get("title_lb") or ""))
    summary = normalize_spaces(str(card.get("summary_lb") or ""))
    notes = normalize_spaces(str(card.get("procedure_notes") or ""))
    source_files = [
        normalize_spaces(str((entry or {}).get("file") or ""))
        for entry in ((card.get("formal_refs") or {}).get("sources") or [])
        if normalize_spaces(str((entry or {}).get("file") or ""))
    ]
    combined = "\n".join(part for part in [title, summary, notes] if part)
    source_exts = {Path(file_name).suffix.lower() for file_name in source_files if Path(file_name).suffix}
    procedure_like = has_procedure_shape(title, summary, notes, source_files)

    if any(pattern.match(title) for pattern in NOISE_TITLE_PATTERNS):
        return True
    if any(title.startswith(prefix) for prefix in NOISE_TITLE_PREFIXES):
        return True
    if any(marker in combined for marker in NOISE_CONTENT_MARKERS):
        return True
    if any(marker in combined for marker in NOISE_FRAGMENT_MARKERS) and not procedure_like:
        return True

    has_non_docx_only_sources = bool(source_files) and source_exts.issubset({".pdf", ".html", ".txt"})
    if has_non_docx_only_sources and not procedure_like:
        return True

    if has_non_docx_only_sources and not procedure_like and title and title == Path(source_files[0]).stem:
        return True

    return False


def build_structured_steps(title_ar: str, addressee: List[str], requirements: List[str], deadlines: List[str], notes: str) -> List[str]:
    steps: List[str] = []
    if requirements:
        steps.append("جهّز المستندات الأساسية المذكورة لهذه المعاملة قبل المراجعة.")
        steps.append("أرفق الطلب بالمستندات المؤيدة وبالنسخ المطلوبة بحسب حالتك.")
    else:
        steps.append(f"حضّر الطلب أو الاستدعاء الخاص بمعاملة {title_ar} مع شرح الحالة بشكل واضح.")

    if addressee:
        steps.append("قدّم المعاملة لدى " + " - ".join(addressee) + ".")
    else:
        steps.append("قدّم المعاملة لدى الجهة المختصة المذكورة في النموذج أو المرجع الإداري.")

    if any(token in notes for token in ("ربطاً", "مرفق", "مرفقة")) and requirements:
        steps.append("تأكد من إرفاق المستندات المشار إليها ربطاً قبل التسليم النهائي.")

    if deadlines:
        steps.append(f"راعِ المهلة أو الفترة المذكورة في المرجع: {deadlines[0]}.")

    steps.append("تابع نتيجة الطلب واستلم المستند أو الإفادة أو القرار الصادر عن المرجع المختص.")
    return unique_strings(step for step in steps if not contains_placeholder(step))[:5]


def derive_eligibility_rules(card: Dict[str, Any], title_ar: str, audience_scope: str, notes: str) -> List[str]:
    rules = listify_strings(card.get("use_when_lb", []))
    audience_rule = {
        "RET_ARMY_ONLY": "المعاملة مخصصة أساساً للمتقاعدين أو المستفيدين المرتبطين بمرجعيات الجيش اللبناني.",
        "RET_ALL_FORCES_FINANCE": "المعاملة تدخل ضمن ملفات التقاعد أو الإفادات المرتبطة بالجهات المالية أو الإدارية المختصة.",
        "RET_ARMY_FAMILIES": "يمكن أن تهم هذه المعاملة أفراد عائلة العسكري أو المتقاعد بحسب الصفة الثبوتية.",
    }.get(audience_scope)
    if audience_rule:
        rules.append(audience_rule)
    if "لعائلات" in notes or "عائلات العسكريين" in notes:
        rules.append("قد تُطلب مستندات تثبت صفة القرابة عندما يقدم الطلب أحد أفراد العائلة.")
    if "محامي" in notes or "وكيل" in notes:
        rules.append("عند التقديم بواسطة وكيل أو محامٍ قد يلزم إبراز وكالة قانونية صالحة.")
    if "صاحب العلاقة" in notes:
        rules.append("يمكن لصاحب العلاقة تقديم الطلب مباشرة إذا كانت هويته ومستنداته مكتملة.")
    return unique_strings(rule for rule in rules if rule and rule != title_ar)[:5]


def normalize_subcategory(category_id: str, subcategory_id: str) -> str:
    if category_id in {"financial", "education", "legal_documentation", "licenses_permits", "parent_coverage", "spouse_coverage", "digital_services", "memberships"}:
        return ""
    return subcategory_id


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_jsonl(path: Path, rows: Iterable[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [json.dumps(row, ensure_ascii=False) for row in rows]
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")


def unique_strings(values: Iterable[Any]) -> List[str]:
    seen = set()
    rows: List[str] = []
    for value in values or []:
        text = normalize_spaces(str(value))
        if not text or text in seen:
            continue
        seen.add(text)
        rows.append(text)
    return rows


def sanitize_slug(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-")


def stable_token(value: str, prefix: str) -> str:
    slug = sanitize_slug(value).lower()
    if slug:
        return slug
    digest = hashlib.md5(value.encode("utf-8")).hexdigest()[:12]
    return f"{prefix}-{digest}"


def mermaid_escape(text: str) -> str:
    cleaned = normalize_spaces(text).replace('"', "'")
    return cleaned[:80] or "..."


def extract_docx_text(path: Path) -> str:
    try:
        with zipfile.ZipFile(path) as archive:
            xml = archive.read("word/document.xml")
    except Exception:
        return ""
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return ""
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs: List[str] = []
    for para in root.findall(".//w:p", ns):
        parts = [node.text for node in para.findall(".//w:t", ns) if node.text]
        text = normalize_spaces("".join(parts))
        if text:
            paragraphs.append(text)
    return "\n".join(paragraphs)


def index_docx_sources() -> Dict[str, Path]:
    index: Dict[str, Path] = {}
    for path in REPO_ROOT.rglob("*.docx"):
        if path.name.startswith("~$"):
            continue
        index[path.name] = path
    return index


def build_doc_title(file_name: str, text: str) -> str:
    subject = extract_subject(text)
    if subject:
        return subject
    first_line = next((line for line in text.splitlines() if normalize_spaces(line)), "")
    if first_line:
        return normalize_spaces(first_line)[:120]
    return Path(file_name).stem


def render_html_list(title: str, items: List[str]) -> str:
    if not items:
        return ""
    body = "".join(f"<li>{escape(item)}</li>" for item in items)
    return f"<section><h2>{escape(title)}</h2><ul>{body}</ul></section>"


def render_meta_card(label: str, value: str) -> str:
    if not value:
        return ""
    return (
        "<div class='meta-card'>"
        f"<div class='meta-card__label'>{escape(label)}</div>"
        f"<div class='meta-card__value'>{escape(value)}</div>"
        "</div>"
    )


def build_summary_attachment(proc: Dict[str, Any]) -> str:
    title = str(proc.get("title_ar") or proc.get("summary_lb") or proc.get("id") or "معاملة")
    summary = str(proc.get("summary_lb") or "")
    tags = listify_strings(proc.get("tags", []))
    legal_basis = proc.get("legal_basis", []) or []
    source_anchors = proc.get("source_anchors", []) or []
    timeline_items = listify_strings(proc.get("timelines", []))
    requirements = listify_strings(proc.get("requirements", []))
    steps = listify_strings(proc.get("steps", []))
    where_to_apply = listify_strings(proc.get("where_to_apply", []))
    contacts = listify_strings(proc.get("contacts", []))
    eligibility = listify_strings(proc.get("eligibility", []))
    source_files = []
    for anchor in source_anchors:
        if not isinstance(anchor, dict):
            continue
        file_name = str(anchor.get("file") or "").strip()
        anchor_name = str(anchor.get("anchor") or "").strip()
        if not file_name:
            continue
        label = file_name if not anchor_name else f"{file_name} - {anchor_name}"
        if label not in source_files:
            source_files.append(label)

    legal_html = ""
    if legal_basis:
        items: List[str] = []
        for entry in legal_basis:
            source = escape(str(entry.get("source") or "مرجع قانوني"))
            articles = listify_strings(entry.get("articles", []))
            note = escape(str(entry.get("note") or ""))
            bits = [source]
            if articles:
                bits.append("المواد: " + "، ".join(escape(article) for article in articles))
            if note:
                bits.append(note)
            items.append(" - ".join(bits))
        legal_html = render_html_list("المرجع القانوني", items)

    # Build official-source callout block with download links to original DOCX forms
    official_source_html = ""
    docx_links: List[str] = []
    for anchor in source_anchors:
        if not isinstance(anchor, dict):
            continue
        file_name = str(anchor.get("file") or "").strip()
        if not file_name or not file_name.lower().endswith(".docx"):
            continue
        stem = Path(file_name).stem.strip()
        if not stem or stem == ".":
            continue
        suffix = Path(file_name).suffix.lower() or ".docx"
        target_name = f"{stable_token(stem, 'attachment')}{suffix}"
        url = f"/kb/attachments/procedures/{target_name}"
        label = escape(file_name)
        if label not in [l for _, l in docx_links]:
            docx_links.append((url, label))
    if docx_links:
        links_html = "".join(
            f"<li><a href='{url}' download>{label}</a></li>"
            for url, label in docx_links
        )
        official_source_html = (
            "<div class='official-source'>"
            "<div class='official-source__title'>\U0001f4cb المصدر الرسمي</div>"
            "<p class='official-source__note'>النماذج الأصلية الصادرة عن الجهة المختصة:</p>"
            f"<ul>{links_html}</ul>"
            "</div>"
        )

    source_html = render_html_list("الوثائق والمراجع المعتمدة", source_files)
    notes_html = render_html_list("ملاحظات سريعة", [summary] if summary else [])
    print_date = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    meta_cards = "".join(
        card
        for card in [
            render_meta_card("رقم المعاملة", str(proc.get("tx_no") or "")),
            render_meta_card("المصدر", str(proc.get("source") or "generated")),
            render_meta_card("نوع المرفق", "ملخص إجرائي قابل للطباعة"),
            render_meta_card("تاريخ التحديث", str(proc.get("last_updated") or print_date)),
            render_meta_card("عدد الخطوات", str(len(steps)) if steps else ""),
            render_meta_card("عدد الوثائق", str(len(requirements)) if requirements else ""),
        ]
        if card
    )

    sections = [
        render_html_list("من يمكنه الاستفادة؟", eligibility),
        render_html_list("الأوراق المطلوبة", requirements),
        render_html_list("الخطوات العملية", steps),
        render_html_list("مكان التقديم", where_to_apply),
        render_html_list("المهل والمتابعة", timeline_items),
        render_html_list("جهات المتابعة", contacts),
        legal_html,
        source_html,
        notes_html,
    ]
    tags_html = " ".join(f"<span class='tag'>{escape(tag)}</span>" for tag in tags[:8])
    return f"""<!doctype html>
<html lang=\"ar\" dir=\"rtl\">
<head>
  <meta charset=\"utf-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
  <title>{escape(title)}</title>
  <style>
        :root {{ color-scheme: light; }}
        body {{ font-family: Tahoma, Arial, sans-serif; margin: 24px; color: #16202a; background: linear-gradient(180deg, #f7f5ef 0%, #ece6d8 100%); line-height: 1.75; }}
        main {{ max-width: 960px; margin: 0 auto; background: #fffdf9; border: 1px solid #e4dccf; border-radius: 18px; padding: 32px; box-shadow: 0 18px 50px rgba(36, 28, 18, 0.08); }}
        header {{ border-bottom: 1px solid #eadfcd; padding-bottom: 18px; margin-bottom: 20px; }}
        h1 {{ margin: 0 0 10px; font-size: 30px; line-height: 1.35; }}
        h2 {{ margin: 22px 0 12px; font-size: 20px; color: #3e3528; }}
        p {{ margin: 0 0 12px; }}
        ul {{ margin: 0; padding-right: 22px; }}
        section {{ margin-top: 18px; padding-top: 4px; }}
        .eyebrow {{ color: #6c6254; font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase; }}
        .summary {{ font-size: 17px; color: #2f2a22; }}
        .tags {{ display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 8px; }}
        .tag {{ background: #efe8da; border: 1px solid #dccdb2; border-radius: 999px; padding: 4px 10px; font-size: 13px; }}
        .meta-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin: 18px 0 10px; }}
        .meta-card {{ background: #faf6ee; border: 1px solid #e8dcc7; border-radius: 14px; padding: 12px 14px; }}
        .meta-card__label {{ font-size: 12px; color: #756957; margin-bottom: 4px; }}
        .meta-card__value {{ font-size: 15px; color: #1f1b15; font-weight: 600; }}
        .print-bar {{ display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }}
        .print-note {{ color: #6b6156; font-size: 13px; }}
        .print-btn {{ border: 0; border-radius: 999px; background: #1f5f4a; color: #fff; padding: 10px 16px; cursor: pointer; font: inherit; }}
        .official-source {{ background: #eef7f1; border: 1px solid #b2d8c2; border-radius: 14px; padding: 16px 20px; margin: 20px 0 4px; }}
        .official-source__title {{ font-size: 16px; font-weight: 700; color: #1a5f3a; margin-bottom: 6px; }}
        .official-source__note {{ font-size: 13px; color: #3d6b52; margin: 0 0 8px; }}
        .official-source ul {{ margin: 0; padding-right: 20px; }}
        .official-source a {{ color: #14724a; font-weight: 600; text-decoration: underline; }}
        .official-source a:hover {{ color: #0d5a38; }}
        .footer-note {{ margin-top: 28px; font-size: 12px; color: #766b5f; border-top: 1px dashed #deceb7; padding-top: 12px; }}
        @media print {{
            body {{ margin: 0; background: #fff; }}
            main {{ max-width: none; border: 0; box-shadow: none; border-radius: 0; padding: 18mm 14mm; }}
            .print-btn {{ display: none; }}
            .print-note {{ color: #333; }}
            a {{ color: inherit; text-decoration: none; }}
        }}
  </style>
</head>
<body>
  <main>
        <div class=\"print-bar\">
            <div class=\"print-note\">ورقة إرشادية للمراجعة والطباعة. تحقق دائماً من الجهة المختصة قبل التقديم النهائي.</div>
            <button class=\"print-btn\" onclick=\"window.print()\">طباعة</button>
        </div>
        <header>
            <div class=\"eyebrow\">WatanyBot Procedure Summary</div>
            <h1>{escape(title)}</h1>
            <p class=\"summary\">{escape(summary)}</p>
            <div class=\"meta-grid\">{meta_cards}</div>
        </header>
    <div class=\"tags\">{tags_html}</div>
    {official_source_html}
    {''.join(section for section in sections if section)}
        <div class=\"footer-note\">هذا الملخص مُولّد من قاعدة المعرفة لإرشاد المستخدم النهائي، ويعرض المراجع القانونية والمصادر المتاحة داخل النظام وقت الإنشاء: {escape(print_date)}.</div>
  </main>
</body>
</html>
"""


def build_mermaid_flow(proc: Dict[str, Any]) -> str:
    title = mermaid_escape(str(proc.get("title_ar") or proc.get("summary_lb") or proc.get("id") or "معاملة"))
    requirements = listify_strings(proc.get("requirements", []))
    where = listify_strings(proc.get("where_to_apply", []))
    steps = listify_strings(proc.get("steps", []))
    timelines = listify_strings(proc.get("timelines", []))

    lines = ["flowchart TD"]
    lines.append(f'  A["{title}"]')
    previous = "A"
    node_index = 1

    if requirements:
        current = f"N{node_index}"
        node_index += 1
        lines.append(f'  {current}["جهز المستندات\\n{mermaid_escape(requirements[0])}"]')
        lines.append(f"  {previous} --> {current}")
        previous = current

    for step in steps[:3]:
        current = f"N{node_index}"
        node_index += 1
        lines.append(f'  {current}["{mermaid_escape(step)}"]')
        lines.append(f"  {previous} --> {current}")
        previous = current

    if where:
        current = f"N{node_index}"
        node_index += 1
        lines.append(f'  {current}["التقديم لدى\\n{mermaid_escape(where[0])}"]')
        lines.append(f"  {previous} --> {current}")
        previous = current

    if timelines:
        current = f"N{node_index}"
        node_index += 1
        lines.append(f'  {current}["مهلة\\n{mermaid_escape(timelines[0])}"]')
        lines.append(f"  {previous} --> {current}")
        previous = current

    lines.append('  Z["متابعة النتيجة واستلام المستند"]')
    lines.append(f"  {previous} --> Z")
    return "\n".join(lines) + "\n"


def normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def listify_strings(values: Iterable[Any]) -> List[str]:
    items: List[str] = []
    for value in values or []:
        if isinstance(value, dict):
            for key in ("doc", "name_ar", "text", "value"):
                raw = value.get(key)
                if raw:
                    text = normalize_spaces(str(raw))
                    if text and text not in items:
                        items.append(text)
                    break
            continue
        text = normalize_spaces(str(value))
        if text and text not in items:
            items.append(text)
    return items


def load_taxonomy_lookup(path: Path) -> Tuple[Dict[str, Dict[str, Any]], Dict[str, set[str]]]:
    payload = read_json(path)
    categories: Dict[str, Dict[str, Any]] = {}
    subcategories: Dict[str, set[str]] = {}
    for category in payload.get("categories", []):
        category_id = str(category.get("id") or "").strip()
        if not category_id:
            continue
        categories[category_id] = category
        subcategories[category_id] = {
            str(item.get("id") or "").strip()
            for item in category.get("subcategories", []) or []
            if str(item.get("id") or "").strip()
        }
    return categories, subcategories


def normalize_primary_authority(value: Any, audience_scope: str) -> Dict[str, Any]:
    authority = value if isinstance(value, dict) else {}
    name_ar = normalize_spaces(str(authority.get("name_ar") or "الجهة المختصة"))
    authority_id = normalize_spaces(str(authority.get("id") or stable_token(name_ar, "authority")))
    return {
        "id": authority_id,
        "name_ar": name_ar,
        "authority_type": normalize_spaces(str(authority.get("authority_type") or "general")),
        "applies_to": normalize_spaces(str(authority.get("applies_to") or audience_scope)),
        "notes_ar": normalize_spaces(str(authority.get("notes_ar") or "")),
    }


def normalize_required_documents(values: Any) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for item in values or []:
        if isinstance(item, dict):
            name_ar = normalize_spaces(str(item.get("name_ar") or item.get("doc") or item.get("name") or ""))
            row = dict(item)
        else:
            name_ar = normalize_spaces(str(item))
            row = {}
        if not name_ar:
            continue
        rows.append(
            {
                "name_ar": name_ar,
                "doc_type_id": normalize_spaces(str(row.get("doc_type_id") or "DOC_OTHER")),
                "issuer_guess": normalize_spaces(str(row.get("issuer_guess") or row.get("where_to_get") or "unknown")),
                "validity_days": row.get("validity_days"),
                "required_for": normalize_spaces(str(row.get("required_for") or "general")),
                "copy_type": normalize_spaces(str(row.get("copy_type") or "unspecified")),
                "condition_rule": normalize_spaces(str(row.get("condition_rule") or "general")),
            }
        )
    return rows


def normalize_steps(values: Any, authority_name: str) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for index, item in enumerate(values or [], start=1):
        if isinstance(item, dict):
            title_ar = normalize_spaces(str(item.get("title_ar") or item.get("name_ar") or f"الخطوة {index}"))
            text_ar = normalize_spaces(str(item.get("text_ar") or item.get("description_ar") or item.get("text") or ""))
            row = dict(item)
        else:
            title_ar = f"الخطوة {index}"
            text_ar = normalize_spaces(str(item))
            row = {}
        if not text_ar:
            continue
        rows.append(
            {
                "title_ar": title_ar,
                "text_ar": text_ar,
                "authority_guess": normalize_spaces(str(row.get("authority_guess") or row.get("location") or authority_name)),
                "channel_guess": normalize_spaces(str(row.get("channel_guess") or ("online" if row.get("online_available") else "in_person"))),
                "action_code": normalize_spaces(str(row.get("action_code") or action_code(text_ar))),
            }
        )
    return rows


def normalize_links_contacts(values: Any) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for item in values or []:
        if isinstance(item, dict):
            kind = normalize_spaces(str(item.get("kind") or "reference"))
            value = normalize_spaces(str(item.get("value") or item.get("url") or item.get("phone") or ""))
            label = normalize_spaces(str(item.get("label_ar") or item.get("description") or item.get("name") or value))
            scope = normalize_spaces(str(item.get("source_scope") or "canonical"))
        else:
            kind = "reference"
            value = normalize_spaces(str(item))
            label = value
            scope = "canonical"
        if not value:
            continue
        rows.append({
            "kind": kind,
            "value": value,
            "label_ar": label,
            "source_scope": scope,
        })
    return rows


def normalize_governing_laws(values: Any) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for item in values or []:
        if not isinstance(item, dict):
            text = normalize_spaces(str(item))
            if text:
                rows.append({"law_name_ar": text, "article_number": "", "text_excerpt": ""})
            continue
        law_name = normalize_spaces(str(item.get("law_name_ar") or item.get("source") or ""))
        if not law_name:
            continue
        rows.append(
            {
                "law_name_ar": law_name,
                "article_number": normalize_spaces(str(item.get("article_number") or "")),
                "text_excerpt": normalize_spaces(str(item.get("text_excerpt") or item.get("note") or "")),
            }
        )
    return rows


def normalize_faqs(values: Any) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for item in values or []:
        if not isinstance(item, dict):
            continue
        question = normalize_spaces(str(item.get("question_ar") or ""))
        answer = normalize_spaces(str(item.get("answer_ar") or ""))
        if not question or not answer:
            continue
        rows.append({"question_ar": question, "answer_ar": answer})
    return rows


def normalize_applies_to(values: Any) -> List[str]:
    normalized: List[str] = []
    for value in values or []:
        token = normalize_spaces(str(value)).lower()
        mapped = APPLIES_TO_ALIASES.get(token)
        if mapped and mapped not in normalized:
            normalized.append(mapped)
    return normalized


def normalize_canonical_record(record: Dict[str, Any], taxonomy_categories: Dict[str, Dict[str, Any]], taxonomy_subcategories: Dict[str, set[str]]) -> Dict[str, Any]:
    category_id = normalize_spaces(str(record.get("category_id") or "administrative"))
    if category_id not in taxonomy_categories:
        raise ValueError(f"Unknown category_id '{category_id}' for procedure {record.get('canonical_id') or record.get('title_ar')}")

    subcategory_id = normalize_spaces(str(record.get("subcategory_id") or ""))
    valid_subcategories = taxonomy_subcategories.get(category_id, set())
    if subcategory_id and valid_subcategories and subcategory_id not in valid_subcategories:
        raise ValueError(
            f"Unknown subcategory_id '{subcategory_id}' for category '{category_id}' in procedure {record.get('canonical_id') or record.get('title_ar')}"
        )

    title_ar = normalize_spaces(str(record.get("title_ar") or ""))
    short_description = normalize_spaces(str(record.get("short_description_ar") or title_ar))
    audience_scope = normalize_spaces(str(record.get("audience_scope") or "RET_ARMY_ONLY"))
    primary_authority = normalize_primary_authority(record.get("primary_authority"), audience_scope)

    normalized = {
        "canonical_id": normalize_spaces(str(record.get("canonical_id") or stable_token(title_ar or short_description, "proc"))),
        "doc_topic_no": int(record.get("doc_topic_no")),
        "category_id": category_id,
        "subcategory_id": subcategory_id,
        "title_ar": title_ar,
        "short_description_ar": short_description,
        "audience_scope": audience_scope,
        "applies_to": normalize_applies_to(record.get("applies_to") or []),
        "user_questions": unique_strings(record.get("user_questions") or []),
        "keywords_ar": unique_strings(record.get("keywords_ar") or []),
        "semantic_tags": unique_strings(record.get("semantic_tags") or []),
        "life_event": normalize_spaces(str(record.get("life_event") or "none")),
        "updated_date": normalize_spaces(str(record.get("updated_date") or datetime.now(timezone.utc).date().isoformat())),
        "primary_authority": primary_authority,
        "required_documents": normalize_required_documents(record.get("required_documents") or []),
        "steps": normalize_steps(record.get("steps") or [], primary_authority["name_ar"]),
        "eligibility_rules": unique_strings(record.get("eligibility_rules") or record.get("eligibility_conditions") or []),
        "links_contacts": normalize_links_contacts(record.get("links_contacts") or record.get("online_services") or []),
        "governing_laws": normalize_governing_laws(record.get("governing_laws") or []),
        "faqs": normalize_faqs(record.get("faqs") or []),
        "important_notes": unique_strings(record.get("important_notes") or []),
        "related_topics": unique_strings(record.get("related_topics") or []),
        "source": normalize_spaces(str(record.get("source") or "canonical_rebuild")),
    }

    if not normalized["applies_to"]:
        normalized["applies_to"] = ["retired_military"]
    if not normalized["user_questions"]:
        normalized["user_questions"] = [title_ar]
    if not normalized["keywords_ar"]:
        normalized["keywords_ar"] = unique_strings([title_ar, category_id, subcategory_id])
    if not normalized["semantic_tags"]:
        normalized["semantic_tags"] = normalized["keywords_ar"][:8]
    return normalized


def validate_canonical_payload(payload: Dict[str, Any], taxonomy_categories: Dict[str, Dict[str, Any]], taxonomy_subcategories: Dict[str, set[str]]) -> List[Dict[str, Any]]:
    procedures = payload.get("procedures")
    if not isinstance(procedures, list) or not procedures:
        raise ValueError("Canonical payload must contain a non-empty 'procedures' array")

    normalized_rows: List[Dict[str, Any]] = []
    seen_ids = set()
    seen_doc_topics = set()
    for index, record in enumerate(procedures, start=1):
        if not isinstance(record, dict):
            raise ValueError(f"Procedure at index {index} is not an object")
        missing = sorted(field for field in CANONICAL_REQUIRED_FIELDS if field not in record)
        if missing:
            raise ValueError(f"Procedure at index {index} is missing required fields: {', '.join(missing)}")
        normalized = normalize_canonical_record(record, taxonomy_categories, taxonomy_subcategories)
        if normalized["canonical_id"] in seen_ids:
            raise ValueError(f"Duplicate canonical_id '{normalized['canonical_id']}'")
        if normalized["doc_topic_no"] in seen_doc_topics:
            raise ValueError(f"Duplicate doc_topic_no '{normalized['doc_topic_no']}'")
        seen_ids.add(normalized["canonical_id"])
        seen_doc_topics.add(normalized["doc_topic_no"])
        normalized_rows.append(normalized)
    return normalized_rows


def load_canonical_payload(canonical_input: Path, taxonomy_categories: Dict[str, Dict[str, Any]], taxonomy_subcategories: Dict[str, set[str]]) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    payload = read_json(canonical_input)
    normalized_rows = validate_canonical_payload(payload, taxonomy_categories, taxonomy_subcategories)
    normalized_payload = {
        "version": str(payload.get("version") or "canonical-v1"),
        "generated_at": str(payload.get("generated_at") or datetime.now(timezone.utc).isoformat()),
        "source": str(canonical_input.relative_to(REPO_ROOT)).replace("\\", "/") if canonical_input.is_relative_to(REPO_ROOT) else str(canonical_input),
        "procedures": normalized_rows,
    }
    return normalized_payload, normalized_rows


def extract_subject(text: str) -> str:
    match = re.search(r"الموضوع\s*[:：]\s*(.+)", text or "")
    if match:
        subject = normalize_spaces(match.group(1).splitlines()[0])
        return subject.rstrip(" .،")
    return ""


def extract_addressee(text: str) -> List[str]:
    if not text:
        return []
    match = re.search(r"إلى\s*(.*?)\s*الموضوع", text, re.DOTALL)
    if not match:
        return []
    lines = [normalize_spaces(line) for line in match.group(1).splitlines()]
    return [line for line in lines if line]


def parse_tx_no(card: Dict[str, Any], fallback: int) -> int:
    for value in (card.get("title_formal"), card.get("title_lb"), card.get("id")):
        if not value:
            continue
        match = re.search(r"(\d+)", str(value))
        if match:
            return int(match.group(1))
    return fallback


def build_procedure_id(card: Dict[str, Any], tx_no: int) -> str:
    formal = normalize_spaces(str(card.get("title_formal") or card.get("title_lb") or ""))
    formal = re.sub(r"[^A-Za-z0-9_-]+", "-", formal).strip("-").lower()
    source_id = re.sub(r"[^A-Za-z0-9_-]+", "-", str(card.get("id") or "")).strip("-").lower()
    if formal:
        return f"{formal}-{tx_no}-{source_id}" if source_id else f"{formal}-{tx_no}"
    if source_id:
        return f"proc-{tx_no}-{source_id}"
    return f"proc-{tx_no}"


def pick_category(card: Dict[str, Any]) -> Tuple[str, str]:
    domain = str(card.get("domain") or "general").strip().lower()
    category_id = DOMAIN_CATEGORY_MAP.get(domain, "administrative")
    subcategory_id = SUBCATEGORY_DEFAULTS.get(category_id, "changes_updates")
    title = normalize_spaces(str(card.get("title_formal") or card.get("title_lb") or card.get("summary_lb") or ""))

    tags = {str(tag).strip().lower() for tag in card.get("topic_tags", [])}
    if "medical" in tags:
        category_id = "health_medical"
        subcategory_id = "medical_assistance"
    elif "survivors_dependents" in tags:
        category_id = "death_inheritance"
        subcategory_id = "death_procedures"
    elif "school_aid" in tags:
        category_id = "education"
        subcategory_id = "document_transfers"
    elif "family_status" in tags:
        category_id = "family_benefits"
        subcategory_id = "dependent_management"
    elif "pension_retirement" in tags or "compensation" in tags:
        category_id = "financial"
        subcategory_id = ""

    for hint, mapped in TITLE_SUBCATEGORY_HINTS.items():
        if hint in title:
            category_id, subcategory_id = mapped
            break

    return category_id, normalize_subcategory(category_id, subcategory_id)


def dedupe_legal_refs(laws: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    rows: List[Dict[str, Any]] = []
    ordered = sorted(
        laws,
        key=lambda item: (
            LAW_PRIORITY.get(str(item.get("law_name") or ""), 99),
            -int(item.get("score") or 0),
            str(item.get("article_number") or ""),
        ),
    )
    for law in ordered:
        key = (law.get("law_name"), law.get("article_number"))
        if key in seen:
            continue
        seen.add(key)
        article = normalize_spaces(str(law.get("article_number") or ""))
        source = law.get("source") or {}
        note_bits = listify_strings(law.get("matched_keywords", []))
        note = "الكلمات المفتاحية: " + "، ".join(note_bits[:6]) if note_bits else ""
        rows.append(
            {
                "source": normalize_spaces(str(law.get("law_name") or "مرجع قانوني")),
                "articles": [article] if article else [],
                "note": note or normalize_spaces(str(source.get("file") or "")),
                "allows": True,
            }
        )
    return rows[:5]


def convert_required_documents(card: Dict[str, Any]) -> List[Dict[str, Any]]:
    docs = []
    raw_docs = list(card.get("required_documents", []) or [])
    raw_docs.extend((card.get("answer_pack_lb") or {}).get("docs", []) or [])
    raw_docs.extend(extract_documents_from_text(str(card.get("summary_lb") or ""), str(card.get("procedure_notes") or "")))

    for item in raw_docs:
        if isinstance(item, dict):
            name = normalize_spaces(str(item.get("doc") or item.get("name_ar") or ""))
        else:
            name = normalize_spaces(str(item))
        if not name:
            continue
        if name.startswith("أنموذج رقم") or name.startswith("نموذج رقم"):
            continue
        if name.startswith("الموضوع") or name.startswith("أتشرف بطلب") or name.startswith("بناءً") or name.startswith("بناء على"):
            continue
        docs.append(
            {
                "name_ar": name,
                "doc_type_id": infer_doc_type_id(name),
                "issuer_guess": infer_issuer_guess(name),
                "validity_days": None,
                "required_for": "general",
                "copy_type": infer_copy_type(name),
                "condition_rule": infer_condition_rule(name),
            }
        )
    deduped = []
    seen = set()
    for row in docs:
        key = row["name_ar"]
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)
    return deduped[:12]


def build_gateway_steps(card: Dict[str, Any], subject: str, addressee: List[str]) -> List[str]:
    requirements = [item.get("name_ar", "") for item in convert_required_documents(card) if item.get("name_ar")]
    deadlines = []
    deadline = normalize_spaces(str((card.get("answer_pack_lb") or {}).get("deadline") or ""))
    if deadline and deadline != "(حسب نوع المعاملة)":
        deadlines.append(deadline)
    for item in listify_strings(card.get("deadlines", [])):
        if item not in deadlines:
            deadlines.append(item)
    return build_structured_steps(subject or "المعاملة", addressee, requirements, deadlines, str(card.get("procedure_notes") or card.get("summary_lb") or ""))


def build_gateway_contacts(card: Dict[str, Any]) -> List[str]:
    contacts = []
    for source in (card.get("formal_refs") or {}).get("sources", []) or []:
        file_name = normalize_spaces(str((source or {}).get("file") or ""))
        if file_name:
            contacts.append(f"المصدر المعتمد: {file_name}")
    return contacts[:3]


def build_gateway_where(card: Dict[str, Any], addressee: List[str]) -> List[str]:
    where = listify_strings((card.get("answer_pack_lb") or {}).get("where", []))
    if addressee:
        where.extend(addressee)
    seen = set()
    result = []
    for item in where:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result[:4]


def build_faq_variants(card: Dict[str, Any], subject: str, formal: str) -> List[str]:
    return derive_user_questions(subject or formal or "المعاملة", formal, card)


def build_gateway_record(card: Dict[str, Any], tx_no: int) -> Dict[str, Any]:
    raw_summary = str(card.get("summary_lb") or "")
    raw_notes = str(card.get("procedure_notes") or "")
    summary = normalize_spaces(raw_summary)
    notes = normalize_spaces(raw_notes)
    formal = normalize_spaces(str(card.get("title_formal") or card.get("title_lb") or ""))
    subject = extract_subject(raw_notes or raw_summary)
    title_ar = subject or formal or f"معاملة رقم {tx_no}"
    addressee = extract_addressee(raw_notes or raw_summary)
    legal_basis = dedupe_legal_refs(((card.get("formal_refs") or {}).get("laws") or []))
    requirements = listify_strings(card.get("required_documents", []))
    requirements.extend(listify_strings((card.get("answer_pack_lb") or {}).get("docs", [])))
    requirements = list(dict.fromkeys(requirements))
    timelines = []
    deadline = normalize_spaces(str((card.get("answer_pack_lb") or {}).get("deadline") or ""))
    if deadline and deadline != "(حسب نوع المعاملة)":
        timelines.append(deadline)
    for item in listify_strings(card.get("deadlines", [])):
        if item not in timelines:
            timelines.append(item)

    tags = listify_strings(card.get("topic_tags", []))
    domain = normalize_spaces(str(card.get("domain") or ""))
    if domain:
        tags.append(domain)
    if formal:
        tags.append(formal)
    if subject:
        tags.append(subject)
    tags = list(dict.fromkeys(tags))

    return {
        "id": build_procedure_id(card, tx_no),
        "tx_no": tx_no,
        "source": domain or "v2_cards",
        "title_ar": title_ar,
        "title_en": formal or None,
        "summary_lb": subject or summary[:280],
        "legal_basis": legal_basis,
        "eligibility": listify_strings(card.get("use_when_lb", [])),
        "requirements": requirements,
        "steps": build_gateway_steps(card, subject, addressee),
        "where_to_apply": build_gateway_where(card, addressee),
        "fees": [],
        "timelines": timelines,
        "contacts": build_gateway_contacts(card),
        "exceptions": [],
        "faq_variants": build_faq_variants(card, subject, formal),
        "tags": tags,
        "source_anchors": [
            {"file": entry.get("file", ""), "anchor": entry.get("article", "")}
            for entry in ((card.get("formal_refs") or {}).get("sources") or [])
            if entry.get("file")
        ],
        "version": "4.0.0",
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }


def build_canonical_record(card: Dict[str, Any], tx_no: int) -> Dict[str, Any]:
    raw_summary = str(card.get("summary_lb") or "")
    raw_notes = str(card.get("procedure_notes") or "")
    summary = normalize_spaces(raw_summary)
    notes = normalize_spaces(raw_notes)
    formal = normalize_spaces(str(card.get("title_formal") or card.get("title_lb") or ""))
    subject = extract_subject(raw_notes or raw_summary)
    title_ar = subject or formal or f"معاملة رقم {tx_no}"
    category_id, subcategory_id = pick_category(card)
    domain = normalize_spaces(str(card.get("domain") or "general")).lower()
    audience_scope = AUDIENCE_BY_DOMAIN.get(domain, "RET_ARMY_ONLY")
    required_documents = convert_required_documents(card)
    addressee = extract_addressee(raw_notes or raw_summary)
    authority_name = addressee[0] if addressee else "الجهة المختصة"
    legal_rows = []
    for item in dedupe_legal_refs(((card.get("formal_refs") or {}).get("laws") or [])):
        legal_rows.append(
            {
                "law_name_ar": item["source"],
                "article_number": ", ".join(item.get("articles", [])),
                "text_excerpt": item.get("note", ""),
            }
        )
    deadline_values = []
    deadline = normalize_spaces(str((card.get("answer_pack_lb") or {}).get("deadline") or ""))
    if deadline and deadline != "(حسب نوع المعاملة)":
        deadline_values.append(deadline)
    for item in listify_strings(card.get("deadlines", [])):
        if item not in deadline_values:
            deadline_values.append(item)

    steps = []
    for index, step in enumerate(build_structured_steps(title_ar, addressee, [doc["name_ar"] for doc in required_documents], deadline_values, raw_notes or raw_summary), start=1):
        steps.append(
            {
                "title_ar": f"الخطوة {index}",
                "text_ar": step,
                "authority_guess": authority_name,
                "channel_guess": "in_person",
                "action_code": "submit_request" if "قدّم" in step or "قدم" in step else ("receive_output" if "استلم" in step or "تابع" in step else ("attach_supporting_docs" if "أرفق" in step else "collect_documents")),
            }
        )
    links_contacts = []
    links_contacts.append(
        {
            "kind": "authority",
            "value": authority_name,
            "label_ar": authority_name,
            "source_scope": "authority",
        }
    )
    for entry in (card.get("formal_refs") or {}).get("sources", []) or []:
        file_name = normalize_spaces(str((entry or {}).get("file") or ""))
        if file_name:
            links_contacts.append(
                {
                    "kind": "source_file",
                    "value": file_name,
                    "label_ar": f"الملف المرجعي {file_name}",
                    "source_scope": "source_material",
                }
            )
    return {
        "canonical_id": build_procedure_id(card, tx_no),
        "doc_topic_no": tx_no,
        "category_id": category_id,
        "subcategory_id": subcategory_id,
        "title_ar": title_ar,
        "short_description_ar": derive_short_description(title_ar, authority_name, [doc["name_ar"] for doc in required_documents]),
        "audience_scope": audience_scope,
        "applies_to": ["retired_military", "family_members"] if domain in {"survivors", "medical"} else ["retired_military"],
        "user_questions": derive_user_questions(title_ar, formal, card),
        "keywords_ar": derive_keywords(title_ar, formal, authority_name, card, raw_notes or raw_summary),
        "semantic_tags": derive_keywords(title_ar, formal, authority_name, card, raw_notes or raw_summary)[:10],
        "life_event": domain if domain in {"medical", "school", "survivors"} else "none",
        "updated_date": datetime.now(timezone.utc).date().isoformat(),
        "primary_authority": {
            "id": f"authority_{domain or 'general'}",
            "name_ar": authority_name,
            "authority_type": domain or "general",
            "applies_to": audience_scope,
            "notes_ar": "مستخرج ومحسّن من بطاقات الإجراءات الحالية والمرجع النصي الأصلي.",
        },
        "required_documents": required_documents,
        "steps": steps,
        "eligibility_rules": derive_eligibility_rules(card, title_ar, audience_scope, raw_notes or raw_summary),
        "links_contacts": links_contacts,
        "governing_laws": legal_rows,
        "faqs": [
            {"question_ar": question, "answer_ar": f"تُراجع خطوات {title_ar} والمستندات المرتبطة بها لدى {authority_name}."}
            for question in derive_user_questions(title_ar, formal, card)[:4]
        ],
        "important_notes": extract_note_highlights(raw_notes or raw_summary) or listify_strings([notes[:500] if notes else ""]),
        "related_topics": [],
        "source": "kb_v2_cards_rebuild",
    }


def build_gateway_record_from_canonical(proc: Dict[str, Any]) -> Dict[str, Any]:
    title_ar = normalize_spaces(str(proc.get("title_ar") or proc.get("canonical_id") or "معاملة"))
    summary = normalize_spaces(str(proc.get("short_description_ar") or title_ar))
    requirements = [item.get("name_ar", "") for item in proc.get("required_documents", []) if item.get("name_ar")]
    steps = [item.get("text_ar", "") for item in proc.get("steps", []) if item.get("text_ar")]
    legal_basis = [
        {
            "source": normalize_spaces(str(item.get("law_name_ar") or "مرجع قانوني")),
            "articles": [normalize_spaces(str(item.get("article_number") or ""))] if normalize_spaces(str(item.get("article_number") or "")) else [],
            "note": normalize_spaces(str(item.get("text_excerpt") or "")),
            "allows": True,
        }
        for item in proc.get("governing_laws", [])
    ]
    where_to_apply = unique_strings([
        proc.get("primary_authority", {}).get("name_ar", ""),
        *[
            item.get("label_ar") or item.get("value")
            for item in proc.get("links_contacts", [])
            if item.get("kind") in {"office", "url", "portal", "reference"}
        ],
    ])
    contacts = unique_strings([
        item.get("label_ar") or item.get("value")
        for item in proc.get("links_contacts", [])
        if item.get("kind") in {"phone", "email", "url", "portal"}
    ])
    source_anchors = [
        {"file": item.get("value", ""), "anchor": ""}
        for item in proc.get("links_contacts", [])
        if item.get("kind") == "source_file" and item.get("value")
    ]
    faq_variants = unique_strings([title_ar, *proc.get("user_questions", [])])
    tags = unique_strings([
        *proc.get("keywords_ar", []),
        *proc.get("semantic_tags", []),
        proc.get("category_id", ""),
        proc.get("subcategory_id", ""),
    ])
    return {
        "id": str(proc.get("canonical_id") or stable_token(title_ar, "proc")),
        "tx_no": int(proc.get("doc_topic_no")),
        "source": str(proc.get("source") or "canonical_rebuild"),
        "title_ar": title_ar,
        "title_en": None,
        "summary_lb": summary,
        "legal_basis": legal_basis,
        "eligibility": unique_strings(proc.get("eligibility_rules", [])),
        "requirements": unique_strings(requirements),
        "steps": unique_strings(steps),
        "where_to_apply": where_to_apply,
        "fees": [],
        "timelines": [],
        "contacts": contacts,
        "exceptions": [],
        "faq_variants": faq_variants,
        "tags": tags,
        "source_anchors": source_anchors,
        "version": "4.0.0",
        "last_updated": normalize_spaces(str(proc.get("updated_date") or datetime.now(timezone.utc).date().isoformat())),
    }


def load_builder_module() -> Any:
    script_path = Path(__file__).with_name("kb_v4_rebuild.py")
    spec = importlib.util.spec_from_file_location("kb_v4_rebuild", script_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load builder from {script_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def build_gateway_support_files(procedures: List[Dict[str, Any]]) -> Dict[str, Any]:
    GATEWAY_DATA_DIR.mkdir(parents=True, exist_ok=True)
    GATEWAY_FLOWS_DIR.mkdir(parents=True, exist_ok=True)
    GATEWAY_ATTACHMENTS_DIR.mkdir(parents=True, exist_ok=True)

    for existing in GATEWAY_FLOWS_DIR.glob("*.mmd"):
        existing.unlink()
    for existing in GATEWAY_ATTACHMENTS_DIR.glob("*"):
        if existing.is_file():
            existing.unlink()

    source_index = index_docx_sources()
    documents: List[Dict[str, Any]] = []
    mappings: List[Dict[str, Any]] = []
    document_ids: Dict[str, str] = {}

    for proc in procedures:
        summary_slug = stable_token(str(proc["id"]), "summary")
        summary_doc_id = f"summary-{summary_slug}"
        summary_name = f"{summary_slug}.html"
        (GATEWAY_ATTACHMENTS_DIR / summary_name).write_text(build_summary_attachment(proc), encoding="utf-8")
        documents.append(
            {
                "id": summary_doc_id,
                "title": f"ملخص {proc.get('title_ar', proc['id'])}",
                "url": f"/kb/attachments/procedures/{summary_name}",
                "source": str(proc.get("source") or "generated"),
                "kind": "guide",
                "preview": True,
                "download": True,
                "tags": ["summary", "html", str(proc.get("source") or "generated")],
            }
        )

        source_anchors = proc.get("source_anchors", []) or []
        mapped_doc_ids: List[str] = [summary_doc_id]
        for anchor in source_anchors:
            file_name = str(anchor.get("file") or "").strip()
            if not file_name or not file_name.lower().endswith(".docx"):
                continue
            stem = Path(file_name).stem.strip()
            if not stem or stem == ".":
                continue
            source_path = source_index.get(file_name)
            if source_path is None:
                continue
            if file_name not in document_ids:
                slug = stable_token(stem, "doc")
                doc_id = f"doc-{slug}"
                document_ids[file_name] = doc_id
                suffix = source_path.suffix.lower() or ".docx"
                target_name = f"{stable_token(Path(file_name).stem, 'attachment')}{suffix}"
                target_path = GATEWAY_ATTACHMENTS_DIR / target_name
                shutil.copy2(source_path, target_path)
                extracted = extract_docx_text(source_path)
                documents.append(
                    {
                        "id": doc_id,
                        "title": build_doc_title(file_name, extracted),
                        "url": f"/kb/attachments/procedures/{target_name}",
                        "source": "laf",
                        "kind": "form",
                        "preview": True,
                        "download": True,
                        "tags": [Path(file_name).stem, "docx", "source_form"],
                    }
                )
            mapped_doc_ids.append(document_ids[file_name])

        mappings.append(
            {
                "procedure_id": proc["id"],
                "doc_ids": sorted(set(mapped_doc_ids)),
                "confidence": 1,
                "reason": "generated_summary_with_optional_docx_source",
            }
        )

        flow_text = build_mermaid_flow(proc)
        (GATEWAY_FLOWS_DIR / f"{proc['id']}.mmd").write_text(flow_text, encoding="utf-8")

    write_jsonl(GATEWAY_DATA_DIR / "procedures.jsonl", procedures)
    write_jsonl(GATEWAY_DATA_DIR / "documents.jsonl", documents)
    write_jsonl(GATEWAY_DATA_DIR / "procedure_to_docs.jsonl", mappings)

    lexicon: Dict[str, List[str]] = {
        "تعويض": ["تعويضات", "بدل", "معاش"],
        "طبابة": ["علاج", "خدمات صحية", "بطاقة صحية"],
        "وفاة": ["ورثة", "إرث", "وفاة المتقاعد"],
        "مدرسية": ["دراسة", "طالب", "مدرسة", "جامعة"],
    }
    write_json(GATEWAY_DATA_DIR / "tags_lexicon.json", lexicon)

    stats = {
        "procedures": len(procedures),
        "documents": len(documents),
        "mappings": len(mappings),
        "flows": len(procedures),
        "domains": Counter(proc.get("source", "unknown") for proc in procedures),
    }
    write_json(GATEWAY_KB_ROOT / "build_stats.json", stats)
    return stats


def copy_runtime_artifacts(build_result: Dict[str, Any]) -> None:
    RUNTIME_SQLITE.parent.mkdir(parents=True, exist_ok=True)
    RUNTIME_SQLITE.write_bytes(Path(build_result["sqlite"]).read_bytes())
    RUNTIME_CHUNKS.write_text(Path(build_result["jsonl"]).read_text(encoding="utf-8"), encoding="utf-8")
    RUNTIME_SUMMARY.write_text(Path(build_result["summary"]).read_text(encoding="utf-8"), encoding="utf-8")


def rebuild(canonical_input: Path | None = None) -> Dict[str, Any]:
    taxonomy_categories, taxonomy_subcategories = load_taxonomy_lookup(TAXONOMY_PATH)

    if canonical_input is not None:
        canonical_payload, canonical_rows = load_canonical_payload(canonical_input, taxonomy_categories, taxonomy_subcategories)
        gateway_rows = [build_gateway_record_from_canonical(proc) for proc in canonical_rows]
        source_count = len(canonical_rows)
        source_label = canonical_payload["source"]
    else:
        cards = read_jsonl(SOURCE_CARDS)
        used_tx = set()
        gateway_rows = []
        canonical_rows = []
        skipped_cards = 0

        next_fallback = 10000
        for card in cards:
            if is_noisy_legacy_card(card):
                skipped_cards += 1
                continue
            tx_no = parse_tx_no(card, next_fallback)
            while tx_no in used_tx:
                tx_no = next_fallback
                next_fallback += 1
            used_tx.add(tx_no)
            next_fallback = max(next_fallback, tx_no + 1)

            gateway_rows.append(build_gateway_record(card, tx_no))
            canonical_rows.append(build_canonical_record(card, tx_no))

        canonical_payload = {
            "version": "full-v1",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source": str(SOURCE_CARDS.relative_to(REPO_ROOT)).replace("\\", "/"),
            "procedures": canonical_rows,
        }
        source_count = len(cards)
        source_label = canonical_payload["source"]

    write_json(CANONICAL_OUTPUT, canonical_payload)

    builder = load_builder_module()
    build_result = builder.build(CANONICAL_OUTPUT, TAXONOMY_PATH, FULL_BUILD_OUTPUT)
    gateway_stats = build_gateway_support_files(gateway_rows)
    copy_runtime_artifacts(build_result)

    result = {
        "source_records": source_count,
        "source": source_label,
        "skipped_legacy_noise": skipped_cards if canonical_input is None else 0,
        "canonical_output": str(CANONICAL_OUTPUT),
        "gateway_output": str(GATEWAY_DATA_DIR),
        "runtime_sqlite": str(RUNTIME_SQLITE),
        "runtime_chunks": str(RUNTIME_CHUNKS),
        "gateway_stats": gateway_stats,
        "v4_build": build_result,
    }
    write_json(REPO_ROOT / "data" / "kb_rebuild_v4" / "full_rebuild_report.json", result)
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Rebuild the full veterans procedures KB.")
    parser.add_argument(
        "--canonical-input",
        type=Path,
        help="Use a plan-aligned canonical JSON file instead of regenerating canonical data from legacy cards.",
    )
    args = parser.parse_args()
    result = rebuild(args.canonical_input)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())