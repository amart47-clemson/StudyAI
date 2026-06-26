import json
import os
from typing import Any, Literal

from openai import APIConnectionError, APIStatusError, OpenAI, OpenAIError, RateLimitError

GenerationType = Literal["summary", "flashcards", "quiz"]
QuizFormat = Literal["multiple_choice", "true_false"]
FlashcardFormat = Literal["standard", "short_answer"]
Difficulty = Literal["easy", "medium", "hard"]

MODEL = "gpt-4o-mini"

FLASHCARD_CHARS_PER_CARD = 300
QUIZ_CHARS_PER_QUESTION = 500
FLASHCARD_MIN = 10
FLASHCARD_MAX = 50
QUIZ_MIN = 10
QUIZ_MAX = 40

DIFFICULTY_GUIDANCE: dict[str, str] = {
    "easy": "Use basic recall questions that test definitions and simple facts.",
    "medium": "Use application-level questions that require understanding and connecting ideas.",
    "hard": "Use analysis-level questions, edge cases, and nuanced distinctions.",
}


def recommended_flashcard_count(char_count: int) -> int:
    return max(FLASHCARD_MIN, min(FLASHCARD_MAX, char_count // FLASHCARD_CHARS_PER_CARD))


def recommended_quiz_count(char_count: int) -> int:
    return max(QUIZ_MIN, min(QUIZ_MAX, char_count // QUIZ_CHARS_PER_QUESTION))


def resolve_generation_count(
    gen_type: GenerationType,
    char_count: int,
    user_count: int | None,
) -> tuple[int | None, int | None]:
    match gen_type:
        case "flashcards":
            maximum = recommended_flashcard_count(char_count)
        case "quiz":
            maximum = recommended_quiz_count(char_count)
        case "summary":
            return None, None
        case _:
            raise ValueError(f"Unknown generation type: {gen_type}")

    if user_count is None:
        return maximum, None

    actual = min(user_count, maximum)
    capped_at = actual if actual < user_count else None
    return actual, capped_at


def _topic_clause(topic_filter: str | None) -> str:
    if not topic_filter:
        return ""
    return (
        f" Focus ONLY on content related to: {topic_filter}. "
        "Ignore unrelated material."
    )


def _difficulty_clause(difficulty: str) -> str:
    return f" Difficulty: {DIFFICULTY_GUIDANCE.get(difficulty, DIFFICULTY_GUIDANCE['medium'])}"


def _summary_prompt(difficulty: str, topic_filter: str | None) -> str:
    return f"""You are a study assistant. Analyze the provided study material and return ONLY valid JSON with this exact structure:
{{
  "summary": "<2-3 paragraph summary of the material>",
  "key_concepts": ["concept1", "concept2", ...]
}}
Include the most important concepts as concise strings.{_difficulty_clause(difficulty)}{_topic_clause(topic_filter)}
No markdown, no code fences, no extra text — only the JSON object."""


def _flashcards_prompt(
    count: int,
    difficulty: str,
    topic_filter: str | None,
    flashcard_format: FlashcardFormat,
) -> str:
    format_note = (
        "Each card should have a concise question and a brief short-answer style response (1-2 sentences)."
        if flashcard_format == "short_answer"
        else "Each card should have a clear question and a direct answer."
    )
    return f"""You are a study assistant. Analyze the provided study material and return ONLY valid JSON with this exact structure:
{{
  "flashcards": [
    {{ "question": "...", "answer": "..." }}
  ]
}}
Generate exactly {count} flashcards. {format_note}{_difficulty_clause(difficulty)}{_topic_clause(topic_filter)}
No markdown, no code fences, no extra text — only the JSON object."""


def _multiple_choice_quiz_prompt(
    count: int,
    difficulty: str,
    topic_filter: str | None,
) -> str:
    return f"""You are a study assistant. Analyze the provided study material and return ONLY valid JSON with this exact structure:
{{
  "questions": [
    {{
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "explanation": "..."
    }}
  ]
}}
Generate exactly {count} multiple-choice questions with four options each. "correct" is the 0-based index of the correct option in "options".{_difficulty_clause(difficulty)}{_topic_clause(topic_filter)}
No markdown, no code fences, no extra text — only the JSON object."""


def _true_false_quiz_prompt(
    count: int,
    difficulty: str,
    topic_filter: str | None,
) -> str:
    return f"""You are a study assistant. Analyze the provided study material and return ONLY valid JSON with this exact structure:
{{
  "questions": [
    {{
      "question": "...",
      "options": ["True", "False"],
      "correct": 0,
      "explanation": "..."
    }}
  ]
}}
Generate exactly {count} true/false questions. Each question MUST have exactly two options: ["True", "False"]. "correct" is 0 if True is correct, or 1 if False is correct.{_difficulty_clause(difficulty)}{_topic_clause(topic_filter)}
No markdown, no code fences, no extra text — only the JSON object."""


def _system_prompt(
    gen_type: GenerationType,
    count: int | None,
    quiz_format: QuizFormat = "multiple_choice",
    flashcard_format: FlashcardFormat = "standard",
    difficulty: Difficulty = "medium",
    topic_filter: str | None = None,
) -> str:
    match gen_type:
        case "summary":
            return _summary_prompt(difficulty, topic_filter)
        case "flashcards":
            if count is None:
                raise ValueError("count is required for flashcard generation")
            return _flashcards_prompt(count, difficulty, topic_filter, flashcard_format)
        case "quiz":
            if count is None:
                raise ValueError("count is required for quiz generation")
            if quiz_format == "true_false":
                return _true_false_quiz_prompt(count, difficulty, topic_filter)
            return _multiple_choice_quiz_prompt(count, difficulty, topic_filter)
        case _:
            raise ValueError(f"Unknown generation type: {gen_type}")


def _get_client() -> OpenAI:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not configured")
    return OpenAI(api_key=api_key)


def generate_content(
    text: str,
    gen_type: GenerationType,
    count: int | None = None,
    quiz_format: QuizFormat = "multiple_choice",
    flashcard_format: FlashcardFormat = "standard",
    difficulty: Difficulty = "medium",
    topic_filter: str | None = None,
) -> dict[str, Any]:
    client = _get_client()

    try:
        response = client.chat.completions.create(
            model=MODEL,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": _system_prompt(
                        gen_type,
                        count,
                        quiz_format,
                        flashcard_format,
                        difficulty,
                        topic_filter,
                    ),
                },
                {"role": "user", "content": text},
            ],
        )
    except RateLimitError as exc:
        raise OpenAIError("OpenAI rate limit exceeded") from exc
    except APIConnectionError as exc:
        raise OpenAIError("Could not connect to OpenAI") from exc
    except APIStatusError as exc:
        raise OpenAIError(f"OpenAI API error: {exc.message}") from exc
    except OpenAIError:
        raise

    raw = response.choices[0].message.content
    if not raw:
        raise ValueError("OpenAI returned an empty response")

    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("OpenAI returned invalid JSON") from exc
