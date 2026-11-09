"""Tests for POST /interview-summary/ — the post-interview scorecard."""

import json

CANNED = json.dumps({
    "overall_score": 78,
    "communication_score": 80,
    "technical_depth_score": 70,
    "confidence_score": 82,
    "structure_score": 75,
    "strengths": ["Clear examples"],
    "weaknesses": ["Light on metrics"],
    "key_moments": [{"question": "Q1", "what_you_said": "...", "what_to_say_instead": "..."}],
    "improvement_plan": ["Practice STAR"],
})

HISTORY = [
    {"role": "ai", "content": "Tell me about a project."},
    {"role": "user", "content": "I led the platform migration."},
]


def test_requires_a_conversation(api_client, fake_llm):
    fake_llm(CANNED)
    resp = api_client.post("/interview-summary/", json={"mode": "hr", "history": []})
    assert resp.status_code == 400


def test_returns_the_scorecard(api_client, fake_llm):
    fake_llm(CANNED)

    resp = api_client.post("/interview-summary/", json={
        "mode": "technical",
        "history": HISTORY,
        "target_role": "Backend Engineer",
    })

    assert resp.status_code == 200
    body = resp.json()
    assert body["overall_score"] == 78
    assert body["key_moments"][0]["question"] == "Q1"


def test_invalid_model_json_maps_to_500(api_client, fake_llm):
    fake_llm("not json at all")

    resp = api_client.post("/interview-summary/", json={"mode": "hr", "history": HISTORY})

    assert resp.status_code == 500
    assert "invalid json" in resp.json()["detail"].lower()
