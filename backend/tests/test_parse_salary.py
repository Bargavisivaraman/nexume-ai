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


def test_retirement_plans_are_not_salaries():
    assert parse_salary("401k matching and great benefits") == (None, None, None)
    assert parse_salary("401(k) with employer match") == (None, None, None)
    assert parse_salary("403b retirement plan") == (None, None, None)


def test_bare_k_numbers_without_dollar_sign_are_ignored():
    assert parse_salary("serving 20k customers worldwide") == (None, None, None)
    assert parse_salary("scale from 50k to 200k users") == (None, None, None)


def test_dollar_amount_still_parses_next_to_retirement_mention():
    assert parse_salary("$120k - $160k plus 401k matching") == (120000.0, 160000.0, "year")
