"""Tests for the AI Tools v2 endpoints:
/decode-jd/, /build-star-story/, /generate-pitch/, /negotiate-offer/, /compose-reply/.
"""

import json

RESUME = "Python engineer with FastAPI, Postgres, and AWS experience. " * 5
JD = ("We are hiring a Backend Engineer. Must have 3+ years Python, FastAPI, Postgres. "
      "Nice to have: Kubernetes. Salary range $140k-$180k. We sponsor visas. ") * 2


# ── /decode-jd/ ──────────────────────────────────────────────────────────────

def test_decode_jd_rejects_short_input(api_client):
    resp = api_client.post("/decode-jd/", json={"job_description": "short"})
    assert resp.status_code == 400


def test_decode_jd_returns_structure(api_client, fake_llm):
    fake_llm(json.dumps({
        "role_summary": "They want a hands-on Python backend dev.",
        "seniority": "Mid",
        "must_haves": ["Python", "FastAPI"],
        "red_flags": [],
        "sponsorship_signal": "Explicitly sponsors",
    }))
    resp = api_client.post("/decode-jd/", json={"job_description": JD, "resume_text": RESUME})
    assert resp.status_code == 200
    body = resp.json()
    assert body["seniority"] == "Mid"
    assert body["sponsorship_signal"] == "Explicitly sponsors"


def test_decode_jd_works_without_resume(api_client, fake_llm):
    fake_llm(json.dumps({"role_summary": "x", "fit_notes": []}))
    resp = api_client.post("/decode-jd/", json={"job_description": JD})
    assert resp.status_code == 200


# ── /build-star-story/ ───────────────────────────────────────────────────────

def test_star_story_rejects_thin_experience(api_client):
    resp = api_client.post("/build-star-story/", json={"experience": "I fixed a bug."})
    assert resp.status_code == 400


def test_star_story_returns_all_four_parts(api_client, fake_llm):
    fake_llm(json.dumps({
        "title": "Cut deploy time in half",
        "situation": "s", "task": "t", "action": "a", "result": "r",
        "version_30s": "short", "version_90s": "long",
        "competencies_shown": ["ownership"],
    }))
    resp = api_client.post("/build-star-story/", json={
        "experience": "Our deploys took 40 minutes and broke weekly. I rebuilt the CI pipeline with caching and parallel jobs.",
        "competency": "ownership",
    })
    assert resp.status_code == 200
    body = resp.json()
    for key in ("situation", "task", "action", "result"):
        assert key in body


# ── /generate-pitch/ ─────────────────────────────────────────────────────────

def test_pitch_rejects_short_resume(api_client):
    resp = api_client.post("/generate-pitch/", json={"resume_text": "short", "target_role": "SWE"})
    assert resp.status_code == 400


def test_pitch_requires_role(api_client):
    resp = api_client.post("/generate-pitch/", json={"resume_text": RESUME, "target_role": " "})
    assert resp.status_code == 400


def test_pitch_returns_three_lengths(api_client, fake_llm):
    fake_llm(json.dumps({"pitch_30s": "a", "pitch_60s": "b", "pitch_90s": "c", "headline_options": ["h"]}))
    resp = api_client.post("/generate-pitch/", json={"resume_text": RESUME, "target_role": "SWE", "context": "career_fair"})
    assert resp.status_code == 200
    assert resp.json()["pitch_90s"] == "c"


def test_pitch_tolerates_unknown_context(api_client, fake_llm):
    fake_llm(json.dumps({"pitch_30s": "a"}))
    resp = api_client.post("/generate-pitch/", json={"resume_text": RESUME, "target_role": "SWE", "context": "???"})
    assert resp.status_code == 200


# ── /negotiate-offer/ ────────────────────────────────────────────────────────

def test_negotiate_rejects_zero_salary(api_client):
    resp = api_client.post("/negotiate-offer/", json={"role": "SWE", "base_salary": 0})
    assert resp.status_code == 400


def test_negotiate_requires_role(api_client):
    resp = api_client.post("/negotiate-offer/", json={"role": "", "base_salary": 120000})
    assert resp.status_code == 400


def test_negotiate_returns_counter(api_client, fake_llm):
    fake_llm(json.dumps({
        "verdict": "Below market",
        "market_range": {"low": 130000, "mid": 150000, "high": 175000},
        "recommended_ask": {"base": 150000, "signing_bonus": 10000, "other": "remote"},
        "counter_email": "Thank you for the offer...",
    }))
    resp = api_client.post("/negotiate-offer/", json={
        "role": "Backend Engineer", "company": "Acme", "base_salary": 125000,
        "bonus": 10000, "equity": "0.05%", "years_experience": 3,
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["verdict"] == "Below market"
    assert body["recommended_ask"]["base"] == 150000


# ── /compose-reply/ ──────────────────────────────────────────────────────────

MESSAGE = "Hi! We'd love to set up a 30-minute call next week to discuss the Backend Engineer role. What times work for you?"


def test_reply_rejects_unknown_intent(api_client):
    resp = api_client.post("/compose-reply/", json={"their_message": MESSAGE, "intent": "ghost_them"})
    assert resp.status_code == 400
    assert "intent must be one of" in resp.json()["detail"]


def test_reply_rejects_empty_message(api_client):
    resp = api_client.post("/compose-reply/", json={"their_message": "hi", "intent": "accept_interview"})
    assert resp.status_code == 400


def test_reply_returns_email_and_short_version(api_client, fake_llm):
    fake_llm(json.dumps({
        "subject": "Re: Backend Engineer role",
        "reply": "Thanks for reaching out. Tuesday or Wednesday afternoon works well for me.",
        "alt_shorter": "Tuesday or Wednesday afternoon works. Thanks!",
    }))
    resp = api_client.post("/compose-reply/", json={
        "their_message": MESSAGE, "intent": "accept_interview",
        "your_name": "Bargavi", "context": "Free Tue/Wed afternoons", "tone": "warm",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["subject"].startswith("Re:")
    assert "alt_shorter" in body


def test_reply_falls_back_to_warm_tone(api_client, fake_llm):
    fake_llm(json.dumps({"subject": "s", "reply": "r"}))
    resp = api_client.post("/compose-reply/", json={"their_message": MESSAGE, "intent": "thank_you", "tone": "sarcastic"})
    assert resp.status_code == 200


# ── shared behaviour ─────────────────────────────────────────────────────────

def test_tools_v2_surface_llm_failure_as_500(api_client, fake_llm):
    fake_llm("this is not json")
    resp = api_client.post("/decode-jd/", json={"job_description": JD})
    assert resp.status_code == 500
    assert "JD decoding failed" in resp.json()["detail"]
