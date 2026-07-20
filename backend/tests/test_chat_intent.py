"""Tests for the chat job-intent detector (pure helper behind /chat/)."""

from main import _detect_job_intent


def test_no_intent_for_general_chat():
    assert _detect_job_intent("How do I negotiate a raise?") is None
    assert _detect_job_intent("Review my resume summary please") is None


def test_detects_intent_and_extracts_keyword():
    assert _detect_job_intent("find me python developer jobs") == "python developer"
    assert _detect_job_intent("any remote data scientist openings?") == "remote data scientist"


def test_intent_with_no_usable_keyword_returns_none():
    # Every word is either a stop word or too short
    assert _detect_job_intent("find me a job") is None


def test_keyword_capped_at_four_words():
    out = _detect_job_intent("find senior machine learning platform engineer infrastructure jobs")
    assert out is not None
    assert len(out.split()) <= 4
