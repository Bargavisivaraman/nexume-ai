"""Tests for security._constant_time_eq."""

from security import _constant_time_eq


def test_equal_strings_return_true():
    assert _constant_time_eq("abc123XYZ", "abc123XYZ") is True


def test_both_empty_return_true():
    assert _constant_time_eq("", "") is True


def test_same_length_but_different_return_false():
    assert _constant_time_eq("abc123", "abc124") is False


def test_different_lengths_return_false():
    assert _constant_time_eq("short", "a-much-longer-value") is False
    assert _constant_time_eq("a-much-longer-value", "short") is False
