"""Tests for jobs.build_jobs_query — asserts the filter chain it builds."""

import re

from jobs import build_jobs_query
from tests.conftest import FakeSupabase


def calls_of(fake, method):
    return [(args, kwargs) for (_t, m, args, kwargs) in fake.calls if m == method]


def assert_well_formed_or(clause: str):
    """Every comma-separated part must be a clean col.ilike.%term% — a stray
    comma or parenthesis inside a term splits/garbles the or= syntax
    (PostgREST PGRST100)."""
    for part in clause.split(","):
        assert re.fullmatch(r"\w+\.ilike\.%[^%(),]*%", part), f"malformed or= part: {part!r}"


def test_base_query_filters_country_and_active():
    fake = FakeSupabase()
    build_jobs_query(fake, country="us")

    eqs = calls_of(fake, "eq")
    assert (("country", "US"), {}) in eqs   # uppercased
    assert (("is_active", True), {}) in eqs


def test_keyword_searches_title_company_and_description():
    fake = FakeSupabase()
    build_jobs_query(fake, country="US", keyword="python")

    (args, _k), = calls_of(fake, "or_")
    assert "title.ilike.%python%" in args[0]
    assert "company.ilike.%python%" in args[0]
    assert "description.ilike.%python%" in args[0]


def test_experience_level_shorthand_is_resolved():
    fake = FakeSupabase()
    build_jobs_query(fake, country="US", experience_level="entry")
    assert (("experience_level", "Entry Level"), {}) in calls_of(fake, "eq")


def test_state_filter_sanitizes_commas_and_ors_across_columns():
    fake = FakeSupabase()
    build_jobs_query(fake, country="US", state_filter="Los Angeles, CA")

    (args, _k), = calls_of(fake, "or_")
    clause = args[0]
    assert_well_formed_or(clause)
    # The comma is swapped for a space (PostgREST OR syntax breaks on it)
    assert "Los Angeles, CA" not in clause
    assert "city.ilike.%Los Angeles CA%" in clause
    assert "state.ilike.%Los Angeles CA%" in clause
    # The city segment is matched on its own — the full "Los Angeles CA"
    # pattern can't hit the comma-formed `location` column
    assert "city.ilike.%Los Angeles%" in clause
    assert "location.ilike.%Los Angeles%" in clause


def test_keyword_with_comma_builds_well_formed_or():
    fake = FakeSupabase()
    build_jobs_query(fake, country="US", keyword="ux, design")

    (args, _k), = calls_of(fake, "or_")
    clause = args[0]
    assert_well_formed_or(clause)
    assert "title.ilike.%ux design%" in clause


def test_state_filter_with_parentheses_builds_well_formed_or():
    fake = FakeSupabase()
    build_jobs_query(fake, country="US", state_filter="Austin (TX)")

    (args, _k), = calls_of(fake, "or_")
    clause = args[0]
    assert_well_formed_or(clause)
    assert "city.ilike.%Austin TX%" in clause


def test_punctuation_only_inputs_skip_the_or_filter():
    fake = FakeSupabase()
    build_jobs_query(fake, country="US", keyword="(,)", state_filter="%()%")
    assert calls_of(fake, "or_") == []


def test_select_includes_skill_chip_and_flag_columns():
    fake = FakeSupabase()
    build_jobs_query(fake, country="US")

    (args, _k), = calls_of(fake, "select")
    cols = args[0].split(",")
    for col in ("tech_stack", "is_internship", "is_new_grad"):
        assert col in cols, f"{col} missing from listing SELECT"


def test_optional_filters_stack():
    fake = FakeSupabase()
    build_jobs_query(fake, country="US", industry="Technology", job_type="Full-time",
                     work_mode="Remote")

    eqs = calls_of(fake, "eq")
    assert (("industry", "Technology"), {}) in eqs
    assert (("job_type", "Full-time"), {}) in eqs
    assert (("work_mode", "Remote"), {}) in eqs
