from flask import Blueprint, jsonify, request
from openai import OpenAIError

from services.document_store import get_document
from services.generation import generate_content, resolve_generation_count
from services.rag import prepare_generation_text

generate_bp = Blueprint("generate", __name__, url_prefix="/api")

VALID_FORMATS = {"multiple_choice", "true_false", "short_answer"}
VALID_DIFFICULTIES = {"easy", "medium", "hard"}


@generate_bp.post("/generate")
def generate():
    if not request.is_json:
        return jsonify({"error": "JSON body required"}), 400

    payload = request.get_json(silent=True) or {}
    doc_id = payload.get("doc_id")
    gen_type = payload.get("type")
    user_count = payload.get("count")
    quiz_format = payload.get("format", "multiple_choice")
    difficulty = payload.get("difficulty", "medium")
    topic_filter = payload.get("topic_filter")

    if not doc_id or not gen_type:
        return jsonify({"error": "doc_id and type are required"}), 400

    if user_count is not None and (
        not isinstance(user_count, int) or user_count < 1
    ):
        return jsonify({"error": "count must be a positive integer"}), 400

    if quiz_format not in VALID_FORMATS:
        return jsonify(
            {"error": "format must be multiple_choice, true_false, or short_answer"}
        ), 400

    if difficulty not in VALID_DIFFICULTIES:
        return jsonify({"error": "difficulty must be easy, medium, or hard"}), 400

    if topic_filter is not None and not isinstance(topic_filter, str):
        return jsonify({"error": "topic_filter must be a string"}), 400

    if get_document(doc_id) is None:
        return jsonify({"error": "Document not found"}), 404

    match gen_type:
        case "summary" | "flashcards" | "quiz":
            pass
        case _:
            return jsonify(
                {"error": "type must be one of: summary, flashcards, quiz"}
            ), 400

    flashcard_format = "short_answer" if quiz_format == "short_answer" else "standard"
    api_quiz_format = quiz_format if quiz_format in {"multiple_choice", "true_false"} else "multiple_choice"

    if gen_type == "quiz" and quiz_format == "short_answer":
        return jsonify(
            {"error": "short_answer format is only supported for flashcards"}
        ), 400

    try:
        text, coverage = prepare_generation_text(
            doc_id,
            topic_filter=topic_filter.strip() if topic_filter else None,
        )
        actual_count, capped_at = resolve_generation_count(
            gen_type,
            coverage["characters_processed"],
            user_count,
        )

        result = generate_content(
            text,
            gen_type,
            count=actual_count,
            quiz_format=api_quiz_format,
            flashcard_format=flashcard_format,
            difficulty=difficulty,
            topic_filter=topic_filter.strip() if topic_filter else None,
        )
        result["coverage"] = coverage
        if capped_at is not None:
            result["capped_at"] = capped_at

        return jsonify(result)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except OpenAIError as exc:
        return jsonify({"error": str(exc)}), 502
