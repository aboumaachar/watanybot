#!/usr/bin/env python3
"""Build a veterans procedures pilot KB directly into the repo's SQLite v4 runtime shape."""

from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple


DOC_TYPE_NAMES = {
    "DOC_APPLICATION": "طلب/استدعاء",
    "DOC_BANK_INFO": "معلومات مصرفية",
    "DOC_CIVIL_STATUS_FAMILY": "إخراج قيد عائلي",
    "DOC_ENROLLMENT": "إفادة دوام/دراسة",
    "DOC_ID_COPY": "صورة عن الهوية",
    "DOC_NSSF": "إفادة ضمان/ضمان اجتماعي",
    "DOC_RET_BOOK": "دفتر التقاعد",
    "DOC_SERVICE_CARD": "بطاقة خدمات",
}

ACTION_TITLES = {
    "collect_documents": "تجهيز المستندات",
    "submit_request": "تقديم الطلب",
    "follow_up": "متابعة المعاملة",
    "receive_output": "استلام النتيجة",
}


@dataclass
class CategoryMeta:
    id: str
    order: int
    name_ar: str


def stable_id(prefix: str, value: str) -> str:
    digest = hashlib.md5(value.encode("utf-8")).hexdigest()[:12]
    return f"{prefix}_{digest}"


def norm_list(values: Iterable[str]) -> List[str]:
    result = []
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            result.append(text)
    return result


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def load_taxonomy(path: Path) -> Dict[str, CategoryMeta]:
    payload = load_json(path)
    index: Dict[str, CategoryMeta] = {}
    for category in payload.get("categories", []):
        index[category["id"]] = CategoryMeta(
            id=category["id"],
            order=int(category.get("order", 0)),
            name_ar=category.get("name_ar", category["id"]),
        )
    return index


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def render_body(procedure: Dict[str, Any], category_name: str) -> str:
    lines = [
        procedure["title_ar"],
        "",
        f"الفئة: {category_name}",
        procedure.get("short_description_ar", ""),
    ]

    eligibility = norm_list(procedure.get("eligibility_rules", []))
    if eligibility:
        lines.extend(["", "شروط الاستفادة:"])
        lines.extend([f"- {rule}" for rule in eligibility])

    requirements = procedure.get("required_documents", [])
    if requirements:
        lines.extend(["", "الوثائق المطلوبة:"])
        for item in requirements:
            lines.append(f"- {item.get('name_ar', '')}")

    steps = procedure.get("steps", [])
    if steps:
        lines.extend(["", "الخطوات:"])
        for idx, step in enumerate(steps, start=1):
            lines.append(f"{idx}. {step.get('text_ar', '')}")

    laws = procedure.get("governing_laws", [])
    if laws:
        lines.extend(["", "المرجع القانوني:"])
        for law in laws:
            article = law.get("article_number") or ""
            excerpt = law.get("text_excerpt") or ""
            lines.append(f"- {law.get('law_name_ar', '')} {article}: {excerpt}".strip())

    notes = norm_list(procedure.get("important_notes", []))
    if notes:
        lines.extend(["", "ملاحظات:"])
        lines.extend([f"- {note}" for note in notes])

    return "\n".join([line for line in lines if line is not None]).strip()


def build_chunks(procedure: Dict[str, Any], category_name: str) -> List[Dict[str, Any]]:
    metadata_base = {
        "canonical_id": procedure["canonical_id"],
        "doc_topic_no": procedure["doc_topic_no"],
        "title_ar": procedure["title_ar"],
        "section_name_ar": category_name,
        "category_id": procedure["category_id"],
        "subcategory_id": procedure.get("subcategory_id", ""),
        "keywords_ar": procedure.get("keywords_ar", []),
        "semantic_tags": procedure.get("semantic_tags", []),
        "audience_scope": procedure.get("audience_scope", ""),
        "source": procedure.get("source", ""),
    }

    chunks: List[Tuple[str, str]] = []
    overview = "\n".join(
        [
            procedure["title_ar"],
            procedure.get("short_description_ar", ""),
            f"الفئة: {category_name}",
            "أسئلة المستخدم الشائعة: " + " | ".join(norm_list(procedure.get("user_questions", []))),
        ]
    ).strip()
    chunks.append(("overview", overview))

    requirements = procedure.get("required_documents", [])
    if requirements:
        text = "\n".join([f"- {item.get('name_ar', '')}" for item in requirements])
        chunks.append(("documents", text))

    steps = procedure.get("steps", [])
    if steps:
        text = "\n".join([f"{idx}. {item.get('text_ar', '')}" for idx, item in enumerate(steps, start=1)])
        chunks.append(("steps", text))

    laws = procedure.get("governing_laws", [])
    if laws:
        text = "\n".join(
            [
                f"- {law.get('law_name_ar', '')} {law.get('article_number', '')}: {law.get('text_excerpt', '')}".strip()
                for law in laws
            ]
        )
        chunks.append(("legal", text))

    faqs = procedure.get("faqs", [])
    if faqs:
        text = "\n".join([f"س: {item.get('question_ar', '')}\nج: {item.get('answer_ar', '')}" for item in faqs])
        chunks.append(("faq", text))

    notes = norm_list(procedure.get("important_notes", []))
    if notes:
        text = "\n".join([f"- {note}" for note in notes])
        chunks.append(("notes", text))

    rows = []
    for idx, (chunk_type, text) in enumerate(chunks, start=1):
        chunk_id = stable_id(
            f"{procedure['canonical_id']}_{chunk_type}",
            f"{procedure['canonical_id']}::{chunk_type}::{idx}::{text}",
        )
        metadata = dict(metadata_base)
        metadata["chunk_index"] = idx
        metadata["chunk_type"] = chunk_type
        rows.append(
            {
                "chunk_id": chunk_id,
                "chunk_type": chunk_type,
                "doc_topic_no": procedure["doc_topic_no"],
                "text": text,
                "metadata_json": json.dumps(metadata, ensure_ascii=False),
                "review_status": "approved",
            }
        )
    return rows


def create_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        PRAGMA foreign_keys=OFF;

        CREATE TABLE kb_transactions (
          doc_topic_no INTEGER PRIMARY KEY,
          title_ar TEXT,
          section_no INTEGER,
          section_name_ar TEXT,
          audience_scope TEXT,
          category_domain TEXT,
          life_event TEXT,
          updated_date TEXT,
          primary_authority TEXT,
          primary_authority_id TEXT,
          required_docs_canonical_ar TEXT,
          keywords_ar TEXT,
          body_ar TEXT,
          source TEXT,
          review_status TEXT DEFAULT 'approved'
        );

        CREATE TABLE kb_authorities (
          authority_id TEXT PRIMARY KEY,
          name_ar TEXT,
          authority_type TEXT,
          applies_to TEXT,
          notes_ar TEXT
        );

        CREATE TABLE kb_document_types (
          doc_type_id TEXT PRIMARY KEY,
          canonical_name_ar TEXT,
          aliases_ar TEXT
        );

        CREATE TABLE kb_requirements (
          requirement_id TEXT PRIMARY KEY,
          doc_topic_no INTEGER,
          requirement_order INTEGER,
          document_name_ar TEXT,
          doc_type_id TEXT,
          doc_type_canonical_ar TEXT,
          issuer_guess TEXT,
          validity_days TEXT,
          required_for TEXT,
          copy_type TEXT,
          condition_rule TEXT
        );

        CREATE TABLE kb_steps (
          step_id TEXT PRIMARY KEY,
          doc_topic_no INTEGER,
          step_order INTEGER,
          step_title_ar TEXT,
          step_text_ar TEXT,
          authority_guess TEXT,
          authority_id TEXT,
          channel_guess TEXT,
          action_code TEXT,
          action_title_ar TEXT
        );

        CREATE TABLE kb_actions (
          action_id TEXT PRIMARY KEY,
          doc_topic_no INTEGER,
          action_order INTEGER,
          action_code TEXT,
          action_title_ar TEXT,
          instruction_ar TEXT,
          authority_guess TEXT,
          authority_id TEXT,
          channel_guess TEXT
        );

        CREATE TABLE kb_forms (
          form_id TEXT PRIMARY KEY,
          doc_topic_no INTEGER,
          form_code TEXT,
          notes_ar TEXT
        );

        CREATE TABLE kb_eligibility_rules (
          rule_id TEXT PRIMARY KEY,
          doc_topic_no INTEGER,
          rule_text_ar TEXT,
          rule_type_guess TEXT
        );

        CREATE TABLE kb_links_contacts (
          link_id TEXT PRIMARY KEY,
          doc_topic_no INTEGER,
          kind TEXT,
          value TEXT,
          label_ar TEXT,
          source_scope TEXT
        );

        CREATE TABLE kb_relations_explicit (
          relation_id TEXT PRIMARY KEY,
          from_doc_topic_no INTEGER,
          to_doc_topic_no INTEGER,
          relation_type TEXT,
          reason_ar TEXT
        );

        CREATE TABLE kb_relations_inferred (
          relation_id TEXT PRIMARY KEY,
          from_doc_topic_no INTEGER,
          to_doc_topic_no INTEGER,
          relation_type TEXT,
          reason_ar TEXT
        );

        CREATE TABLE kb_rag_chunks (
          chunk_id TEXT PRIMARY KEY,
          chunk_type TEXT,
          doc_topic_no INTEGER,
          text TEXT,
          metadata_json TEXT,
          review_status TEXT DEFAULT 'approved'
        );
        """
    )


def build_rows(procedures: List[Dict[str, Any]], taxonomy: Dict[str, CategoryMeta]) -> Dict[str, List[Dict[str, Any]]]:
    authorities: Dict[str, Dict[str, Any]] = {}
    doc_types: Dict[str, Dict[str, Any]] = {}
    tx_rows: List[Dict[str, Any]] = []
    requirement_rows: List[Dict[str, Any]] = []
    step_rows: List[Dict[str, Any]] = []
    action_rows: List[Dict[str, Any]] = []
    form_rows: List[Dict[str, Any]] = []
    eligibility_rows: List[Dict[str, Any]] = []
    link_rows: List[Dict[str, Any]] = []
    relation_rows: List[Dict[str, Any]] = []
    inferred_rows: List[Dict[str, Any]] = []
    rag_rows: List[Dict[str, Any]] = []

    canonical_to_doc = {item["canonical_id"]: int(item["doc_topic_no"]) for item in procedures}
    procedures_by_category: Dict[str, List[Dict[str, Any]]] = {}

    for procedure in procedures:
        category = taxonomy[procedure["category_id"]]
        procedures_by_category.setdefault(procedure["category_id"], []).append(procedure)
        authority = procedure["primary_authority"]
        authorities[authority["id"]] = {
            "authority_id": authority["id"],
            "name_ar": authority["name_ar"],
            "authority_type": authority.get("authority_type", ""),
            "applies_to": authority.get("applies_to", ""),
            "notes_ar": authority.get("notes_ar", ""),
        }

        canonical_docs = []
        for index, item in enumerate(procedure.get("required_documents", []), start=1):
            doc_type_id = item.get("doc_type_id") or "DOC_APPLICATION"
            doc_types.setdefault(
                doc_type_id,
                {
                    "doc_type_id": doc_type_id,
                    "canonical_name_ar": DOC_TYPE_NAMES.get(doc_type_id, doc_type_id),
                    "aliases_ar": "",
                },
            )
            canonical_docs.append(DOC_TYPE_NAMES.get(doc_type_id, item.get("name_ar", "")))
            requirement_rows.append(
                {
                    "requirement_id": stable_id(
                        f"req_{procedure['canonical_id']}",
                        f"{procedure['canonical_id']}::{index}::{item.get('name_ar', '')}",
                    ),
                    "doc_topic_no": procedure["doc_topic_no"],
                    "requirement_order": index,
                    "document_name_ar": item.get("name_ar", ""),
                    "doc_type_id": doc_type_id,
                    "doc_type_canonical_ar": DOC_TYPE_NAMES.get(doc_type_id, item.get("name_ar", "")),
                    "issuer_guess": item.get("issuer_guess", ""),
                    "validity_days": "" if item.get("validity_days") is None else str(item.get("validity_days")),
                    "required_for": item.get("required_for", ""),
                    "copy_type": item.get("copy_type", ""),
                    "condition_rule": item.get("condition_rule", ""),
                }
            )

        for index, step in enumerate(procedure.get("steps", []), start=1):
            action_code = step.get("action_code", "other")
            action_title = ACTION_TITLES.get(action_code, step.get("title_ar", "إجراء"))
            common = {
                "doc_topic_no": procedure["doc_topic_no"],
                "authority_guess": step.get("authority_guess", authority["name_ar"]),
                "authority_id": authority["id"],
                "channel_guess": step.get("channel_guess", "in_person"),
                "action_code": action_code,
                "action_title_ar": action_title,
            }
            step_rows.append(
                {
                    "step_id": stable_id(
                        f"step_{procedure['canonical_id']}",
                        f"{procedure['canonical_id']}::{index}::{step.get('text_ar', '')}",
                    ),
                    "step_order": index,
                    "step_title_ar": step.get("title_ar", action_title),
                    "step_text_ar": step.get("text_ar", ""),
                    **common,
                }
            )
            action_rows.append(
                {
                    "action_id": stable_id(
                        f"action_{procedure['canonical_id']}",
                        f"{procedure['canonical_id']}::{index}::{action_code}",
                    ),
                    "action_order": index,
                    "instruction_ar": step.get("text_ar", ""),
                    **common,
                }
            )

        for index, rule in enumerate(procedure.get("eligibility_rules", []), start=1):
            eligibility_rows.append(
                {
                    "rule_id": stable_id(
                        f"rule_{procedure['canonical_id']}",
                        f"{procedure['canonical_id']}::{index}::{rule}",
                    ),
                    "doc_topic_no": procedure["doc_topic_no"],
                    "rule_text_ar": rule,
                    "rule_type_guess": "study" if "دراسة" in rule else "other",
                }
            )

        for item in procedure.get("links_contacts", []):
            value = item.get("value", "")
            link_rows.append(
                {
                    "link_id": stable_id(
                        f"link_{procedure['canonical_id']}",
                        f"{procedure['canonical_id']}::{item.get('kind', '')}::{value}",
                    ),
                    "doc_topic_no": procedure["doc_topic_no"],
                    "kind": item.get("kind", "url"),
                    "value": value,
                    "label_ar": item.get("label_ar", ""),
                    "source_scope": item.get("source_scope", ""),
                }
            )

        body_ar = render_body(procedure, category.name_ar)
        tx_rows.append(
            {
                "doc_topic_no": procedure["doc_topic_no"],
                "title_ar": procedure["title_ar"],
                "section_no": category.order,
                "section_name_ar": category.name_ar,
                "audience_scope": procedure.get("audience_scope", ""),
                "category_domain": procedure["category_id"],
                "life_event": procedure.get("life_event", "none"),
                "updated_date": procedure.get("updated_date", ""),
                "primary_authority": authority["name_ar"],
                "primary_authority_id": authority["id"],
                "required_docs_canonical_ar": " | ".join(norm_list(canonical_docs)),
                "keywords_ar": " | ".join(norm_list(procedure.get("keywords_ar", []) + procedure.get("semantic_tags", []))),
                "body_ar": body_ar,
                "source": procedure.get("source", ""),
                "review_status": "approved",
            }
        )

        for related_id in procedure.get("related_topics", []):
            target_doc = canonical_to_doc.get(related_id)
            if not target_doc:
                continue
            relation_rows.append(
                {
                    "relation_id": stable_id(
                        f"rel_{procedure['canonical_id']}",
                        f"{procedure['canonical_id']}::{related_id}",
                    ),
                    "from_doc_topic_no": procedure["doc_topic_no"],
                    "to_doc_topic_no": target_doc,
                    "relation_type": "related",
                    "reason_ar": "ترابط موضوعي بين المعاملتين ضمن تجربة إعادة البناء.",
                }
            )

        rag_rows.extend(build_chunks(procedure, category.name_ar))

    for category_id, items in procedures_by_category.items():
        if len(items) < 2:
            continue
        ordered = sorted(items, key=lambda item: int(item["doc_topic_no"]))
        for left, right in zip(ordered, ordered[1:]):
            inferred_rows.append(
                {
                    "relation_id": stable_id(
                        f"infer_{category_id}",
                        f"{left['doc_topic_no']}::{right['doc_topic_no']}",
                    ),
                    "from_doc_topic_no": left["doc_topic_no"],
                    "to_doc_topic_no": right["doc_topic_no"],
                    "relation_type": "same_category",
                    "reason_ar": "ارتباط مستنتج من الانتماء إلى الفئة نفسها في نسخة الطيار.",
                }
            )

    return {
        "kb_transactions": tx_rows,
        "kb_authorities": list(authorities.values()),
        "kb_document_types": list(doc_types.values()),
        "kb_requirements": requirement_rows,
        "kb_steps": step_rows,
        "kb_actions": action_rows,
        "kb_forms": form_rows,
        "kb_eligibility_rules": eligibility_rows,
        "kb_links_contacts": link_rows,
        "kb_relations_explicit": relation_rows,
        "kb_relations_inferred": inferred_rows,
        "kb_rag_chunks": rag_rows,
    }


def insert_rows(conn: sqlite3.Connection, table_name: str, rows: List[Dict[str, Any]]) -> None:
    if not rows:
        return
    columns = list(rows[0].keys())
    placeholders = ", ".join(["?"] * len(columns))
    sql = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})"
    conn.executemany(sql, [tuple(row.get(column, "") for column in columns) for row in rows])


def create_fts(conn: sqlite3.Connection) -> bool:
    try:
        conn.executescript(
            """
            CREATE VIRTUAL TABLE kb_rag_fts USING fts5(
              text, metadata_json, chunk_type, doc_topic_no,
              content='kb_rag_chunks', content_rowid='rowid'
            );

            INSERT INTO kb_rag_fts(rowid, text, metadata_json, chunk_type, doc_topic_no)
            SELECT rowid, text, metadata_json, chunk_type, doc_topic_no FROM kb_rag_chunks;
            """
        )
        return True
    except sqlite3.DatabaseError:
        return False


def write_jsonl(path: Path, rows: List[Dict[str, Any]]) -> None:
    ensure_parent(path)
    payload = []
    for row in rows:
        metadata = json.loads(row["metadata_json"])
        payload.append(
            json.dumps(
                {
                    "chunk_id": row["chunk_id"],
                    "chunk_type": row["chunk_type"],
                    "doc_topic_no": row["doc_topic_no"],
                    "text": row["text"],
                    "metadata": metadata,
                },
                ensure_ascii=False,
            )
        )
    path.write_text("\n".join(payload) + "\n", encoding="utf-8")


def write_summary(path: Path, rows_by_table: Dict[str, List[Dict[str, Any]]], fts_ok: bool) -> None:
    summary = {
        "fts_enabled": fts_ok,
        "counts": {table: len(rows) for table, rows in rows_by_table.items()},
    }
    ensure_parent(path)
    path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")


def build(input_path: Path, taxonomy_path: Path, output_dir: Path) -> Dict[str, Any]:
    procedures = load_json(input_path).get("procedures", [])
    taxonomy = load_taxonomy(taxonomy_path)
    rows_by_table = build_rows(procedures, taxonomy)

    output_dir.mkdir(parents=True, exist_ok=True)
    sqlite_path = output_dir / "Watany_KB_v4.sqlite"
    jsonl_path = output_dir / "watany_rag_chunks_v4.jsonl"
    summary_path = output_dir / "build_summary.json"

    if sqlite_path.exists():
        sqlite_path.unlink()

    conn = sqlite3.connect(sqlite_path)
    create_schema(conn)
    for table_name, rows in rows_by_table.items():
        insert_rows(conn, table_name, rows)
    fts_ok = create_fts(conn)
    conn.commit()
    conn.close()

    write_jsonl(jsonl_path, rows_by_table["kb_rag_chunks"])
    write_summary(summary_path, rows_by_table, fts_ok)

    return {
        "sqlite": str(sqlite_path),
        "jsonl": str(jsonl_path),
        "summary": str(summary_path),
        "fts_enabled": fts_ok,
        "counts": {table: len(rows) for table, rows in rows_by_table.items()},
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Rebuild a pilot veterans procedures KB into the repo's v4 runtime shape.")
    parser.add_argument(
        "--input",
        default="data/kb_rebuild_v4/pilot_procedures.canonical.json",
        help="Canonical procedures JSON path.",
    )
    parser.add_argument(
        "--taxonomy",
        default="data/kb_rebuild_v4/categories.v2.json",
        help="Category taxonomy JSON path.",
    )
    parser.add_argument(
        "--output",
        default="data/kb_rebuild_v4/output/pilot_v4",
        help="Output directory for SQLite and JSONL artifacts.",
    )
    args = parser.parse_args()

    result = build(Path(args.input), Path(args.taxonomy), Path(args.output))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())