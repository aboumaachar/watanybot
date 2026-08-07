import os
import sqlite3
import tempfile
from typing import Iterator

import pytest
from fastapi.testclient import TestClient
from httpx import Response

from config import settings
from kb_sqlite import invalidate_conn_cache
from main import app
from services.kb_v2_service import _format_procedure_answer


@pytest.fixture(scope="function")
def sqlite_kb_v4() -> Iterator[str]:
    prev_path = settings.kb_sqlite_path
    fd, path = tempfile.mkstemp(suffix=".sqlite")
    os.close(fd)

    conn = sqlite3.connect(path)
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE kb_transactions (
            doc_topic_no INTEGER PRIMARY KEY,
            title_ar TEXT,
            section_name_ar TEXT,
            keywords_ar TEXT,
            body_ar TEXT
        )
        """
    )
    cursor.execute(
        "CREATE TABLE kb_rag_chunks (chunk_id TEXT PRIMARY KEY, doc_topic_no INTEGER, text TEXT, metadata_json TEXT)"
    )
    cursor.execute(
        "CREATE VIRTUAL TABLE kb_rag_fts USING fts5(doc_topic_no UNINDEXED, text, metadata_json UNINDEXED)"
    )

    medical_title = "طلب تصريح بالإستفادة (أو عدم الاستفادة ) من خدمات الطبابة العسكرية"
    social_title = "طلب الحصول على بطاقة خدمات اجتماعية ل(صفة القرابة)شهيد (تصنيف الشهيد)"

    cursor.execute(
        "INSERT INTO kb_transactions (doc_topic_no, title_ar, section_name_ar, keywords_ar, body_ar) VALUES (?, ?, ?, ?, ?)",
        (
            1,
            medical_title,
            "الخدمات الطبية",
            "بطاقة الخدمات الصحية بطاقة صحية بطاقة الطبابة طبابة عسكرية",
            "خدمات الطبابة العسكرية وتصريح الاستفادة الصحية",
        ),
    )
    cursor.execute(
        "INSERT INTO kb_transactions (doc_topic_no, title_ar, section_name_ar, keywords_ar, body_ar) VALUES (?, ?, ?, ?, ?)",
        (
            2,
            social_title,
            "الخدمات الاجتماعية",
            "بطاقة خدمات اجتماعية شهيد",
            "بطاقة اجتماعية وخدمات اجتماعية",
        ),
    )

    cursor.execute(
        "INSERT INTO kb_rag_chunks (chunk_id, doc_topic_no, text, metadata_json) VALUES (?, ?, ?, ?)",
        (
            "chunk-1",
            1,
            "بطاقة الخدمات الصحية وخدمات الطبابة العسكرية",
            '{"title_ar":"' + medical_title + '","section_name_ar":"الخدمات الطبية"}',
        ),
    )
    cursor.execute(
        "INSERT INTO kb_rag_chunks (chunk_id, doc_topic_no, text, metadata_json) VALUES (?, ?, ?, ?)",
        (
            "chunk-2",
            2,
            "بطاقة خدمات اجتماعية للشهيد",
            '{"title_ar":"' + social_title + '","section_name_ar":"الخدمات الاجتماعية"}',
        ),
    )
    cursor.execute(
        "INSERT INTO kb_rag_fts (doc_topic_no, text, metadata_json) VALUES (?, ?, ?)",
        (1, "بطاقة الخدمات الصحية وخدمات الطبابة العسكرية", '{"title_ar":"' + medical_title + '","section_name_ar":"الخدمات الطبية"}'),
    )
    cursor.execute(
        "INSERT INTO kb_rag_fts (doc_topic_no, text, metadata_json) VALUES (?, ?, ?)",
        (2, "بطاقة خدمات اجتماعية للشهيد", '{"title_ar":"' + social_title + '","section_name_ar":"الخدمات الاجتماعية"}'),
    )

    conn.commit()
    conn.close()

    settings.kb_sqlite_path = path
    yield path

    invalidate_conn_cache(path)
    settings.kb_sqlite_path = prev_path
    os.remove(path)


@pytest.fixture(scope="function")
def kb_client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.mark.parametrize(
    "query",
    [
        "بطاقة الخدمات الصحية",
        "بطاقة صحية",
        "بطاقة الطبابة",
    ],
)
def test_v4_procedure_search_ranks_medical_card_first(
    kb_client: TestClient,
    sqlite_kb_v4: str,
    query: str,
) -> None:
    response: Response = kb_client.get(f"/api/procedures/search?q={query}&lang=ar&limit=3")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["title"] == "طلب تصريح بالإستفادة (أو عدم الاستفادة ) من خدمات الطبابة العسكرية"


def test_v4_procedure_search_filters_transaction_probe(
    kb_client: TestClient,
    sqlite_kb_v4: str,
) -> None:
    response: Response = kb_client.get("/api/procedures/search?q=transaction_76&lang=ar&limit=3")
    assert response.status_code == 200
    assert response.json() == []


def test_kb_v2_procedure_answer_formats_legal_refs_readably() -> None:
    answer = _format_procedure_answer(
        {
            "title_lb": "طلب تخصيص معاش تقاعدي أو تعويض صرف",
            "summary_lb": "شرح مبسط للمعاملة.",
            "formal_refs": {
                "laws": [
                    {
                        "law_node_id": "law_7f32026fe071f5d8",
                        "law_name": "نظام التقاعد والصرف من الخدمة",
                        "article_number": "26",
                        "source": {"file": "نظام التقاعد والصرف و الخدمة.txt", "article": "26"},
                    },
                    {
                        "law_node_id": "law_42559e3ee2dbc6f6",
                        "law_name": "نظام التعويضات والمساعدات (3950/1960)",
                        "article_number": "3",
                        "source": {"file": "نظام التعويضات والمساعدات.txt", "article": "3"},
                    },
                ]
            },
        }
    )

    assert "law_7f32026fe071f5d8" not in answer
    assert "law_42559e3ee2dbc6f6" not in answer
    assert "نظام التقاعد والصرف من الخدمة — المادة 26" in answer
    assert "نظام التعويضات والمساعدات (3950/1960) — المادة 3" in answer