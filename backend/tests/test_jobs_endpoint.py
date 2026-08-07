"""Tests for GET /jobs/ — DB-backed listing and the graceful offline path."""

DB_ROWS = [
    {"job_id": "1", "title": "Backend Engineer", "company": "Acme", "source": "Greenhouse"},
    {"job_id": "2", "title": "Data Engineer", "company": "Beta", "source": "Lever"},
]


def test_serves_jobs_from_the_database(api_client, fake_supabase):
    fake_supabase(tables={"jobs": DB_ROWS})

    resp = api_client.get("/jobs/", params={"country": "us", "per_page": 2})

    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 2
    assert body["country"] == "US"
    assert body["supabase_offline"] is False
    assert body["has_more"] is True  # page filled to per_page
    assert {j["job_id"] for j in body["jobs"]} == {"1", "2"}


def test_offline_db_and_dead_live_sources_degrade_gracefully(api_client, fake_supabase, patch_httpx, monkeypatch):
    # Supabase raises; live sources without creds return [] and the httpx-backed
    # ones get 500s — the endpoint must still answer cleanly, never 500.
    fake_supabase(fail=True)
    patch_httpx({}, status=500)
    monkeypatch.delenv("ADZUNA_APP_ID", raising=False)
    monkeypatch.delenv("USAJOBS_API_KEY", raising=False)

    resp = api_client.get("/jobs/", params={"country": "US"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["jobs"] == []
    assert body["supabase_offline"] is True
