"""PostgreSQL connection helpers for the KB/Cases API."""
from __future__ import annotations
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Any, List, Optional, Tuple

_conn: Optional[psycopg2.extensions.connection] = None

def _get_conn():
    global _conn
    if _conn is None or _conn.closed:
        _conn = psycopg2.connect(
            host=os.getenv("POSTGRES_HOST", "localhost"),
            port=int(os.getenv("POSTGRES_PORT", "5433")),
            dbname=os.getenv("POSTGRES_DB", "salaries"),
            user=os.getenv("POSTGRES_USER", "salaries"),
            password=os.getenv("POSTGRES_PASSWORD", "salaries"),
        )
        _conn.autocommit = True
    return _conn

def fetchone(sql: str, params: Tuple[Any, ...] = ()) -> Optional[Tuple[Any, ...]]:
    conn = _get_conn()
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()

def fetchall(sql: str, params: Tuple[Any, ...] = ()) -> List[Tuple[Any, ...]]:
    conn = _get_conn()
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()

def execute(sql: str, params: Tuple[Any, ...] = ()) -> None:
    conn = _get_conn()
    with conn.cursor() as cur:
        cur.execute(sql, params)

def get_conn():
    """Return a fresh connection (caller must close it)."""
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5433")),
        dbname=os.getenv("POSTGRES_DB", "salaries"),
        user=os.getenv("POSTGRES_USER", "salaries"),
        password=os.getenv("POSTGRES_PASSWORD", "salaries"),
    )
