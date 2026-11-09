"""Smoke test for the /health endpoint via FastAPI's TestClient.

The client is not entered as a context manager, so the app's startup/shutdown
lifespan (scheduler, ingestion) does not run — this only exercises routing.
"""

from fastapi.testclient import TestClient

from main import app


def test_health_returns_ok():
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "endpoints" in body
