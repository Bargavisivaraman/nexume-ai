"""Tests for POST /optimize-linkedin/ and POST /generate-cold-email/."""

import json


def test_linkedin_rejects_short_summary(api_client):
    resp = api_client.post("/optimize-linkedin/", json={"linkedin_summary": "hi"})
    assert resp.status_code == 400


def test_linkedin_returns_optimized_summary(api_client, fake_llm):
    fake_llm(json.dumps({"optimized_summary": "Engineer who ships.", "tips": ["Add metrics"]}))
    resp = api_client.post("/optimize-linkedin/", json={
        "linkedin_summary": "I am a software engineer with several years of experience building web apps.",
    })
    assert resp.status_code == 200
    assert resp.json()["optimized_summary"] == "Engineer who ships."


def test_cold_email_requires_title_and_company(api_client):
    resp = api_client.post("/generate-cold-email/", json={"job_title": "", "company": ""})
    assert resp.status_code == 400


def test_cold_email_returns_subject_and_body(api_client, fake_llm):
    fake_llm(json.dumps({
        "subject": "Backend engineer who cut latency 40%",
        "email": "Hi there...",
        "follow_up": "Just floating this...",
    }))
    resp = api_client.post("/generate-cold-email/", json={"job_title": "Backend Engineer", "company": "Acme"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["subject"].startswith("Backend engineer")
    assert "follow_up" in body
