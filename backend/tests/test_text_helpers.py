"""Tests for main.sanitize_text and main.normalize_text."""

from main import normalize_text, sanitize_text


def test_sanitize_removes_null_and_control_bytes():
    assert sanitize_text("hello\x00world\x07!") == "helloworld!"


def test_sanitize_keeps_newlines_and_tabs():
    assert sanitize_text("line1\nline2\tend") == "line1\nline2\tend"


def test_normalize_lowercases_and_collapses_whitespace():
    out = normalize_text("Python    AND    JavaScript")
    assert out == out.lower()
    assert "  " not in out
    assert "python" in out and "javascript" in out
