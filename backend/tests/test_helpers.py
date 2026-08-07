"""Tests for compute_dedupe_hash and truncate in common.py."""

from aggregators.common import compute_dedupe_hash, truncate


def test_dedupe_hash_is_deterministic():
    a = compute_dedupe_hash("Engineer", "Acme", "NYC")
    b = compute_dedupe_hash("Engineer", "Acme", "NYC")
    assert a == b


def test_dedupe_hash_ignores_case_and_surrounding_space():
    a = compute_dedupe_hash("Engineer", "Acme", "NYC")
    b = compute_dedupe_hash("  engineer ", "ACME", " nyc")
    assert a == b


def test_dedupe_hash_differs_for_different_jobs():
    a = compute_dedupe_hash("Engineer", "Acme", "NYC")
    b = compute_dedupe_hash("Designer", "Acme", "NYC")
    assert a != b


def test_truncate_shortens_long_strings():
    assert truncate("hello world", 5) == "hello"


def test_truncate_leaves_short_strings():
    assert truncate("hi", 5) == "hi"


def test_truncate_strips_then_measures():
    assert truncate("   spaced   ", 100) == "spaced"


def test_truncate_none_returns_none():
    assert truncate(None, 5) is None
