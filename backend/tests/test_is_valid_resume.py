"""Tests for main.is_valid_resume."""

from main import is_valid_resume


def test_accepts_a_realistic_resume():
    text = "jane@example.com 2020 experience education " + " ".join(["engineer"] * 220)
    assert is_valid_resume(text) is True


def test_rejects_short_text():
    assert is_valid_resume("just a short note") is False


def test_rejects_long_text_without_contact_or_sections():
    # 250 words but no email, no section signals, no dates
    assert is_valid_resume(" ".join(["lorem"] * 250)) is False
