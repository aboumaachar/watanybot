import os
import sqlite3
import tempfile
import pytest

from config import settings


@pytest.fixture(scope="function")
def sqlite_kb():
    prev_path = settings.kb_sqlite_path
    fd, path = tempfile.mkstemp(suffix=".sqlite")
    os.close(fd)

    conn = sqlite3.connect(path)
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE transactions (tx_no TEXT PRIMARY KEY, title_ar TEXT, summary_ar TEXT, required_docs_ar TEXT, submit_location_ar TEXT, steps_ar TEXT, notes_ar TEXT, duration_ar TEXT, fees_ar TEXT)")
    cursor.execute("CREATE TABLE tx_links (tx_no TEXT, related_tx_no TEXT, weight REAL)")
    cursor.execute("CREATE TABLE law_sources (id INTEGER PRIMARY KEY, title TEXT)")
    cursor.execute("CREATE TABLE law_articles (article_no TEXT PRIMARY KEY, title TEXT, body TEXT, source TEXT)")
    cursor.execute("CREATE TABLE tx_law_map (tx_no TEXT, article_no TEXT, relevance REAL, rationale TEXT)")
    cursor.execute("CREATE VIRTUAL TABLE tx_fts USING fts5(tx_no, content='transactions', content_rowid='rowid')")
    cursor.execute("CREATE VIRTUAL TABLE law_fts USING fts5(article_no, preview)")

    cursor.execute(
        "INSERT INTO transactions (tx_no, title_ar, summary_ar, required_docs_ar, submit_location_ar, steps_ar, notes_ar, duration_ar, fees_ar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ("TX-001", "طلب إفادة", "ملخص المعاملة", "هوية", "الوزارة", "خطوة 1", "ملاحظة", "10 أيام", "مجاني")
    )
    cursor.execute("INSERT INTO tx_fts (rowid, tx_no) VALUES (1, ?)", ("TX-001",))

    cursor.execute("INSERT INTO law_articles (article_no, title, body, source) VALUES (?, ?, ?, ?)", ("A-10", "مادة 10", "نص المادة", "ND Law"))
    cursor.execute("INSERT INTO law_fts (article_no, preview) VALUES (?, ?)", ("A-10", "نص المادة"))
    cursor.execute("INSERT INTO tx_law_map (tx_no, article_no, relevance, rationale) VALUES (?, ?, ?, ?)", ("TX-001", "A-10", 0.9, "مرتبطة بالمعاملة"))

    conn.commit()
    conn.close()

    settings.kb_sqlite_path = path
    yield path

    settings.kb_sqlite_path = prev_path

    os.remove(path)


def test_kb_v3_diagnostics(client, sqlite_kb, admin_token):
    response = client.get("/api/admin/kb/diagnostics", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["overall_status"] in {"ok", "warning"}
    assert data["counts"]["transactions"] == 1


def test_procedure_search(client, sqlite_kb):
    response = client.get("/api/procedures/search?q=طلب&lang=ar")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["tx_no"] == "TX-001"


def test_procedure_detail(client, sqlite_kb):
    response = client.get("/api/procedures/TX-001?lang=ar")
    assert response.status_code == 200
    data = response.json()
    assert data["tx_no"] == "TX-001"
    assert data["legal_basis"]


def test_law_search(client, sqlite_kb):
    response = client.get("/api/law/search?q=نص")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


def test_law_detail(client, sqlite_kb):
    response = client.get("/api/law/A-10")
    assert response.status_code == 200
    data = response.json()
    assert data["article_no"] == "A-10"
