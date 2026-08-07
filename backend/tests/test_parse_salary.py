"""Tests for aggregators.common.parse_salary."""

from aggregators.common import parse_salary


def test_hourly_rate():
    assert parse_salary("$50/hour") == (50.0, 50.0, "hour")


def test_k_style_range():
    assert parse_salary("$120k - $160k") == (120000.0, 160000.0, "year")


def test_standard_range_with_commas():
    assert parse_salary("$120,000 - $160,000") == (120000.0, 160000.0, "year")


def test_range_with_word_to():
    assert parse_salary("$100k to $150k") == (100000.0, 150000.0, "year")


def test_single_k_value():
    assert parse_salary("$130k") == (130000.0, 130000.0, "year")


def test_empty_and_unparseable():
    assert parse_salary("") == (None, None, None)
    assert parse_salary("competitive compensation") == (None, None, None)
