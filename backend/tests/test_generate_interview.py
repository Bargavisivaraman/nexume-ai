"""Tests for POST /generate-interview/ with a faked OpenAI client."""

import json

GOOD_JD = "We are hiring a backend engineer to build Python APIs. " * 3

CANNED = json.dumps({
    "role_summary": "Backend engineer building Python APIs. Owns services end to end.",
    "difficulty": "Mid",
    "questions": [{
        "id": 1,
        "question": "How would you design a rate limiter?",
        "type": "technical",
        "why_asked": "Tests systems thinking.",
        "good_answer_hints": ["sliding window", "memory bounds", "429 semantics"],
    }],
})


def test_rejects_short_job_description(api_client):
    resp = api_client.post("/generate-interview/", json={"job_description": "too short"})
    assert resp.status_code == 400
    assert "too short" in resp.json()["detail"].lower()


def test_returns_parsed_questions(api_client, fake_llm):
    fake_llm(CANNED)
    resp = api_client.post("/generate-interview/", json={"job_description": GOOD_JD})
    assert resp.status_code == 200
    body = resp.json()
    assert body["difficulty"] == "Mid"
    assert body["questions"][0]["type"] == "technical"


def test_invalid_model_json_returns_500(api_client, fake_llm):
    fake_llm("this is not json")
    resp = api_client.post("/generate-interview/", json={"job_description": GOOD_JD})
    assert resp.status_code == 500
    assert "invalid json" in resp.json()["detail"].lower()
