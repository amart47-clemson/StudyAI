import uuid
from pathlib import Path

from flask import Blueprint, jsonify

from services.document_history import save_document_metadata
from services.document_store import store_document
from services.rag import index_document

demo_bp = Blueprint("demo", __name__, url_prefix="/api")

_DEMO_PATH = Path(__file__).resolve().parent.parent / "assets" / "demo_article.txt"
_DEMO_FILENAME = "Spaced Repetition Science (Demo).txt"


@demo_bp.post("/demo")
def load_demo():
    if not _DEMO_PATH.exists():
        return jsonify({"error": "Demo content not available"}), 500

    text = _DEMO_PATH.read_text(encoding="utf-8").strip()
    if not text:
        return jsonify({"error": "Demo content is empty"}), 500

    doc_id = str(uuid.uuid4())
    store_document(doc_id, text)

    try:
        chunk_count = index_document(doc_id, text)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception:
        return jsonify({"error": "Failed to index demo document"}), 500

    save_document_metadata(doc_id, _DEMO_FILENAME, len(text), chunk_count)

    return jsonify({
        "doc_id": doc_id,
        "text": text,
        "char_count": len(text),
        "chunk_count": chunk_count,
        "filename": _DEMO_FILENAME,
        "is_demo": True,
    })
