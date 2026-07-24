"""End-to-end rate limiting through a real endpoint.

The expensive tier allows 10 requests/minute per IP. Using one fixed IP for
all requests in this test (unique to this test via the api_client fixture),
the 11th call must be rejected with a 429 and a Retry-After header.
"""

import json


def test_expensive_tier_returns_429_after_ten_requests(api_client, fake_llm):
    fake_llm(json.dumps({"rewritten": "x", "explanation": "y"}))
    payload = {"bullet": "responsible for things and stuff"}

    for i in range(10):
        resp = api_client.post("/rewrite-bullet/", json=payload)
        assert resp.status_code == 200, f"request {i + 1} should pass"

    resp = api_client.post("/rewrite-bullet/", json=payload)
    assert resp.status_code == 429
    assert "retry-after" in {k.lower() for k in resp.headers}
    assert "rate limit" in resp.json()["detail"].lower()
