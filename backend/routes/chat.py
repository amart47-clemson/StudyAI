from flask import Blueprint, jsonify, request
from openai import OpenAIError

from services.chat import chat_with_document

chat_bp = Blueprint("chat", __name__, url_prefix="/api")

VALID_ROLES = {"user", "assistant"}

# Intent test cases (manual verification):
# - "make the quiz 30 questions" -> regenerate_quiz, count: 30
# - "add 5 more flashcards" -> append_flashcards, count: 5
# - "make the questions harder" -> change_difficulty, target: quiz, difficulty: hard
# - "switch to true/false" -> change_format, target: quiz, format: true_false
# - "make flashcards about only the first topic" -> focus_topic, target: flashcards
# - "show me the summary" -> navigate, target: summary
# - "add more" (no prior context) -> unclear, clarifying question
# - "can you explain photosynthesis" -> document_question, RAG lookup
# - "give me 10 more questions" -> append_quiz, count: 10
# - "redo the flashcards but easier" -> regenerate_flashcards, difficulty: easy


def _validate_history(history: object) -> str | None:
    if not isinstance(history, list):
        return "history must be an array"

    for item in history:
        if not isinstance(item, dict):
            return "each history item must be an object"
        role = item.get("role")
        content = item.get("content")
        if role not in VALID_ROLES:
            return "history role must be user or assistant"
        if not isinstance(content, str):
            return "history content must be a string"

    return None


@chat_bp.post("/chat")
def chat():
    if not request.is_json:
        return jsonify({"error": "JSON body required"}), 400

    payload = request.get_json(silent=True) or {}
    doc_id = payload.get("doc_id")
    message = payload.get("message")
    history = payload.get("history", [])

    if not doc_id or not message:
        return jsonify({"error": "doc_id and message are required"}), 400

    if not isinstance(message, str):
        return jsonify({"error": "message must be a string"}), 400

    history_error = _validate_history(history)
    if history_error:
        return jsonify({"error": history_error}), 400

    normalized_history = [
        {"role": item["role"], "content": item["content"]} for item in history
    ]

    try:
        result = chat_with_document(doc_id, message, normalized_history)
        return jsonify(result)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except OpenAIError as exc:
        return jsonify({"error": str(exc)}), 502
