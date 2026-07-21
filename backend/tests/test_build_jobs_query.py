"""Tests for jobs.build_jobs_query — asserts the filter chain it builds."""

from jobs import build_jobs_query
from tests.conftest import FakeSupabase


def calls_of(fake, method):
    return [(args, kwargs) for (_t, m, args, kwargs) in fake.calls if m == method]


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


def test_state_filter_strips_commas_and_ors_across_columns():
    fake = FakeSupabase()
    build_jobs_query(fake, country="US", state_filter="Los Angeles, CA")

    (args, _k), = calls_of(fake, "or_")
    clause = args[0]
    # The comma is stripped from the search term (PostgREST OR syntax breaks on it)
    assert "Los Angeles, CA" not in clause
    assert "city.ilike.%Los Angeles CA%" in clause
    assert "state.ilike.%Los Angeles CA%" in clause
    assert "city.ilike.%Los%" in clause  # first-token fallback


def test_optional_filters_stack():
    fake = FakeSupabase()
    build_jobs_query(fake, country="US", industry="Technology", job_type="Full-time",
                     work_mode="Remote")

    eqs = calls_of(fake, "eq")
    assert (("industry", "Technology"), {}) in eqs
    assert (("job_type", "Full-time"), {}) in eqs
    assert (("work_mode", "Remote"), {}) in eqs
