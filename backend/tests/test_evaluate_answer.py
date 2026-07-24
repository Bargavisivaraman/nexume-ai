"""Tests for POST /evaluate-answer/ with a faked OpenAI client."""

import json

CANNED = json.dumps({
    "score": 82,
    "feedback": "Good structure, but add a concrete metric.",
    "improved_answer": "I led the migration, cutting deploy time 40%.",
    "keywords_used": ["migration"],
    "keywords_missing": ["kubernetes"],
})


def test_rejects_short_question(api_client):
    resp = api_client.post("/evaluate-answer/", json={"question": "Hm?", "answer": "A long enough answer here."})
    assert resp.status_code == 400
    assert "question" in resp.json()["detail"].lower()


def test_rejects_short_answer(api_client):
    resp = api_client.post("/evaluate-answer/", json={"question": "Tell me about a project.", "answer": "ok"})
    assert resp.status_code == 400
    assert "answer" in resp.json()["detail"].lower()


def test_returns_scored_evaluation(api_client, fake_llm):
    fake_llm(CANNED)
    resp = api_client.post("/evaluate-answer/", json={
        "question": "Tell me about a project you led.",
        "answer": "I led the platform migration across three teams.",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["score"] == 82
    assert body["keywords_missing"] == ["kubernetes"]
