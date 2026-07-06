"""Tests for jobs.classify_experience."""

from jobs import classify_experience


def test_senior_title():
    assert classify_experience("Senior Software Engineer") == "Senior"


def test_intern_is_entry_level():
    assert classify_experience("Software Engineering Intern") == "Entry Level"


def test_plain_title_defaults_to_mid_level():
    assert classify_experience("Software Engineer") == "Mid Level"
