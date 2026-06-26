import uuid

import fitz
from flask import Blueprint, jsonify, request

from services.document_history import save_document_metadata
from services.document_store import store_document
from services.rag import index_document

upload_bp = Blueprint("upload", __name__, url_prefix="/api")


def extract_pdf_text(file_bytes: bytes) -> str:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    try:
        pages = [page.get_text() for page in doc]
        return "\n".join(pages).strip()
    finally:
        doc.close()


@upload_bp.post("/upload")
def upload():
    text: str | None = None
    filename = "Pasted text"

    if "file" in request.files and request.files["file"].filename:
        uploaded = request.files["file"]
        filename = uploaded.filename
        if not uploaded.filename.lower().endswith(".pdf"):
            return jsonify({"error": "Only PDF files are supported"}), 400

        file_bytes = uploaded.read()
        if not file_bytes:
            return jsonify({"error": "Uploaded file is empty"}), 400

        try:
            text = extract_pdf_text(file_bytes)
        except Exception:
            return jsonify({"error": "Invalid or corrupted PDF file"}), 400
    elif request.is_json:
        payload = request.get_json(silent=True) or {}
        raw_text = payload.get("text")
        if raw_text is None:
            return jsonify(
                {"error": "Missing input: provide a PDF file or JSON text field"}
            ), 400
        if not isinstance(raw_text, str):
            return jsonify({"error": "Text field must be a string"}), 400
        text = raw_text.strip()
    else:
        return jsonify(
            {"error": "Missing input: provide a PDF file or JSON text field"}
        ), 400

    if not text:
        return jsonify({"error": "No text content found"}), 400

    doc_id = str(uuid.uuid4())
    store_document(doc_id, text)

    try:
        chunk_count = index_document(doc_id, text)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception:
        return jsonify({"error": "Failed to index document for search"}), 500

    save_document_metadata(doc_id, filename, len(text), chunk_count)

    return jsonify(
        {
            "doc_id": doc_id,
            "text": text,
            "char_count": len(text),
            "chunk_count": chunk_count,
            "filename": filename,
        }
    )
