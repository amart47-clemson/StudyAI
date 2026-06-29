import json
import os
from typing import Any

import psycopg2
from openai import APIConnectionError, APIStatusError, OpenAI, OpenAIError, RateLimitError

from services.rag import ensure_schema

MODEL = "gpt-4o-mini"


def _get_database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise ValueError("DATABASE_URL is not configured")
    return url


def _get_connection():
    return psycopg2.connect(_get_database_url())


def _get_client() -> OpenAI:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not configured")
    return OpenAI(api_key=api_key)


def _classify_strength(score: float) -> str:
    if score < 0.5:
        return "weak"
    if score < 0.8:
        return "medium"
    return "strong"


def _extract_topics_for_questions(questions: list[dict[str, Any]]) -> list[list[str]]:
    if not questions:
        return []

    numbered = "\n".join(
        f'{i + 1}. "{q.get("question", "")}"' for i, q in enumerate(questions)
    )

    prompt = (
        "For each numbered question below, return 1-2 short topic keywords.\n"
        "Return ONLY valid JSON in this exact shape:\n"
        '{"topics": [["keyword1"], ["keyword1", "keyword2"], ...]}\n'
        "The topics array must have one entry per question, in order.\n\n"
        f"Questions:\n{numbered}"
    )

    client = _get_client()
    try:
        response = client.chat.completions.create(
            model=MODEL,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": "Extract topic keywords."},
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
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("OpenAI returned invalid JSON for topic extraction") from exc

    topics_list = parsed.get("topics", [])
    result: list[list[str]] = []
    for i in range(len(questions)):
        if i < len(topics_list) and isinstance(topics_list[i], list):
            keywords = [
                str(kw).strip().lower()
                for kw in topics_list[i]
                if isinstance(kw, str) and kw.strip()
            ][:2]
            result.append(keywords or ["general"])
        else:
            result.append(["general"])
    return result


def analyze_quiz_performance(
    doc_id: str,
    questions: list[dict[str, Any]],
    user_answers: list[int | None],
) -> dict[str, Any]:
    if len(questions) != len(user_answers):
        raise ValueError("questions and user_answers must have the same length")

    if not questions:
        raise ValueError("At least one question is required")

    topic_keywords = _extract_topics_for_questions(questions)

    topics: dict[str, dict[str, Any]] = {}
    correct_total = 0

    for i, question in enumerate(questions):
        correct_index = question.get("correct")
        is_correct = user_answers[i] is not None and user_answers[i] == correct_index
        if is_correct:
            correct_total += 1

        primary_topic = topic_keywords[i][0] if topic_keywords[i] else "general"
        if primary_topic not in topics:
            topics[primary_topic] = {"correct": 0, "total": 0}

        topics[primary_topic]["total"] += 1
        if is_correct:
            topics[primary_topic]["correct"] += 1

    weak_topics: list[str] = []
    strong_topics: list[str] = []

    for name, stats in topics.items():
        score = stats["correct"] / stats["total"] if stats["total"] else 0.0
        strength = _classify_strength(score)
        stats["score"] = round(score, 2)
        stats["strength"] = strength
        if strength == "weak":
            weak_topics.append(name)
        elif strength == "strong":
            strong_topics.append(name)

    overall_score = round(correct_total / len(questions), 2)

    return {
        "doc_id": doc_id,
        "overall_score": overall_score,
        "topics": topics,
        "weak_topics": weak_topics,
        "strong_topics": strong_topics,
    }


def store_performance(doc_id: str, performance_profile: dict[str, Any]) -> None:
    ensure_schema()

    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO quiz_performance (
                    doc_id, overall_score, topics_json, weak_topics_json, strong_topics_json
                )
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    doc_id,
                    performance_profile["overall_score"],
                    json.dumps(performance_profile["topics"]),
                    json.dumps(performance_profile["weak_topics"]),
                    json.dumps(performance_profile["strong_topics"]),
                ),
            )
        conn.commit()
    finally:
        conn.close()


def get_adaptive_params(doc_id: str) -> dict[str, Any]:
    ensure_schema()

    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT overall_score, topics_json, weak_topics_json, strong_topics_json
                FROM quiz_performance
                WHERE doc_id = %s
                ORDER BY attempted_at DESC
                LIMIT 1
                """,
                (doc_id,),
            )
            row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        return {"has_history": False}

    topics = row[1] if isinstance(row[1], dict) else json.loads(row[1])
    weak_topics = row[3] if isinstance(row[3], list) else json.loads(row[3])
    strong_topics = row[4] if isinstance(row[4], list) else json.loads(row[4])

    topic_weights: dict[str, dict[str, Any]] = {}
    for name, stats in topics.items():
        strength = stats.get("strength", "medium")
        if strength == "weak":
            topic_weights[name] = {"count_weight": 2.0, "difficulty": "hard"}
        elif strength == "strong":
            topic_weights[name] = {"count_weight": 0.5, "difficulty": "easy"}
        else:
            topic_weights[name] = {"count_weight": 1.0, "difficulty": "medium"}

    summary_parts: list[str] = []
    if weak_topics:
        summary_parts.append(
            f"focusing more on {', '.join(weak_topics)} (weak)"
        )
    if strong_topics:
        summary_parts.append(
            f"easing up on {', '.join(strong_topics)} (strong)"
        )
    summary = (
        "Adaptive mode — " + " and ".join(summary_parts)
        if summary_parts
        else "Adaptive mode — balancing question difficulty by topic"
    )

    return {
        "has_history": True,
        "weak_topics": weak_topics,
        "strong_topics": strong_topics,
        "topic_weights": topic_weights,
        "summary": summary.capitalize(),
        "last_overall_score": row[0],
    }


def build_adaptive_prompt_clause(adaptive_params: dict[str, Any]) -> str:
    if not adaptive_params.get("has_history"):
        return ""

    weak = adaptive_params.get("weak_topics", [])
    strong = adaptive_params.get("strong_topics", [])
    weights = adaptive_params.get("topic_weights", {})

    weight_lines = [
        f"  - {topic}: weight {info['count_weight']}, difficulty {info['difficulty']}"
        for topic, info in weights.items()
    ]

    return (
        "\n\nADAPTIVE LEARNING MODE — personalize this quiz based on past performance:\n"
        f"- Ask MORE questions about these WEAK topics (difficulty: hard): {', '.join(weak) or 'none'}\n"
        f"- Ask FEWER questions about these STRONG topics (difficulty: easy): {', '.join(strong) or 'none'}\n"
        "- For weak topics: write harder questions testing deeper understanding, "
        "application, and edge cases — not just basic recall.\n"
        "- For strong topics: write straightforward recall questions only.\n"
        "- Weak topics must make up at least 60% of the questions.\n"
        "Topic weights and difficulty:\n"
        + "\n".join(weight_lines)
    )
