"""Tests for the seniority / internship / new-grad detectors in common.py."""

from aggregators.common import (
    detect_experience_level,
    detect_internship,
    detect_new_grad,
)


def test_experience_level_intern_is_entry():
    assert detect_experience_level("Software Engineer Intern") == "Entry Level"


def test_experience_level_new_grad_is_entry():
    assert detect_experience_level("New Grad Software Engineer") == "Entry Level"


def test_experience_level_executive():
    assert detect_experience_level("VP of Engineering") == "Executive"


def test_experience_level_senior():
    assert detect_experience_level("Senior Backend Engineer") == "Senior"


def test_experience_level_junior_is_entry():
    assert detect_experience_level("Junior Developer") == "Entry Level"


def test_experience_level_defaults_to_mid():
    assert detect_experience_level("Software Engineer") == "Mid Level"


def test_detect_internship():
    assert detect_internship("Data Science Intern") is True
    assert detect_internship("Data Scientist") is False


def test_detect_new_grad():
    assert detect_new_grad("New Grad Software Engineer") is True
    assert detect_new_grad("Senior Software Engineer") is False
