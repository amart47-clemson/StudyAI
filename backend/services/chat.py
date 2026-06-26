import json
import os
from typing import Any

from openai import APIConnectionError, APIStatusError, OpenAI, OpenAIError, RateLimitError

from services.rag import retrieve_relevant_chunks

MODEL = "gpt-4o-mini"
CONFIDENCE_THRESHOLD = 0.7

VALID_INTENTS = {
    "document_question",
    "regenerate_flashcards",
    "append_flashcards",
    "regenerate_quiz",
    "append_quiz",
    "regenerate_summary",
    "change_difficulty",
    "change_format",
    "focus_topic",
    "navigate",
    "unclear",
}

VALID_TARGETS = {"flashcards", "quiz", "summary", "chat"}
VALID_ACTIONS = {"regenerate", "append", "navigate"}
VALID_FORMATS = {"multiple_choice", "true_false", "short_answer"}
VALID_DIFFICULTIES = {"easy", "medium", "hard"}

DEFAULT_COUNTS = {
    "append_quiz": 5,
    "append_flashcards": 5,
    "regenerate_quiz": None,
    "regenerate_flashcards": None,
}

CLASSIFICATION_PROMPT = """You are an intent classifier for a study app assistant.
Classify the user's LATEST message using conversation history for context.

INTENTS (pick exactly one):
- document_question: asking about document content ("what is", "explain", "summarize this part")
- regenerate_flashcards: REPLACE all flashcards ("redo flashcards", "make new flashcards", "give me 20 flashcards")
- append_flashcards: ADD more flashcards ("add 5 more flashcards", "give me more cards")
- regenerate_quiz: REPLACE entire quiz ("redo the quiz", "make a 30 question quiz", "make the quiz 30 questions")
- append_quiz: ADD more quiz questions ("add 5 more", "give me 10 more questions", "add more questions")
- regenerate_summary: redo summary ("summarize differently", "shorter summary", "new summary")
- change_difficulty: make content harder/easier ("make the quiz harder", "easier flashcards")
- change_format: change question/card format ("switch to true/false", "make them multiple choice", "short answer flashcards")
- focus_topic: regenerate focused on a topic ("flashcards only about mitosis", "quiz on chapter 3")
- navigate: go to a tab ("show me the quiz", "go to flashcards", "take me to summary")
- unclear: ambiguous request — provide a clarifying question

CRITICAL RULES:
- NEVER confuse flashcards and quiz. "flashcards"/"cards" = flashcards. "quiz"/"questions" = quiz.
- "add more" with no target: infer from the most recent topic in conversation history.
- If still ambiguous, set intent to "unclear".
- Extract count from numbers ("make 20", "add 5 more"). Use null if not specified.
- If confidence < 0.7, set intent to "unclear" and write a helpful clarifying_question.

Return ONLY valid JSON:
{
  "intent": "<intent>",
  "target": "flashcards" | "quiz" | "summary" | null,
  "action": "regenerate" | "append" | "navigate" | null,
  "count": <integer or null>,
  "format": "multiple_choice" | "true_false" | "short_answer" | null,
  "difficulty": "easy" | "medium" | "hard" | null,
  "topic_filter": "<string or null>",
  "confidence": <0.0 to 1.0>,
  "clarifying_question": "<string or null>"
}"""


def _get_client() -> OpenAI:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not configured")
    return OpenAI(api_key=api_key)


def _call_openai(messages: list[dict[str, str]], *, json_mode: bool = False) -> str:
    client = _get_client()
    kwargs: dict[str, Any] = {"model": MODEL, "messages": messages}
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    try:
        response = client.chat.completions.create(**kwargs)
    except RateLimitError as exc:
        raise OpenAIError("OpenAI rate limit exceeded") from exc
    except APIConnectionError as exc:
        raise OpenAIError("Could not connect to OpenAI") from exc
    except APIStatusError as exc:
        raise OpenAIError(f"OpenAI API error: {exc.message}") from exc
    except OpenAIError:
        raise

    content = response.choices[0].message.content
    if not content:
        raise ValueError("OpenAI returned an empty response")
    return content


def _format_history_context(history: list[dict[str, str]]) -> str:
    if not history:
        return ""
    recent = history[-8:]
    lines = [f"{item['role']}: {item['content']}" for item in recent]
    return "Conversation history:\n" + "\n".join(lines) + "\n\n"


def _normalize_classification(raw: dict[str, Any], message: str) -> dict[str, Any]:
    intent = raw.get("intent", "document_question")
    if intent not in VALID_INTENTS:
        intent = "document_question"

    target = raw.get("target")
    if target not in VALID_TARGETS:
        target = None

    action = raw.get("action")
    if action not in VALID_ACTIONS:
        action = None

    count = raw.get("count")
    if count is not None:
        try:
            count = int(count)
            if count < 1:
                count = None
        except (TypeError, ValueError):
            count = None

    fmt = raw.get("format")
    if fmt not in VALID_FORMATS:
        fmt = _infer_format(message)

    difficulty = raw.get("difficulty")
    if difficulty not in VALID_DIFFICULTIES:
        difficulty = _infer_difficulty(message)

    topic_filter = raw.get("topic_filter")
    if topic_filter is not None and not isinstance(topic_filter, str):
        topic_filter = None
    if topic_filter:
        topic_filter = topic_filter.strip() or None

    confidence = raw.get("confidence", 1.0)
    try:
        confidence = float(confidence)
    except (TypeError, ValueError):
        confidence = 1.0

    clarifying = raw.get("clarifying_question")
    if clarifying is not None and not isinstance(clarifying, str):
        clarifying = None

    if confidence < CONFIDENCE_THRESHOLD:
        intent = "unclear"
        if not clarifying:
            clarifying = (
                "I want to help — did you mean quiz questions, flashcards, or something else?"
            )

    return {
        "intent": intent,
        "target": target,
        "action": action,
        "count": count,
        "format": fmt,
        "difficulty": difficulty,
        "topic_filter": topic_filter,
        "confidence": confidence,
        "clarifying_question": clarifying,
    }


def _infer_format(message: str) -> str | None:
    lowered = message.lower()
    if any(k in lowered for k in ("true/false", "true false", "true-false", "t/f")):
        return "true_false"
    if "short answer" in lowered or "short-answer" in lowered:
        return "short_answer"
    if "multiple choice" in lowered or "multiple-choice" in lowered:
        return "multiple_choice"
    return None


def _infer_difficulty(message: str) -> str | None:
    lowered = message.lower()
    if any(k in lowered for k in ("harder", "more difficult", "advanced", "challenging")):
        return "hard"
    if any(k in lowered for k in ("easier", "simpler", "basic", "beginner")):
        return "easy"
    return None


def classify_intent(message: str, history: list[dict[str, str]]) -> dict[str, Any]:
    user_content = _format_history_context(history) + f"Latest user message: {message}"

    raw = _call_openai(
        [
            {"role": "system", "content": CLASSIFICATION_PROMPT},
            {"role": "user", "content": user_content},
        ],
        json_mode=True,
    )

    try:
        result = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("OpenAI returned invalid JSON for intent classification") from exc

    return _normalize_classification(result, message)


def _resolve_target(classification: dict[str, Any]) -> str | None:
    target = classification.get("target")
    if target in {"flashcards", "quiz", "summary"}:
        return target

    intent = classification["intent"]
    if "flashcard" in intent:
        return "flashcards"
    if "quiz" in intent:
        return "quiz"
    if "summary" in intent:
        return "summary"

    fmt = classification.get("format")
    if fmt == "short_answer":
        return "flashcards"
    if fmt in {"true_false", "multiple_choice"}:
        return "quiz"

    return None


def _build_action_type(classification: dict[str, Any]) -> str | None:
    intent = classification["intent"]
    target = _resolve_target(classification)

    direct_map = {
        "regenerate_flashcards": "regenerate_flashcards",
        "append_flashcards": "append_flashcards",
        "regenerate_quiz": "regenerate_quiz",
        "append_quiz": "append_quiz",
        "regenerate_summary": "regenerate_summary",
        "navigate": "navigate",
    }
    if intent in direct_map:
        return direct_map[intent]

    if intent in {"change_difficulty", "change_format", "focus_topic"} and target:
        if target == "flashcards":
            return "regenerate_flashcards"
        if target == "quiz":
            return "regenerate_quiz"
        if target == "summary":
            return "regenerate_summary"

    return None


def _build_action_payload(classification: dict[str, Any]) -> dict[str, Any] | None:
    intent = classification["intent"]
    if intent in {"document_question", "unclear"}:
        return None

    action_type = _build_action_type(classification)
    if not action_type:
        return None

    target = _resolve_target(classification)
    count = classification.get("count")

    if action_type == "navigate":
        return {"type": "navigate", "target": target or "summary"}

    if action_type in {"append_quiz", "append_flashcards"} and count is None:
        count = DEFAULT_COUNTS[action_type]

    payload: dict[str, Any] = {
        "type": action_type,
        "target": target,
        "mode": "append" if action_type.startswith("append_") else "regenerate",
    }

    if count is not None:
        payload["count"] = count

    fmt = classification.get("format")
    if fmt:
        payload["format"] = fmt

    difficulty = classification.get("difficulty") or "medium"
    if intent == "change_difficulty" or classification.get("difficulty"):
        payload["difficulty"] = difficulty
    elif action_type != "regenerate_summary":
        payload["difficulty"] = difficulty

    topic_filter = classification.get("topic_filter")
    if topic_filter or intent == "focus_topic":
        payload["topic_filter"] = topic_filter

    return payload


def _build_reply(classification: dict[str, Any], action: dict[str, Any] | None) -> str:
    intent = classification["intent"]

    if intent == "unclear":
        return (
            classification.get("clarifying_question")
            or "Could you clarify what you'd like me to do?"
        )

    if intent == "navigate" or (action and action.get("type") == "navigate"):
        target = action.get("target", "summary") if action else "summary"
        return f"Taking you to the {target} tab now."

    if not action:
        return "Done!"

    target = action.get("target", "content")
    count = action.get("count")
    fmt = action.get("format")
    difficulty = action.get("difficulty")
    topic = action.get("topic_filter")
    mode = action.get("mode", "regenerate")

    parts: list[str] = []
    if mode == "append" and count:
        parts.append(f"I've added {count} new")
    elif count:
        parts.append(f"I've updated your {target} with {count}")
    else:
        parts.append(f"I've updated your {target}")

    if target == "quiz":
        parts.append("questions")
    elif target == "flashcards":
        parts.append("flashcards")
    else:
        parts.append("content")

    extras = []
    if fmt == "true_false":
        extras.append("in true/false format")
    elif fmt == "short_answer":
        extras.append("as short-answer flashcards")
    elif fmt == "multiple_choice":
        extras.append("as multiple choice")
    if difficulty and difficulty != "medium":
        extras.append(f"at {difficulty} difficulty")
    if topic:
        extras.append(f"focused on {topic}")

    detail = f" ({', '.join(extras)})" if extras else ""
    go_label = {
        "quiz": "Go to Quiz",
        "flashcards": "Go to Flashcards",
        "summary": "Go to Summary",
    }.get(target, "View it")

    return f"Done! {' '.join(parts)}{detail}. Click '{go_label}' to check it out."


def _answer_document_question(
    doc_id: str,
    message: str,
    history: list[dict[str, str]],
) -> dict[str, Any]:
    sources = retrieve_relevant_chunks(doc_id, message, top_k=5)
    context = "\n\n".join(sources)

    system_prompt = (
        "You are a study assistant. Answer questions using ONLY the context below. "
        "If the answer isn't in the context, say so. Context: "
        + context
    )

    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": message})

    reply = _call_openai(messages)

    return {
        "reply": reply,
        "intent": "document_question",
        "action": None,
        "sources": sources,
    }


def chat_with_document(
    doc_id: str,
    message: str,
    history: list[dict[str, str]],
) -> dict[str, Any]:
    classification = classify_intent(message, history)
    intent = classification["intent"]

    if intent == "document_question":
        return _answer_document_question(doc_id, message, history)

    action = _build_action_payload(classification)
    reply = _build_reply(classification, action)

    return {
        "reply": reply,
        "intent": intent,
        "action": action,
        "sources": [],
    }
