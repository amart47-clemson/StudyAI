-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Store document chunks with embeddings for RAG retrieval
CREATE TABLE IF NOT EXISTS document_chunks (
    id SERIAL PRIMARY KEY,
    doc_id TEXT NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding vector(1536) NOT NULL
);

CREATE INDEX IF NOT EXISTS document_chunks_doc_id_idx ON document_chunks (doc_id);

-- Document upload metadata for history
CREATE TABLE IF NOT EXISTS documents (
    doc_id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    upload_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    char_count INTEGER NOT NULL,
    chunk_count INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS documents_upload_time_idx ON documents (upload_time DESC);
