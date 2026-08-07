"""Tests for POST /transcribe/ — speech-to-text for interview answers."""


def _audio(content=b"webm-bytes", name="answer.webm"):
    return {"audio": (name, content, "audio/webm")}


def test_rejects_empty_audio(api_client, fake_llm):
    fake_llm("unused")
    resp = api_client.post("/transcribe/", files=_audio(content=b""))
    assert resp.status_code == 400


def test_rejects_oversized_audio(api_client, fake_llm):
    fake_llm("unused")
    resp = api_client.post("/transcribe/", files=_audio(content=b"0" * (15 * 1024 * 1024 + 1)))
    assert resp.status_code == 413


def test_transcribes_with_the_primary_model(api_client, fake_llm):
    fake = fake_llm("unused", transcript="I led the migration project.")

    resp = api_client.post("/transcribe/", files=_audio())

    assert resp.status_code == 200
    assert resp.json() == {"text": "I led the migration project."}
    assert fake.transcribe_models == ["gpt-4o-transcribe"]


def test_falls_back_to_whisper_when_the_primary_fails(api_client, fake_llm):
    fake = fake_llm("unused", transcript="fallback text", audio_fail_first=True)

    resp = api_client.post("/transcribe/", files=_audio())

    assert resp.status_code == 200
    assert resp.json() == {"text": "fallback text"}
    assert fake.transcribe_models == ["gpt-4o-transcribe", "whisper-1"]
