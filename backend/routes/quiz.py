from flask import Blueprint, jsonify, request
from openai import OpenAIError

from services.adaptive import analyze_quiz_performance, store_performance
from services.document_store import get_document

quiz_bp = Blueprint("quiz", __name__, url_prefix="/api")


@quiz_bp.post("/quiz/submit")
def submit_quiz():
    if not request.is_json:
        return jsonify({"error": "JSON body required"}), 400

    payload = request.get_json(silent=True) or {}
    doc_id = payload.get("doc_id")
    questions = payload.get("questions")
    user_answers = payload.get("user_answers")

    if not doc_id or questions is None or user_answers is None:
        return jsonify({"error": "doc_id, questions, and user_answers are required"}), 400

    if get_document(doc_id) is None:
        return jsonify({"error": "Document not found"}), 404

    if not isinstance(questions, list) or not isinstance(user_answers, list):
        return jsonify({"error": "questions and user_answers must be arrays"}), 400

    try:
        profile = analyze_quiz_performance(doc_id, questions, user_answers)
        store_performance(doc_id, profile)
        return jsonify(profile)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except OpenAIError as exc:
        return jsonify({"error": str(exc)}), 502
