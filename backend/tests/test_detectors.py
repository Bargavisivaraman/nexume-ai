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


def test_senior_title_with_graduate_degree_mention_stays_senior():
    # "graduate degree preferred" in the description must not reclassify a
    # senior role as Entry Level / new grad.
    desc = "PhD or graduate degree preferred. 8+ years of experience."
    assert detect_experience_level("Senior ML Engineer", desc) == "Senior"
    assert detect_new_grad("Senior ML Engineer", desc) is False


def test_exec_title_wins_over_description_signals():
    assert detect_experience_level("VP of Engineering", "early career mentorship program") == "Executive"


def test_graduate_program_still_counts_as_new_grad():
    assert detect_new_grad("Software Engineer, Graduate Program") is True
    assert detect_experience_level("Software Engineer, Graduate Program") == "Entry Level"
