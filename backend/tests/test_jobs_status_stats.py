"""Tests for GET /jobs/status/, GET /jobs/stats, and GET /warmup."""


def test_status_returns_recent_runs(api_client, fake_supabase):
    fake_supabase(tables={"ingestion_runs": [{"run_id": "r1", "inserted": 10}]})

    resp = api_client.get("/jobs/status/")

    assert resp.status_code == 200
    assert resp.json()["runs"][0]["run_id"] == "r1"


def test_status_flags_offline_db(api_client, fake_supabase):
    fake_supabase(fail=True)

    resp = api_client.get("/jobs/status/")

    assert resp.status_code == 200
    assert resp.json() == {"runs": [], "supabase_offline": True}


def test_stats_reports_counts_and_sources(api_client, fake_supabase):
    fake_supabase(
        tables={"jobs": [{"fetched_at": "2026-07-20T12:00:00Z"}], "ingestion_runs": []},
        counts={"jobs": 1937},
    )

    resp = api_client.get("/jobs/stats")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total_jobs"] == 1937
    assert body["last_updated"] == "2026-07-20T12:00:00Z"
    assert set(body["sources"]) == {"Greenhouse", "Lever", "Ashby", "Workable"}
    assert body["supabase_offline"] is False


def test_stats_degrades_when_db_is_offline(api_client, fake_supabase):
    fake_supabase(fail=True)

    resp = api_client.get("/jobs/stats")

    assert resp.status_code == 200
    body = resp.json()
    assert body["supabase_offline"] is True
    assert body["total_jobs"] is None


def test_stats_serves_cached_payload_within_ttl(api_client, fake_supabase):
    """Second call inside the 30s TTL must come from the cache — the DB going
    down right after a healthy read shouldn't flip the response until expiry."""
    fake_supabase(
        tables={"jobs": [{"fetched_at": "2026-07-20T12:00:00Z"}], "ingestion_runs": []},
        counts={"jobs": 42},
    )
    first = api_client.get("/jobs/stats").json()
    assert first["total_jobs"] == 42

    fake_supabase(fail=True)  # DB dies — but the cache should still answer
    second = api_client.get("/jobs/stats").json()
    assert second["total_jobs"] == 42
    assert second["supabase_offline"] is False


def test_warmup_pings(api_client):
    resp = api_client.get("/warmup")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_stats_cache_expires_after_the_ttl(api_client, fake_supabase, monkeypatch):
    """After the 30s TTL a fresh read must hit the DB again — a stale count
    can't outlive the window."""
    import main

    main._STATS_CACHE["data"] = None  # isolate from other tests
    t = [10_000.0]
    monkeypatch.setattr(main.time, "monotonic", lambda: t[0])

    fake_supabase(tables={"jobs": [{"fetched_at": "x"}], "ingestion_runs": []}, counts={"jobs": 10})
    assert api_client.get("/jobs/stats").json()["total_jobs"] == 10

    fake_supabase(tables={"jobs": [{"fetched_at": "x"}], "ingestion_runs": []}, counts={"jobs": 99})
    t[0] += main._STATS_TTL_SECONDS + 1

    assert api_client.get("/jobs/stats").json()["total_jobs"] == 99


def test_offline_payload_is_never_cached(api_client, fake_supabase):
    """An offline response must not poison the cache — the next healthy read
    recovers immediately."""
    import main

    main._STATS_CACHE["data"] = None
    fake_supabase(fail=True)
    assert api_client.get("/jobs/stats").json()["supabase_offline"] is True

    fake_supabase(tables={"jobs": [{"fetched_at": "x"}], "ingestion_runs": []}, counts={"jobs": 7})
    body = api_client.get("/jobs/stats").json()
    assert body["supabase_offline"] is False
    assert body["total_jobs"] == 7
