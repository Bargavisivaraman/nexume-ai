"""Tests for POST /interview-turn/ — the real-time voice interview engine."""


def _turns(n):
    """History with n user turns (alternating ai/user)."""
    out = []
    for i in range(n):
        out.append({"role": "ai", "content": f"Question {i}?"})
        out.append({"role": "user", "content": f"Answer {i}."})
    return out


def test_start_turn_returns_greeting_and_no_end(api_client, fake_llm):
    fake_llm("Hi! Great to meet you. Tell me about yourself.")

    resp = api_client.post("/interview-turn/", json={"mode": "hr", "is_start": True})

    assert resp.status_code == 200
    body = resp.json()
    assert body["turn_count"] == 0
    assert body["should_end"] is False
    assert body["message"].startswith("Hi!")


def test_closing_phrase_signals_the_end(api_client, fake_llm):
    fake_llm("Thanks for your time — best of luck with your search!")

    resp = api_client.post("/interview-turn/", json={
        "mode": "hr",
        "history": _turns(3),
    })

    assert resp.status_code == 200
    body = resp.json()
    assert body["should_end"] is True
    assert body["turn_count"] == 3


def test_long_interviews_end_even_without_a_closing_phrase(api_client, fake_llm):
    fake_llm("And one more question: what motivates you?")

    resp = api_client.post("/interview-turn/", json={
        "mode": "technical",
        "history": _turns(7),
    })

    assert resp.status_code == 200
    body = resp.json()
    assert body["turn_count"] == 7
    assert body["should_end"] is True
