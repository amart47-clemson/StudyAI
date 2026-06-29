-- Quiz performance history for adaptive learning
CREATE TABLE IF NOT EXISTS quiz_performance (
    id SERIAL PRIMARY KEY,
    doc_id TEXT NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    overall_score DOUBLE PRECISION NOT NULL,
    topics_json JSONB NOT NULL,
    weak_topics_json JSONB NOT NULL,
    strong_topics_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS quiz_performance_doc_id_idx ON quiz_performance (doc_id, attempted_at DESC);
