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


def test_warmup_pings(api_client):
    resp = api_client.get("/warmup")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
