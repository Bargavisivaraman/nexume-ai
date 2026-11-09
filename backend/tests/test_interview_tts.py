"""Tests for POST /interview-tts/ — text-to-speech for the voice interviewer."""


def test_requires_text(api_client, fake_llm):
    fake_llm("unused")
    resp = api_client.post("/interview-tts/", json={"text": "   "})
    assert resp.status_code == 400


def test_streams_mp3_bytes(api_client, fake_llm):
    fake_llm("unused", audio_bytes=b"ID3-fake-mp3")

    resp = api_client.post("/interview-tts/", json={"text": "Tell me about yourself.", "voice": "nova"})

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("audio/mpeg")
    assert resp.headers["cache-control"] == "no-store"
    assert resp.content == b"ID3-fake-mp3"


def test_unknown_voice_still_succeeds_via_fallback(api_client, fake_llm):
    fake_llm("unused")
    resp = api_client.post("/interview-tts/", json={"text": "Hello there.", "voice": "not-a-voice"})
    assert resp.status_code == 200
