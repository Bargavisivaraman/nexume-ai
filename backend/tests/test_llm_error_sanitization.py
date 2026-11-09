"""Provider billing/auth failures must never reach visitors verbatim."""

import main


class _ExplodingCompletions:
    def __init__(self, message):
        self._message = message

    def create(self, **kwargs):
        raise RuntimeError(self._message)


class _ExplodingOpenAI:
    def __init__(self, message):
        self.chat = type("C", (), {})()
        self.chat.completions = _ExplodingCompletions(message)


QUOTA_MSG = ("Error code: 429 - {'error': {'message': 'You have no credits remaining. "
             "Add credits at https://platform.openai.com/settings/organization/billing/.', "
             "'code': 'credit_balance_exhausted'}}")

RESUME = "Python engineer with FastAPI, Postgres, and AWS experience. " * 5


def test_quota_exhaustion_returns_clean_503(api_client, monkeypatch):
    monkeypatch.setattr(main, "openai_client", _ExplodingOpenAI(QUOTA_MSG))
    resp = api_client.post("/analyze-skill-gap/", json={"resume_text": RESUME, "target_role": "ML Engineer"})
    assert resp.status_code == 503
    detail = resp.json()["detail"]
    assert "temporarily unavailable" in detail
    for leak in ("credits", "billing", "platform.openai.com", "429"):
        assert leak not in detail


def test_invalid_key_returns_clean_503(api_client, monkeypatch):
    monkeypatch.setattr(main, "openai_client", _ExplodingOpenAI("Error code: 401 - invalid_api_key"))
    resp = api_client.post("/interview-turn/", json={"mode": "hr", "history": [], "is_start": True, "target_role": "SWE"})
    assert resp.status_code == 503
    assert "invalid_api_key" not in resp.json()["detail"]


def test_other_llm_errors_stay_500_without_internals(api_client, monkeypatch):
    monkeypatch.setattr(main, "openai_client", _ExplodingOpenAI("connection reset by provider xyz-internal-host"))
    resp = api_client.post("/decode-jd/", json={"job_description": "Backend Engineer. Python, FastAPI, Postgres required. " * 4})
    assert resp.status_code == 500
    detail = resp.json()["detail"]
    assert "xyz-internal-host" not in detail
    assert detail.endswith("Please try again.")
