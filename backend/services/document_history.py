from datetime import datetime
from typing import Any

import os

import psycopg2
from pgvector.psycopg2 import register_vector

from services.rag import ensure_schema


def _get_connection():
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise ValueError("DATABASE_URL is not configured")
    conn = psycopg2.connect(url)
    register_vector(conn)
    return conn


def save_document_metadata(
    doc_id: str,
    filename: str,
    char_count: int,
    chunk_count: int,
) -> None:
    ensure_schema()

    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO documents (doc_id, filename, upload_time, char_count, chunk_count)
                VALUES (%s, %s, NOW(), %s, %s)
                ON CONFLICT (doc_id) DO UPDATE SET
                    filename = EXCLUDED.filename,
                    char_count = EXCLUDED.char_count,
                    chunk_count = EXCLUDED.chunk_count
                """,
                (doc_id, filename, char_count, chunk_count),
            )
        conn.commit()
    finally:
        conn.close()


def get_document_metadata(doc_id: str) -> dict[str, Any] | None:
    ensure_schema()

    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT doc_id, filename, upload_time, char_count, chunk_count
                FROM documents
                WHERE doc_id = %s
                """,
                (doc_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            return {
                "doc_id": row[0],
                "filename": row[1],
                "upload_time": row[2].isoformat() if isinstance(row[2], datetime) else row[2],
                "char_count": row[3],
                "chunk_count": row[4],
            }
    finally:
        conn.close()


def lookup_documents(doc_ids: list[str]) -> list[dict[str, Any]]:
    if not doc_ids:
        return []

    ensure_schema()

    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT doc_id, filename, upload_time, char_count, chunk_count
                FROM documents
                WHERE doc_id = ANY(%s)
                ORDER BY upload_time DESC
                """,
                (doc_ids,),
            )
            results = []
            for row in cur.fetchall():
                results.append({
                    "doc_id": row[0],
                    "filename": row[1],
                    "upload_time": row[2].isoformat() if isinstance(row[2], datetime) else row[2],
                    "char_count": row[3],
                    "chunk_count": row[4],
                })
            return results
    finally:
        conn.close()
