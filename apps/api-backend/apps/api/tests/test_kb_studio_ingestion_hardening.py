import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[5]
SCRIPTS_DIR = REPO_ROOT / "apps" / "api-backend" / "scripts"
KB_STUDIO_DIR = REPO_ROOT / "kb_studio"

for candidate in (str(SCRIPTS_DIR), str(KB_STUDIO_DIR)):
    if candidate not in sys.path:
        sys.path.insert(0, candidate)

import rebuild_from_kb_studio_export as bridge  # noqa: E402
from kb_studio_parsing import extract_procedure_drafts, sanitize_procedure_title  # noqa: E402


def test_sanitize_procedure_title_strips_reference_suffix_and_rejects_toc_noise():
    assert sanitize_procedure_title("اضافة الابنة الأرملة الى العاتق.31") == "اضافة الابنة الأرملة الى العاتق"
    assert sanitize_procedure_title("أقسام الكتاب اضغط على القسم أدناه") == ""


def test_extract_procedure_drafts_drops_empty_docx_headings_and_keeps_real_procedure():
    paragraphs = [
        "1. خدمات خاصة في الجيش",
        "2. اضافة الابنة الأرملة الى العاتق.31",
        "المستندات المطلوبة: إخراج قيد عائلي",
        "3. الباب الاول",
    ]

    drafts = extract_procedure_drafts(paragraphs, title_min_length=4)

    assert len(drafts) == 1
    assert drafts[0][1].title == "اضافة الابنة الأرملة الى العاتق"
    assert drafts[0][1].body == ["المستندات المطلوبة: إخراج قيد عائلي"]


def test_bridge_build_canonical_record_rejects_non_procedure_titles_even_with_content():
    proc = {
        "id": "PROC-0072",
        "procedure_number": "72",
        "title_ar": "ارقام هواتف قيادة الجيش.50",
        "summary_lb": "أرقام هواتف للاستعلام.",
        "requirements": ["هاتف: 1701"],
        "steps": [],
        "where_to_apply": [],
        "fees": [],
        "timelines": [],
        "contacts": ["هاتف: 1701"],
        "eligibility": [],
        "faq_variants": ["شو رقم قيادة الجيش؟"],
        "tags": ["ارقام هواتف", "قيادة الجيش.50"],
        "linked_docs": [],
        "linked_directory_entries": [],
    }

    assert bridge.build_canonical_record(proc, 72, {}, {}) is None


def test_bridge_build_canonical_record_cleans_title_questions_and_synthetic_steps():
    proc = {
        "id": "PROC-0048",
        "procedure_number": "48",
        "title_ar": "اضافة الابنة الأرملة الى العاتق.31",
        "summary_lb": "إضافة الابنة الأرملة الى العاتق وفق المستندات المطلوبة.",
        "requirements": ["1- إخراج قيد عائلي"],
        "steps": [],
        "where_to_apply": [],
        "fees": [],
        "timelines": [],
        "contacts": [],
        "eligibility": [],
        "faq_variants": ["وين بقدّم اضافة الابنة الأرملة الى العاتق.31"],
        "tags": ["اضافة", "الابنة", "الأرملة", "31"],
        "linked_docs": [],
        "linked_directory_entries": [],
    }

    row = bridge.build_canonical_record(proc, 48, {}, {})

    assert row is not None
    assert row["title_ar"] == "اضافة الابنة الأرملة الى العاتق"
    assert all(".31" not in question for question in row["user_questions"])
    assert ".31" not in row["steps"][0]["text_ar"]
    assert "31" not in row["keywords_ar"]