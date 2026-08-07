"""Tests for POST /generate-cover-letter/ with a faked OpenAI client."""

import json

RESUME = "Experienced Python engineer. " * 10
JD = "We need a backend engineer who ships reliable APIs. " * 3

CANNED = json.dumps({
    "cover_letter": "Dear team, I build reliable Python APIs...",
    "key_points": ["Python depth", "API reliability"],
})


def test_rejects_short_resume(api_client):
    resp = api_client.post("/generate-cover-letter/", json={"resume_text": "short", "job_description": JD})
    assert resp.status_code == 400
    assert "resume" in resp.json()["detail"].lower()


def test_rejects_short_job_description(api_client):
    resp = api_client.post("/generate-cover-letter/", json={"resume_text": RESUME, "job_description": "short"})
    assert resp.status_code == 400
    assert "job description" in resp.json()["detail"].lower()


def test_generates_cover_letter(api_client, fake_llm):
    fake_llm(CANNED)
    resp = api_client.post("/generate-cover-letter/", json={"resume_text": RESUME, "job_description": JD})
    assert resp.status_code == 200
    assert "cover_letter" in resp.json()
