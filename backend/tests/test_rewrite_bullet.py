"""Tests for POST /rewrite-bullet/ with a faked OpenAI client."""

import json

CANNED = json.dumps({
    "rewritten": "Engineered a caching layer that cut API latency by [X%].",
    "explanation": "Starts with a strong verb and adds a metric slot.",
})


def test_rejects_short_bullet(api_client):
    resp = api_client.post("/rewrite-bullet/", json={"bullet": "did"})
    assert resp.status_code == 400


def test_rewrites_a_weak_bullet(api_client, fake_llm):
    fake_llm(CANNED)
    resp = api_client.post("/rewrite-bullet/", json={
        "bullet": "responsible for maintaining the backend",
        "job_context": "Backend engineer role",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["rewritten"].startswith("Engineered")
    assert "explanation" in body
