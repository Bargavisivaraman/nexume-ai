"""Tests for /chat/'s Groq branch — used when GROQ_API_KEY is configured."""

from tests.conftest import FakeOpenAI


def test_chat_uses_groq_when_key_is_set(api_client, fake_supabase, monkeypatch):
    import main

    fake_supabase()
    monkeypatch.setenv("GROQ_API_KEY", "gsk-test")
    groq = FakeOpenAI("Groq says: lead with impact.")
    openai = FakeOpenAI("OpenAI should not be called.")
    monkeypatch.setattr(main, "groq_client", groq)
    monkeypatch.setattr(main, "openai_client", openai)

    resp = api_client.post("/chat/", json={
        "messages": [{"role": "user", "content": "How do I write a good summary?"}],
    })

    assert resp.status_code == 200
    assert "Groq says" in resp.json()["reply"]
    assert groq.calls == 1
    assert openai.calls == 0


def test_chat_uses_openai_without_a_groq_key(api_client, fake_supabase, monkeypatch):
    import main

    fake_supabase()
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    groq = FakeOpenAI("wrong branch")
    openai = FakeOpenAI("OpenAI reply.")
    monkeypatch.setattr(main, "groq_client", groq)
    monkeypatch.setattr(main, "openai_client", openai)

    resp = api_client.post("/chat/", json={
        "messages": [{"role": "user", "content": "How do I write a good summary?"}],
    })

    assert resp.status_code == 200
    assert resp.json()["reply"] == "OpenAI reply."
    assert groq.calls == 0
