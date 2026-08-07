#!/usr/bin/env python3
"""Build the backend v4 KB from the current KB Studio WatanyBot export."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import rebuild_full_procedures_kb as full_rebuild


REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_EXPORT_ROOT_CANDIDATES = [
    REPO_ROOT / "kb_studio" / "runtime" / "exports" / "watanybot",
    REPO_ROOT.parent / "kb-studio" / "runtime" / "exports" / "watanybot",
]
BRIDGE_CANONICAL_OUTPUT = REPO_ROOT / "data" / "kb_rebuild_v4" / "full_procedures.from_kb_studio.canonical.json"

SOURCE_AUTHORITY_MAP = {
    "watany_laf_html": ("lebanese_army", "الجيش اللبناني"),
    "watany_mof_html": ("ministry_of_finance", "وزارة المالية"),
    "watany_procedures_docx": ("administration", "المرجع الإداري المختص"),
}

CATEGORY_HINTS = {
    "طبابة": ("health_medical", "medical_assistance"),
    "معالجة": ("health_medical", "medical_assistance"),
    "صحي": ("health_medical", "medical_records"),
    "وفاة": ("death_inheritance", "death_procedures"),
    "ورثة": ("death_inheritance", "inheritance_rights"),
    "أرملة": ("death_inheritance", "inheritance_rights"),
    "إرث": ("death_inheritance", "inheritance_rights"),
    "مدرس": ("education", ""),
    "دراسة": ("education", ""),
    "مساعدة مالية": ("financial", ""),
    "تقاعد": ("financial", ""),
    "معاش": ("financial", ""),
    "تعويض": ("financial", ""),
    "بطاقة": ("health_medical", "service_cards"),
    "زوجة": ("spouse_coverage", ""),
    "زوج": ("spouse_coverage", ""),
    "والد": ("parent_coverage", ""),
    "والدة": ("parent_coverage", ""),
    "ابنة": ("family_benefits", "dependent_management"),
    "ابن": ("family_benefits", "dependent_management"),
    "عائلة": ("family_benefits", "dependent_management"),
    "عائلات": ("family_benefits", "dependent_management"),
    "رخصة": ("licenses_permits", ""),
    "تصريح": ("legal_documentation", ""),
}

PUBLIC_TITLE_REJECT_PATTERNS = (
    re.compile(r"^(?:القسم|الباب|الفصل|الكتاب)\s+"),
    re.compile(r"^(?:أقسام الكتاب|اقسام الكتاب|اضغط على القسم)\b"),
    re.compile(r"^(?:احكام|أحكام)\b"),
    re.compile(r"^(?:ارقام هواتف|أرقام هواتف)\b"),
    re.compile(r"^(?:رابط|لينك)\b"),
    re.compile(r"^دوام العمل\b"),
    re.compile(r"^(?:ايجاز|إيجاز)\b"),
)
PUBLIC_TITLE_REJECT_SUBSTRINGS = (
    "أقسام الكتاب",
    "اقسام الكتاب",
    "اضغط على القسم أدناه",
    "اضغط على القسم",
)

LEGAL_FRAGMENT_TITLE_REJECT_PATTERNS = (
    re.compile(r"^[0-9٠-٩]+\s*\(\s*أضيفت\s+بموجب", re.IGNORECASE),
    re.compile(r"^مكرر\s*\(\s*أضيفت\s+بموجب", re.IGNORECASE),
    re.compile(r"^مادة\s*[0-9٠-٩]+", re.IGNORECASE),
)

GENERIC_LEGAL_FRAGMENT_TITLES = {
    "الوضع القانوني",
    "الوظائف",
    "المسؤولية المدنية",
    "الغاء الوظيفة",
    "طلب الاعتمادات",
    "تعريف الانتداب",
    "تأليف مجلس التأديب",
    "حقوق الوكيل وواجباته",
    "حالات عدم استحقاق تعويض الصرف",
    "مراعاة احكام الدستور",
    "تسريح الاجير",
    "الاحكام القانونية",
    "استخدام الاجراء",
}

NOISY_REQUIREMENT_EXACT = {
    "المستندات المطلوبة",
    "تحميل المستند",
    "تحميل الملف",
}

AUTHORITY_REJECT_PATTERNS = (
    re.compile(r"^[0-9٠-٩]+\s*[.)-]\s*"),
    re.compile(r"^(?:أ|ب|ج|د|هـ|و|ز)[-–:]\s*"),
    re.compile(r"^(?:المستندات المطلوبة|تحميل المستند|تحميل الملف)\b"),
    re.compile(r"^(?:إفادة|صورة عن|إثبات|كتاب من صاحب العلاقة|تعبئة أنموذج|نسخة عن|بيان قيد|بطاقة الهوية|بطاقة المحاماة)\b"),
)

INLINE_REQUIREMENT_MARKER = re.compile(r"(?:^|\s)([0-9٠-٩]+\s*[.)-])\s*")
LAF_REQUIREMENT_STARTS = (
    "كتاب من صاحب العلاقة",
    "تعبئة أنموذج",
    "إفادة عقارية",
    "إفادة إرتفاق",
    "إفادة ارتفاق",
    "صورة عن مشروع",
    "صورة عن المستندات",
    "إثبات الملكية",
    "إثبات هوية صاحب العلاقة",
    "إثبات قانونية الإيداع",
    "إثبات هوية المودع",
    "مستندات إضافية",
    "لائحة مفصلة",
    "تقارير طبية",
)


def resolve_export_root(cli_value: Path | None) -> Path:
    candidates = [cli_value] if cli_value is not None else []
    candidates.extend(DEFAULT_EXPORT_ROOT_CANDIDATES)
    for candidate in candidates:
        if candidate is not None and candidate.exists():
            return candidate
    raise FileNotFoundError("Unable to locate KB Studio WatanyBot export root")


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


def parse_doc_topic_no(proc: Dict[str, Any], fallback: int) -> int:
    for value in (proc.get("procedure_number"), proc.get("id"), proc.get("title_ar")):
        if value is None:
            continue
        match = re.search(r"(\d+)", str(value))
        if match:
            return int(match.group(1))
    return fallback


def normalize_public_text(text: str) -> str:
    cleaned = full_rebuild.normalize_spaces(text)
    for fragment in PUBLIC_TITLE_REJECT_SUBSTRINGS:
        cleaned = cleaned.replace(fragment, " ")
    cleaned = full_rebuild.normalize_spaces(cleaned)
    while cleaned:
        updated = re.sub(r"(?<![\u0600-\u06FFA-Za-z])(?:[.:\-_/]\s*|\s+)[0-9٠-٩]{1,3}$", "", cleaned).strip(" .:-،؛/")
        if updated == cleaned:
            break
        cleaned = full_rebuild.normalize_spaces(updated)
    return cleaned


def sanitize_public_title(title: str) -> str:
    cleaned = normalize_public_text(title)
    if not cleaned or len(cleaned) < 4 or len(cleaned) > 140:
        return ""
    if len(re.findall(r"[0-9٠-٩]+\s*[-_.]\s*[\u0600-\u06FFA-Za-z]", cleaned)) >= 2:
        return ""
    if any(pattern.search(cleaned) for pattern in PUBLIC_TITLE_REJECT_PATTERNS):
        return ""
    return cleaned


def is_non_actionable_legal_fragment(proc: Dict[str, Any], title: str, summary: str) -> bool:
    source_primary_id = str(proc.get("source_primary_id") or "")
    if source_primary_id not in {
        "watany_retirement_txt",
        "watany_national_defense_txt",
        "watany_labor_txt",
        "watany_employees_txt",
        "watany_compensations_txt",
    }:
        return False

    normalized_title = normalize_public_text(title).strip("* ")
    normalized_summary = normalize_public_text(summary)

    if any(pattern.search(normalized_title) for pattern in LEGAL_FRAGMENT_TITLE_REJECT_PATTERNS):
        return True

    if normalized_title in GENERIC_LEGAL_FRAGMENT_TITLES:
        return True

    if normalized_summary.startswith("المادة") and not any(
        sanitize_text_list(list(proc.get(key, []) or []))
        for key in ("requirements", "steps", "where_to_apply", "fees", "timelines", "contacts", "eligibility")
    ):
        return True

    return False


def sanitize_text_list(values: List[Any]) -> List[str]:
    rows: List[str] = []
    seen = set()
    for value in values:
        cleaned = normalize_public_text(str(value or ""))
        if not cleaned or re.fullmatch(r"[0-9٠-٩]+", cleaned):
            continue
        if any(pattern.search(cleaned) for pattern in PUBLIC_TITLE_REJECT_PATTERNS):
            continue
        if cleaned in seen:
            continue
        seen.add(cleaned)
        rows.append(cleaned)
    return rows


def has_substantive_content(proc: Dict[str, Any], summary: str) -> bool:
    for key in ("requirements", "steps", "where_to_apply", "fees", "timelines", "contacts", "eligibility"):
        if sanitize_text_list(list(proc.get(key, []) or [])):
            return True
    return bool(summary)


def infer_category(title: str, tags: List[str]) -> tuple[str, str]:
    haystack = " ".join([title, *tags])
    for hint, mapped in CATEGORY_HINTS.items():
        if hint in haystack:
            return mapped[0], full_rebuild.normalize_subcategory(mapped[0], mapped[1])
    return "administrative", "changes_updates"


def infer_audience_scope(title: str, tags: List[str], category_id: str) -> str:
    haystack = " ".join([title, *tags])
    if any(token in haystack for token in ("عائلات", "ورثة", "أرملة", "ابنة", "ابن", "زوجة", "زوج")):
        return "RET_ARMY_FAMILIES"
    if category_id in {"financial", "education"}:
        return "RET_ALL_FORCES_FINANCE"
    return "RET_ARMY_ONLY"


def infer_applies_to(title: str, tags: List[str], audience_scope: str) -> List[str]:
    haystack = " ".join([title, *tags])
    applies_to = ["retired_military"]
    if audience_scope == "RET_ALL_FORCES_FINANCE":
        applies_to = ["retired_military", "all_veterans"]
    if any(token in haystack for token in ("عائلات", "ورثة", "أرملة", "زوجة", "زوج", "ابنة", "ابن")):
        applies_to.append("family_members")
    return full_rebuild.unique_strings(applies_to)


def normalize_requirement(text: str) -> str:
    cleaned = full_rebuild.normalize_spaces(text)
    cleaned = re.sub(r"^(المستندات المطلوبة|الوراق المطلوبة تشمل)\s*[:：-]?\s*", "", cleaned)
    cleaned = re.sub(r"^[0-9٠-٩]+[\.)-]\s*", "", cleaned)
    return cleaned.strip(" -:،")


def split_inline_numbered_requirements(text: str) -> List[str]:
    cleaned = full_rebuild.normalize_spaces(text)
    matches = list(INLINE_REQUIREMENT_MARKER.finditer(cleaned))
    if len(matches) < 2:
        return [cleaned] if cleaned else []

    rows: List[str] = []
    for index, match in enumerate(matches):
        start = match.start(1)
        end = matches[index + 1].start(1) if index + 1 < len(matches) else len(cleaned)
        chunk = cleaned[start:end].strip()
        normalized = normalize_requirement(chunk)
        if normalized:
            rows.append(normalized)
    return rows


def split_laf_requirement_dump(text: str) -> List[str]:
    cleaned = full_rebuild.normalize_spaces(text)
    if not cleaned:
        return []

    rows = split_inline_numbered_requirements(cleaned)
    if len(rows) > 1:
        return rows

    positions = sorted(
        {
            cleaned.find(prefix)
            for prefix in LAF_REQUIREMENT_STARTS
            if cleaned.find(prefix) > 0
        }
    )
    if not positions:
        return [cleaned]

    split_points = [0, *positions, len(cleaned)]
    parts: List[str] = []
    for index in range(len(split_points) - 1):
        start = split_points[index]
        end = split_points[index + 1]
        chunk = cleaned[start:end].strip(" ،")
        normalized = normalize_requirement(chunk)
        if normalized:
            parts.append(normalized)
    return parts or [cleaned]


def is_noise_requirement(text: str) -> bool:
    cleaned = normalize_requirement(text)
    if not cleaned:
        return True
    if "…" in cleaned or cleaned.endswith("..."):
        return True
    if cleaned in NOISY_REQUIREMENT_EXACT:
        return True
    return cleaned.startswith("تحميل ")


def looks_like_authority_candidate(text: str, procedure_title: str) -> bool:
    cleaned = full_rebuild.normalize_spaces(text)
    if not cleaned:
        return False
    if cleaned == procedure_title:
        return False
    if any(pattern.search(cleaned) for pattern in AUTHORITY_REJECT_PATTERNS):
        return False
    if "طلب " in cleaned and re.match(r"^[0-9٠-٩]+\s*[.)-]\s*طلب\s+", cleaned):
        return False
    if len(cleaned) > 120:
        return False
    return True


def looks_like_process_timeline(text: str) -> bool:
    cleaned = full_rebuild.normalize_spaces(text)
    if not cleaned:
        return False
    if "لا يتعدى تاريخ إصدارها" in cleaned:
        return False
    if any(pattern.search(cleaned) for pattern in AUTHORITY_REJECT_PATTERNS[:2]):
        return False
    return any(token in cleaned for token in ("مهلة", "خلال", "قبل", "بعد", "يوم", "أيام", "أسبوع", "أسابيع", "شهر", "أشهر", "سنة", "سنوات"))


def looks_like_requirement_dump(text: str) -> bool:
    cleaned = full_rebuild.normalize_spaces(text)
    if not cleaned:
        return False
    if cleaned.startswith("تحميل المستند المستندات المطلوبة"):
        return True
    if cleaned.startswith("المستندات المطلوبة") or cleaned.startswith("الوراق المطلوبة"):
        return True
    hint_count = sum(1 for hint in LAF_REQUIREMENT_STARTS if hint in cleaned)
    numbered_count = len(re.findall(r"[0-9٠-٩]+\s*[.)-]", cleaned))
    return hint_count >= 3 or numbered_count >= 2


def extract_requirement_values(proc: Dict[str, Any]) -> List[str]:
    values: List[str] = []
    for value in proc.get("requirements", []) or []:
        normalized = normalize_public_text(str(value))
        if not normalized:
            continue
        values.extend(split_laf_requirement_dump(normalized))

    if str(proc.get("source_primary_id") or "") == "watany_laf_html":
        summary = normalize_public_text(str(proc.get("summary_lb") or ""))
        if looks_like_requirement_dump(summary):
            summary_requirements = re.sub(
                r"^(?:تحميل المستند\s+)?(?:المستندات المطلوبة|الوراق المطلوبة تشمل)\s*[:：-]?\s*",
                "",
                summary,
            )
            values.extend(split_laf_requirement_dump(summary_requirements))

    rows: List[str] = []
    seen = set()
    for value in values:
        normalized = normalize_requirement(value)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        rows.append(normalized)
    return rows


def build_short_description(proc: Dict[str, Any], title: str, authority_name: str, required_documents: List[Dict[str, Any]]) -> str:
    raw_summary = normalize_public_text(str(proc.get("summary_lb") or ""))
    if raw_summary and not looks_like_requirement_dump(raw_summary):
        return raw_summary
    return full_rebuild.derive_short_description(title, authority_name, [item["name_ar"] for item in required_documents])


def build_required_documents(values: List[str]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for value in values:
        name = normalize_requirement(value)
        if is_noise_requirement(name):
            continue
        rows.append(
            {
                "name_ar": name,
                "doc_type_id": full_rebuild.infer_doc_type_id(name),
                "issuer_guess": full_rebuild.infer_issuer_guess(name),
                "validity_days": None,
                "required_for": "general",
                "copy_type": full_rebuild.infer_copy_type(name),
                "condition_rule": full_rebuild.infer_condition_rule(name),
            }
        )
    deduped: List[Dict[str, Any]] = []
    seen = set()
    for row in rows:
        key = row["name_ar"]
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)
    return deduped[:15]


def build_steps(proc: Dict[str, Any], authority_name: str, required_documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    raw_steps = [full_rebuild.normalize_spaces(step) for step in proc.get("steps", []) if full_rebuild.normalize_spaces(step)]
    if not raw_steps:
        deadlines = [
            full_rebuild.normalize_spaces(value)
            for value in proc.get("timelines", [])
            if looks_like_process_timeline(str(value))
        ]
        raw_steps = full_rebuild.build_structured_steps(
            str(proc.get("title_ar") or proc.get("id") or "المعاملة"),
            [authority_name] if authority_name else [],
            [item["name_ar"] for item in required_documents],
            deadlines,
            str(proc.get("summary_lb") or ""),
        )

    rows: List[Dict[str, Any]] = []
    for index, text in enumerate(raw_steps, start=1):
        rows.append(
            {
                "title_ar": f"الخطوة {index}",
                "text_ar": text,
                "authority_guess": authority_name,
                "channel_guess": "in_person",
                "action_code": "submit_request" if ("قد" in text or "توج" in text or "راجع" in text) else "collect_documents",
            }
        )
    return rows[:6]


def build_steps_with_title(
    proc: Dict[str, Any],
    title: str,
    authority_name: str,
    required_documents: List[Dict[str, Any]],
    summary: str,
) -> List[Dict[str, Any]]:
    proc_with_title = dict(proc)
    proc_with_title["title_ar"] = title
    proc_with_title["summary_lb"] = summary
    return build_steps(proc_with_title, authority_name, required_documents)


def build_primary_authority(proc: Dict[str, Any], directory_titles: List[str]) -> Dict[str, Any]:
    procedure_title = sanitize_public_title(str(proc.get("title_ar") or proc.get("title_lb") or proc.get("id") or ""))
    where_to_apply = [full_rebuild.normalize_spaces(value) for value in proc.get("where_to_apply", []) if full_rebuild.normalize_spaces(value)]
    contacts = [full_rebuild.normalize_spaces(value) for value in proc.get("contacts", []) if full_rebuild.normalize_spaces(value)]
    source_primary_id = str(proc.get("source_primary_id") or "")
    authority_id, authority_name = SOURCE_AUTHORITY_MAP.get(source_primary_id, ("administration", "المرجع الإداري المختص"))
    for candidate in [*where_to_apply, *contacts, *directory_titles]:
        if looks_like_authority_candidate(candidate, procedure_title):
            authority_name = candidate
            break
    return {
        "id": f"authority_{full_rebuild.stable_token(authority_id, 'authority')}",
        "name_ar": authority_name,
        "authority_type": authority_id,
        "applies_to": "general",
        "notes_ar": "مستخرج من KB Studio WatanyBot export.",
    }


def build_links_contacts(
    proc: Dict[str, Any],
    authority_name: str,
    linked_docs: List[Dict[str, Any]],
    linked_directories: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    procedure_title = sanitize_public_title(str(proc.get("title_ar") or proc.get("title_lb") or proc.get("id") or ""))
    rows: List[Dict[str, Any]] = [
        {
            "kind": "authority",
            "value": authority_name,
            "label_ar": authority_name,
            "source_scope": "authority",
        }
    ]

    for entry in proc.get("where_to_apply", []) or []:
        value = full_rebuild.normalize_spaces(entry)
        if looks_like_authority_candidate(value, procedure_title):
            rows.append({"kind": "office", "value": value, "label_ar": value, "source_scope": "procedure"})

    for entry in proc.get("contacts", []) or []:
        value = full_rebuild.normalize_spaces(entry)
        if looks_like_authority_candidate(value, procedure_title):
            rows.append({"kind": "reference", "value": value, "label_ar": value, "source_scope": "procedure"})

    for source_ref in proc.get("source_refs", []) or []:
        source_path = full_rebuild.normalize_spaces(str((source_ref or {}).get("source_path") or ""))
        anchor = full_rebuild.normalize_spaces(str((source_ref or {}).get("anchor") or ""))
        if source_path:
            rows.append(
                {
                    "kind": "source_file",
                    "value": source_path,
                    "label_ar": anchor or source_path,
                    "source_scope": "source_material",
                }
            )

    for document in linked_docs:
        preview_url = full_rebuild.normalize_spaces(str(document.get("preview_url") or document.get("download_url") or document.get("share_url") or ""))
        label = full_rebuild.normalize_spaces(str(document.get("title") or document.get("id") or preview_url))
        if preview_url and looks_like_authority_candidate(label, procedure_title):
            rows.append(
                {
                    "kind": "url",
                    "value": preview_url,
                    "label_ar": label,
                    "source_scope": "document_asset",
                }
            )

    for directory_entry in linked_directories:
        label = full_rebuild.normalize_spaces(str(directory_entry.get("title") or directory_entry.get("organization") or ""))
        if looks_like_authority_candidate(label, procedure_title):
            rows.append({"kind": "office", "value": label, "label_ar": label, "source_scope": "directory_entry"})

    deduped: List[Dict[str, Any]] = []
    seen = set()
    for row in rows:
        key = (row.get("kind"), row.get("value"))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)
    return deduped[:12]


def build_related_topics(proc: Dict[str, Any], linked_docs: List[Dict[str, Any]], linked_directories: List[Dict[str, Any]]) -> List[str]:
    procedure_title = sanitize_public_title(str(proc.get("title_ar") or proc.get("title_lb") or proc.get("id") or ""))
    rows: List[str] = []
    rows.extend(proc.get("tags", []) or [])
    rows.extend(
        entry.get("title", "")
        for entry in linked_docs
        if looks_like_authority_candidate(str(entry.get("title") or ""), procedure_title)
    )
    rows.extend(
        entry.get("title", "")
        for entry in linked_directories
        if looks_like_authority_candidate(str(entry.get("title") or entry.get("organization") or ""), procedure_title)
    )
    return sanitize_text_list(rows)[:12]


def build_governing_laws(proc: Dict[str, Any]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for source_ref in proc.get("source_refs", []) or []:
        anchor = full_rebuild.normalize_spaces(str((source_ref or {}).get("anchor") or ""))
        source_path = Path(str((source_ref or {}).get("source_path") or ""))
        law_name = source_path.stem if source_path.stem else "مرجع إداري"
        rows.append(
            {
                "law_name_ar": law_name,
                "article_number": "",
                "text_excerpt": anchor,
            }
        )
    deduped: List[Dict[str, Any]] = []
    seen = set()
    for row in rows:
        key = (row["law_name_ar"], row["text_excerpt"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)
    return deduped[:4]


def build_faqs(proc: Dict[str, Any], title: str, authority_name: str) -> List[Dict[str, str]]:
    faqs = []
    for question in full_rebuild.unique_strings([title, *(proc.get("faq_variants", []) or [])])[:5]:
        faqs.append(
            {
                "question_ar": question,
                "answer_ar": f"تُراجع معاملة {title} لدى {authority_name} وفق المستندات والخطوات الواردة في التحديث الصادر من KB Studio.",
            }
        )
    return faqs


def build_important_notes(proc: Dict[str, Any]) -> List[str]:
    rows: List[str] = []
    rows.extend(value for value in (proc.get("timelines", []) or []) if looks_like_process_timeline(str(value)))
    rows.extend(proc.get("fees", []) or [])
    rows.extend(proc.get("exceptions", []) or [])
    summary = normalize_public_text(str(proc.get("summary_lb") or ""))
    if summary and not looks_like_requirement_dump(summary):
        rows.append(summary)
    return sanitize_text_list(rows)[:8]


def build_user_questions(proc: Dict[str, Any], title: str) -> List[str]:
    return sanitize_text_list([title, *(proc.get("faq_variants", []) or [])])[:10]


def build_canonical_record(
    proc: Dict[str, Any],
    fallback_topic_no: int,
    docs_by_id: Dict[str, Dict[str, Any]],
    directories_by_id: Dict[str, Dict[str, Any]],
) -> Dict[str, Any] | None:
    title = sanitize_public_title(str(proc.get("title_ar") or proc.get("title_lb") or proc.get("id") or "معاملة"))
    if not title:
        return None
    raw_summary = normalize_public_text(str(proc.get("summary_lb") or ""))
    if is_non_actionable_legal_fragment(proc, title, raw_summary):
        return None
    tags = sanitize_text_list(list(proc.get("tags", []) or []))
    category_id, subcategory_id = infer_category(title, tags)
    audience_scope = infer_audience_scope(title, tags, category_id)
    requirement_values = extract_requirement_values(proc)
    required_documents = build_required_documents(requirement_values)
    if not has_substantive_content(proc, raw_summary):
        return None

    linked_docs = [docs_by_id[doc_id] for doc_id in proc.get("linked_docs", []) if doc_id in docs_by_id]
    linked_directories = [directories_by_id[directory_id] for directory_id in proc.get("linked_directory_entries", []) if directory_id in directories_by_id]
    directory_titles = [full_rebuild.normalize_spaces(str(entry.get("title") or entry.get("organization") or "")) for entry in linked_directories]
    primary_authority = build_primary_authority(proc, [title for title in directory_titles if title])
    authority_name = str(primary_authority["name_ar"])
    summary = build_short_description(proc, title, authority_name, required_documents)

    updated_at = str(proc.get("updated_at") or datetime.now(timezone.utc).isoformat())
    updated_date = updated_at.split("T", 1)[0]
    summary = summary or raw_summary or title
    keyword_candidates = sanitize_text_list([*tags, *full_rebuild.extract_keyword_candidates(title, summary)])
    semantic_candidates = sanitize_text_list([*tags, *full_rebuild.extract_keyword_candidates(title)])

    return {
        "canonical_id": full_rebuild.stable_token(str(proc.get("id") or title), "proc"),
        "doc_topic_no": parse_doc_topic_no(proc, fallback_topic_no),
        "category_id": category_id,
        "subcategory_id": subcategory_id,
        "title_ar": title,
        "short_description_ar": summary,
        "audience_scope": audience_scope,
        "applies_to": infer_applies_to(title, tags, audience_scope),
        "user_questions": build_user_questions(proc, title),
        "keywords_ar": keyword_candidates[:14],
        "semantic_tags": semantic_candidates[:10],
        "updated_date": updated_date,
        "primary_authority": primary_authority,
        "required_documents": required_documents,
        "steps": build_steps_with_title(proc, title, authority_name, required_documents, summary),
        "eligibility_rules": sanitize_text_list(list(proc.get("eligibility", []) or [])),
        "links_contacts": build_links_contacts(proc, authority_name, linked_docs, linked_directories),
        "governing_laws": build_governing_laws(proc),
        "faqs": build_faqs(proc, title, authority_name),
        "important_notes": build_important_notes(proc),
        "related_topics": build_related_topics(proc, linked_docs, linked_directories),
        "source": "kb_studio_export",
    }


def build_canonical_payload(export_root: Path) -> Dict[str, Any]:
    manifest = read_json(export_root / "manifest.json")
    procedures = read_jsonl(export_root / "procedures.jsonl")
    documents = read_jsonl(export_root / "documents.jsonl")
    directory_entries = read_jsonl(export_root / "directory_entries.jsonl")
    docs_by_id = {row["id"]: row for row in documents}
    directories_by_id = {row["id"]: row for row in directory_entries}

    rows = [
        row
        for index, proc in enumerate(procedures, start=1)
        for row in [build_canonical_record(proc, index, docs_by_id, directories_by_id)]
        if row is not None
    ]

    return {
        "version": "kb-studio-export-v1",
        "generated_at": str(manifest.get("generated_at") or datetime.now(timezone.utc).isoformat()),
        "source": str(export_root),
        "procedures": rows,
    }


def rebuild_from_export(export_root: Path) -> Dict[str, Any]:
    canonical_payload = build_canonical_payload(export_root)
    BRIDGE_CANONICAL_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    BRIDGE_CANONICAL_OUTPUT.write_text(json.dumps(canonical_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    result = full_rebuild.rebuild(BRIDGE_CANONICAL_OUTPUT)
    result["bridge_canonical_output"] = str(BRIDGE_CANONICAL_OUTPUT)
    result["bridge_export_root"] = str(export_root)
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Rebuild Watany backend v4 KB from the KB Studio export.")
    parser.add_argument("--export-root", type=Path, help="Path to the KB Studio runtime export root for WatanyBot.")
    args = parser.parse_args()

    export_root = resolve_export_root(args.export_root)
    result = rebuild_from_export(export_root)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())