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


def test_empty_db_result_is_served_without_live_fallback(api_client, fake_supabase, monkeypatch):
    """Zero rows from a HEALTHY DB (strict filters, paging past the end) is a
    real answer — it must not be papered over with ~150 unfiltered live jobs."""
    import main

    fake_supabase(tables={"jobs": []})
    called = []

    async def tripwire(*a, **k):
        called.append(a)
        return []

    for name in ("fetch_adzuna_jobs", "fetch_themuse_jobs", "fetch_usajobs",
                 "fetch_remotive_jobs", "fetch_jobicy_jobs", "fetch_arbeitnow_jobs"):
        monkeypatch.setattr(main, name, tripwire)

    resp = api_client.get("/jobs/", params={"country": "US", "keyword": "zzz-no-match", "page": 3})

    assert resp.status_code == 200
    body = resp.json()
    assert body["jobs"] == []
    assert body["supabase_offline"] is False
    assert body["has_more"] is False
    assert called == []  # live sources never touched


def _patch_live_sources(monkeypatch, jobs):
    import main

    async def full(*a, **k):
        return jobs

    async def empty(*a, **k):
        return []

    monkeypatch.setattr(main, "fetch_adzuna_jobs", full)
    for name in ("fetch_themuse_jobs", "fetch_usajobs", "fetch_remotive_jobs",
                 "fetch_jobicy_jobs", "fetch_arbeitnow_jobs"):
        monkeypatch.setattr(main, name, empty)


def test_live_fallback_pages_with_offset_and_per_page(api_client, fake_supabase, monkeypatch):
    """When the DB is down, the merged live list must be sliced like a DB page
    — before this, every page returned the full list and has_more never went
    False, so the frontend paginated forever."""
    fake_supabase(fail=True)
    live = [{"title": f"Role {i}", "company": f"Co {i}", "source": "Adzuna"} for i in range(25)]
    _patch_live_sources(monkeypatch, live)

    page2 = api_client.get("/jobs/", params={"country": "US", "page": 2, "per_page": 10}).json()
    assert page2["supabase_offline"] is True
    assert page2["count"] == 10
    assert [j["title"] for j in page2["jobs"]] == [f"Role {i}" for i in range(10, 20)]
    assert page2["has_more"] is True

    page3 = api_client.get("/jobs/", params={"country": "US", "page": 3, "per_page": 10}).json()
    assert page3["count"] == 5
    assert page3["has_more"] is False

    page4 = api_client.get("/jobs/", params={"country": "US", "page": 4, "per_page": 10}).json()
    assert page4["jobs"] == []
    assert page4["has_more"] is False


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
