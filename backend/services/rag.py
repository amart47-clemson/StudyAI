import logging
import os
from pathlib import Path
from typing import Any, TypedDict

import psycopg2
from openai import OpenAI
from pgvector.psycopg2 import register_vector

logger = logging.getLogger(__name__)

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
MAX_GENERATION_CHARS = 80000
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536

_SCHEMA_PATH = Path(__file__).resolve().parent.parent / "sql" / "schema.sql"
_schema_initialized = False


class CoverageInfo(TypedDict):
    chunks_used: int
    total_chunks: int
    characters_processed: int


def _get_database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise ValueError("DATABASE_URL is not configured")
    return url


def _get_openai_client() -> OpenAI:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not configured")
    return OpenAI(api_key=api_key)


def _get_connection():
    conn = psycopg2.connect(_get_database_url())
    register_vector(conn)
    return conn


def ensure_schema() -> None:
    global _schema_initialized
    if _schema_initialized:
        return

    sql = _SCHEMA_PATH.read_text()
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        _schema_initialized = True
    finally:
        conn.close()


def chunk_text(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> list[str]:
    if not text:
        return []

    if len(text) <= chunk_size:
        return [text]

    chunks: list[str] = []
    step = chunk_size - overlap
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start += step

    return chunks


def embed_chunks(chunks: list[str]) -> list[list[float]]:
    if not chunks:
        return []

    client = _get_openai_client()
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=chunks,
        dimensions=EMBEDDING_DIMENSIONS,
    )

    return [item.embedding for item in response.data]


def store_chunks(
    doc_id: str,
    chunks: list[str],
    embeddings: list[list[float]],
) -> None:
    if len(chunks) != len(embeddings):
        raise ValueError("chunks and embeddings must have the same length")

    ensure_schema()

    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            for chunk, embedding in zip(chunks, embeddings, strict=True):
                cur.execute(
                    """
                    INSERT INTO document_chunks (doc_id, chunk_text, embedding)
                    VALUES (%s, %s, %s)
                    """,
                    (doc_id, chunk, embedding),
                )
        conn.commit()
    finally:
        conn.close()


def get_all_chunks(doc_id: str) -> list[str]:
    ensure_schema()

    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT chunk_text
                FROM document_chunks
                WHERE doc_id = %s
                ORDER BY id
                """,
                (doc_id,),
            )
            return [row[0] for row in cur.fetchall()]
    finally:
        conn.close()


def sample_chunks_evenly(
    chunks: list[str],
    max_chars: int = MAX_GENERATION_CHARS,
) -> tuple[list[str], list[int]]:
    total = len(chunks)
    if total == 0:
        return [], []

    full_text = "\n\n".join(chunks)
    if len(full_text) <= max_chars:
        return chunks, list(range(total))

    for selected_count in range(total, 0, -1):
        if selected_count == 1:
            indices = [0]
        else:
            indices = sorted(
                {round(i * (total - 1) / (selected_count - 1)) for i in range(selected_count)}
            )
        selected_chunks = [chunks[i] for i in indices]
        joined = "\n\n".join(selected_chunks)
        if len(joined) <= max_chars:
            return selected_chunks, indices

    return [chunks[0]], [0]


def prepare_generation_text(
    doc_id: str,
    topic_filter: str | None = None,
) -> tuple[str, CoverageInfo]:
    from services.document_store import get_document

    if topic_filter:
        chunks = retrieve_relevant_chunks(doc_id, topic_filter, top_k=20)
        if not chunks:
            raise ValueError(f"No document content found for topic: {topic_filter}")
    else:
        chunks = get_all_chunks(doc_id)

    if not chunks:
        stored_text = get_document(doc_id)
        if stored_text is None:
            raise ValueError("Document not found")
        chunks = chunk_text(stored_text)

    total_chunks = len(chunks)
    selected_chunks, _ = sample_chunks_evenly(chunks)
    text = "\n\n".join(selected_chunks)

    coverage: CoverageInfo = {
        "chunks_used": len(selected_chunks),
        "total_chunks": total_chunks,
        "characters_processed": len(text),
    }

    logger.info(
        "Generation text prepared for doc_id=%s topic=%s: %s/%s chunks, %s characters",
        doc_id,
        topic_filter or "all",
        coverage["chunks_used"],
        coverage["total_chunks"],
        coverage["characters_processed"],
    )
    print(
        f"[generate] doc_id={doc_id} topic={topic_filter or 'all'} "
        f"chunks={coverage['chunks_used']}/{coverage['total_chunks']} "
        f"chars={coverage['characters_processed']}",
        flush=True,
    )

    return text, coverage


def retrieve_relevant_chunks(
    doc_id: str,
    query: str,
    top_k: int = 5,
) -> list[str]:
    query_embeddings = embed_chunks([query])
    if not query_embeddings:
        return []

    query_embedding = query_embeddings[0]

    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT chunk_text
                FROM document_chunks
                WHERE doc_id = %s
                ORDER BY embedding <=> %s::vector
                LIMIT %s
                """,
                (doc_id, query_embedding, top_k),
            )
            return [row[0] for row in cur.fetchall()]
    finally:
        conn.close()


def index_document(doc_id: str, text: str) -> int:
    chunks = chunk_text(text)
    if not chunks:
        return 0

    embeddings = embed_chunks(chunks)
    store_chunks(doc_id, chunks, embeddings)
    return len(chunks)
