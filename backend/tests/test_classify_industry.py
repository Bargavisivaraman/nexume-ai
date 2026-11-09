"""Tests for jobs.classify_industry."""

from jobs import classify_industry


def test_technology_titles():
    assert classify_industry("Senior Data Scientist") == "Technology"
    assert classify_industry("Backend Software Engineer") == "Technology"


def test_healthcare_title():
    assert classify_industry("Registered Nurse") == "Healthcare"


def test_education_title():
    assert classify_industry("High School Teacher") == "Education"


def test_unmatched_title_is_other():
    assert classify_industry("Zookeeper") == "Other"
