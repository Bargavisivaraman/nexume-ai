"""Tests for POST /waitlist/ — validation and the file fallback."""

import json


def test_rejects_invalid_email(api_client):
    resp = api_client.post("/waitlist/", json={"email": "not-an-email"})
    assert resp.status_code == 400


def test_falls_back_to_file_when_db_is_down(api_client, monkeypatch, tmp_path):
    import main

    class _DownSupabase:
        def table(self, name):
            raise RuntimeError("db unreachable")

    fallback = tmp_path / "waitlist_fallback.jsonl"
    monkeypatch.setattr(main, "supabase", _DownSupabase())
    monkeypatch.setattr(main, "_WAITLIST_FALLBACK", str(fallback))

    resp = api_client.post("/waitlist/", json={"email": "Person@Example.COM", "source": "test"})

    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "fallback": True}
    row = json.loads(fallback.read_text().strip())
    # Email is normalized to lowercase before storage
    assert row["email"] == "person@example.com"
    assert row["source"] == "test"
