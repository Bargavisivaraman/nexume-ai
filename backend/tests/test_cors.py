"""Tests for the CORS allow-list: production, localhost, previews — no wildcards."""


def _preflight(api_client, origin):
    return api_client.options("/jobs/stats", headers={
        "Origin": origin,
        "Access-Control-Request-Method": "GET",
    })


def test_production_origin_is_allowed(api_client):
    resp = _preflight(api_client, "https://nexume-ai.vercel.app")
    assert resp.headers.get("access-control-allow-origin") == "https://nexume-ai.vercel.app"


def test_localhost_dev_origin_is_allowed(api_client):
    resp = _preflight(api_client, "http://localhost:5173")
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_vercel_preview_branches_match_the_regex(api_client):
    origin = "https://nexume-ai-git-feature-x.vercel.app"
    resp = _preflight(api_client, origin)
    assert resp.headers.get("access-control-allow-origin") == origin


def test_unknown_origins_get_no_cors_headers(api_client):
    resp = _preflight(api_client, "https://evil.example.com")
    assert resp.headers.get("access-control-allow-origin") is None
