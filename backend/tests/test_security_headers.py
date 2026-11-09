"""Tests for the security-headers middleware applied to every response."""


def test_baseline_security_headers_on_every_response(api_client):
    resp = api_client.get("/warmup")

    assert resp.status_code == 200
    h = resp.headers
    assert h["x-content-type-options"] == "nosniff"
    assert h["x-frame-options"] == "DENY"
    assert h["referrer-policy"] == "strict-origin-when-cross-origin"
    assert "max-age=63072000" in h["strict-transport-security"]
    # Server fingerprint is masked
    assert h["server"] == "Nexume"
    # Mic stays allowed for the voice interview; camera and geolocation do not
    assert "microphone=(self)" in h["permissions-policy"]
    assert "camera=()" in h["permissions-policy"]


def test_headers_apply_to_error_responses_too(api_client):
    resp = api_client.post("/rewrite-bullet/", json={"bullet": "x"})  # 400

    assert resp.status_code == 400
    assert resp.headers["x-content-type-options"] == "nosniff"
    assert resp.headers["server"] == "Nexume"
