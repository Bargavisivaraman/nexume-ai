"""Tests for POST /jobs/refresh/ — the admin-gated manual ingestion trigger.

With no JSEARCH_API_KEY in the test environment, the triggered background
task logs a skip and returns immediately, so no network activity occurs.
"""


def test_refresh_without_token_looks_like_404(api_client, monkeypatch):
    monkeypatch.delenv("NEXUME_ADMIN_TOKEN", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)

    resp = api_client.post("/jobs/refresh/")
    assert resp.status_code == 404


def test_refresh_with_wrong_token_looks_like_404(api_client, monkeypatch):
    monkeypatch.setenv("NEXUME_ADMIN_TOKEN", "right-token")

    resp = api_client.post("/jobs/refresh/", headers={"x-admin-token": "wrong"})
    assert resp.status_code == 404


def test_refresh_with_correct_token_triggers(api_client, monkeypatch):
    monkeypatch.setenv("NEXUME_ADMIN_TOKEN", "right-token")
    monkeypatch.delenv("JSEARCH_API_KEY", raising=False)

    resp = api_client.post("/jobs/refresh/", headers={"x-admin-token": "right-token"})

    assert resp.status_code == 200
    assert "triggered" in resp.json()["message"].lower()
