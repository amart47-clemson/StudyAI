from flask import Blueprint, jsonify, request

from services.document_history import get_document_metadata, lookup_documents
from services.document_store import get_document

documents_bp = Blueprint("documents", __name__, url_prefix="/api")


@documents_bp.get("/documents/<doc_id>")
def get_document(doc_id: str):
    metadata = get_document_metadata(doc_id)
    if metadata is None and get_document(doc_id) is None:
        return jsonify({"error": "Document not found"}), 404

    if metadata is None:
        return jsonify({"doc_id": doc_id, "exists": True})

    return jsonify(metadata)


@documents_bp.post("/documents/lookup")
def lookup():
    if not request.is_json:
        return jsonify({"error": "JSON body required"}), 400

    payload = request.get_json(silent=True) or {}
    doc_ids = payload.get("doc_ids", [])

    if not isinstance(doc_ids, list):
        return jsonify({"error": "doc_ids must be an array"}), 400

    valid_ids = [doc_id for doc_id in doc_ids if isinstance(doc_id, str)]
    return jsonify({"documents": lookup_documents(valid_ids)})
