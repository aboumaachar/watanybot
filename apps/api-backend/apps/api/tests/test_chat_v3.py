import os
import sqlite3
import tempfile
import pytest

from config import settings
from models import FeedbackQueue


@pytest.fixture(scope="function")
def sqlite_kb():
    prev_path = settings.kb_sqlite_path
    prev_use = settings.use_sqlite_v3_kb
    prev_fallback = settings.legacy_postgres_kb_fallback
    prev_threshold = settings.sqlite_confidence_threshold
    fd, path = tempfile.mkstemp(suffix=".sqlite")
    os.close(fd)

    conn = sqlite3.connect(path)
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE transactions (tx_no TEXT PRIMARY KEY, title_ar TEXT, summary_ar TEXT)")
    cursor.execute("CREATE TABLE tx_links (tx_no TEXT, related_tx_no TEXT, weight REAL)")
    cursor.execute("CREATE TABLE law_sources (id INTEGER PRIMARY KEY, title TEXT)")
    cursor.execute("CREATE TABLE law_articles (article_no TEXT PRIMARY KEY, title TEXT, body TEXT, source TEXT)")
    cursor.execute("CREATE TABLE tx_law_map (tx_no TEXT, article_no TEXT, relevance REAL, rationale TEXT)")
    cursor.execute("CREATE VIRTUAL TABLE tx_fts USING fts5(tx_no, content='transactions', content_rowid='rowid')")
    cursor.execute("CREATE VIRTUAL TABLE law_fts USING fts5(article_no, preview)")

    cursor.execute("INSERT INTO transactions (tx_no, title_ar, summary_ar) VALUES (?, ?, ?)", ("TX-002", "معاملة اختبار", "ملخص"))
    cursor.execute("INSERT INTO tx_fts (rowid, tx_no) VALUES (1, ?)", ("TX-002",))
    cursor.execute("INSERT INTO law_articles (article_no, title, body, source) VALUES (?, ?, ?, ?)", ("A-11", "مادة 11", "نص", "ND Law"))
    cursor.execute("INSERT INTO law_fts (article_no, preview) VALUES (?, ?)", ("A-11", "نص"))
    cursor.execute("INSERT INTO tx_law_map (tx_no, article_no, relevance, rationale) VALUES (?, ?, ?, ?)", ("TX-002", "A-11", 0.9, "مرتبطة"))

    conn.commit()
    conn.close()

    settings.kb_sqlite_path = path
    settings.use_sqlite_v3_kb = True
    settings.legacy_postgres_kb_fallback = False
    settings.sqlite_confidence_threshold = 0.0
    yield path

    settings.kb_sqlite_path = prev_path
    settings.use_sqlite_v3_kb = prev_use
    settings.legacy_postgres_kb_fallback = prev_fallback
    settings.sqlite_confidence_threshold = prev_threshold

    os.remove(path)


def test_chat_with_match(client, sqlite_kb):
    response = client.post("/chat/ask", json={"question": "معاملة اختبار", "lang": "ar"})
    assert response.status_code == 200
    data = response.json()
    assert "tx_no=TX-002" in data["answer"]
    assert data["clarifying_question"] is None


def test_chat_without_match_creates_feedback(client, sqlite_kb, db):
    response = client.post("/chat/ask", json={"question": "غير موجود", "lang": "ar"})
    assert response.status_code == 200
    data = response.json()
    assert data["clarifying_question"] is not None

    feedback = db.query(FeedbackQueue).first()
    assert feedback is not None
    assert feedback.question == "غير موجود"
