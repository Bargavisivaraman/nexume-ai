"""Tests for GET /jobs/{job_id} — the deep-link lookup."""

ROW = {"job_id": "gh_acme_123", "title": "Backend Engineer", "company": "Acme", "country": "US"}


def test_returns_the_job(api_client, fake_supabase):
    fake = fake_supabase(tables={"jobs": [ROW]})
    resp = api_client.get("/jobs/gh_acme_123")
    assert resp.status_code == 200
    assert resp.json()["job"]["title"] == "Backend Engineer"
    # looked up by exact id
    assert ("jobs", "eq", ("job_id", "gh_acme_123"), {}) in fake.calls


def test_unknown_id_is_404(api_client, fake_supabase):
    fake_supabase(tables={"jobs": []})
    resp = api_client.get("/jobs/gh_nope_1")
    assert resp.status_code == 404


def test_malformed_id_is_404_without_touching_db(api_client, fake_supabase):
    fake = fake_supabase(tables={"jobs": [ROW]})
    resp = api_client.get("/jobs/%3Cscript%3E")
    assert resp.status_code == 404
    assert fake.calls == []


def test_db_outage_is_503(api_client, fake_supabase):
    fake_supabase(fail=True)
    resp = api_client.get("/jobs/gh_acme_123")
    assert resp.status_code == 503


def test_static_jobs_routes_are_not_shadowed(api_client, fake_supabase):
    fake_supabase(tables={"jobs": []}, counts={"jobs": 0})
    assert api_client.get("/jobs/stats").status_code == 200
    assert api_client.get("/jobs/status/").status_code == 200
