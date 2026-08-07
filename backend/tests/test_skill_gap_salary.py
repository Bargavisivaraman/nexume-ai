"""Tests for POST /analyze-skill-gap/ and POST /estimate-salary/."""

import json

RESUME = "Python engineer with FastAPI, Postgres, and AWS experience. " * 5


def test_skill_gap_rejects_short_resume(api_client):
    resp = api_client.post("/analyze-skill-gap/", json={"resume_text": "short", "target_role": "ML Engineer"})
    assert resp.status_code == 400


def test_skill_gap_requires_target_role(api_client):
    resp = api_client.post("/analyze-skill-gap/", json={"resume_text": RESUME, "target_role": "  "})
    assert resp.status_code == 400


def test_skill_gap_returns_readiness(api_client, fake_llm):
    fake_llm(json.dumps({
        "readiness_score": 72,
        "readiness_label": "Almost Ready",
        "missing_skills": ["MLOps"],
    }))
    resp = api_client.post("/analyze-skill-gap/", json={"resume_text": RESUME, "target_role": "ML Engineer"})
    assert resp.status_code == 200
    assert resp.json()["readiness_score"] == 72


def test_salary_rejects_short_resume(api_client):
    resp = api_client.post("/estimate-salary/", json={"resume_text": "short", "target_role": "SWE"})
    assert resp.status_code == 400


def test_salary_returns_range(api_client, fake_llm):
    fake_llm(json.dumps({
        "experience_level": "Mid",
        "years_experience": 4,
        "salary_range": {"min": 120000, "max": 160000, "median": 140000},
    }))
    resp = api_client.post("/estimate-salary/", json={"resume_text": RESUME, "target_role": "SWE"})
    assert resp.status_code == 200
    assert resp.json()["salary_range"]["median"] == 140000
