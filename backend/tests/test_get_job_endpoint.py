"""Tests for GET /jobs/{job_id} — single-job lookup behind shareable deep links."""


def test_returns_the_job(api_client, fake_supabase):
    fake_supabase(tables={"jobs": [{"job_id": "abc-123", "title": "Backend Engineer"}]})

    resp = api_client.get("/jobs/abc-123")

    assert resp.status_code == 200
    assert resp.json()["job"]["title"] == "Backend Engineer"


def test_unknown_id_is_404(api_client, fake_supabase):
    fake_supabase(tables={"jobs": []})
    assert api_client.get("/jobs/nope").status_code == 404


def test_malformed_ids_are_rejected_without_a_db_hit(api_client, fake_supabase):
    db = fake_supabase()
    resp = api_client.get("/jobs/%21%40%23")  # "!@#" fails the id regex
    assert resp.status_code == 404
    assert db.calls == []


def test_db_outage_maps_to_503(api_client, fake_supabase):
    fake_supabase(fail=True)
    assert api_client.get("/jobs/abc-123").status_code == 503


def test_static_jobs_routes_are_not_shadowed(api_client, fake_supabase):
    # The dynamic route is declared last; /jobs/stats must still hit stats.
    import main
    main._STATS_CACHE["data"] = None
    fake_supabase(tables={"jobs": [], "ingestion_runs": []}, counts={"jobs": 5})

    resp = api_client.get("/jobs/stats")

    assert resp.status_code == 200
    assert resp.json()["total_jobs"] == 5
