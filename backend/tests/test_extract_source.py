"""Tests for jobs.extract_source."""

from jobs import extract_source


def test_known_source_is_mapped():
    assert extract_source("https://www.linkedin.com/jobs/view/123") == "LinkedIn"


def test_empty_url_is_unknown():
    assert extract_source("") == "Unknown"


def test_unknown_host_returns_bare_host():
    assert extract_source("https://careers.acme.io/job/9") == "careers.acme.io"
