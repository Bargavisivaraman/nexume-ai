"""Tests for detect_work_mode and detect_job_type in common.py."""

from aggregators.common import detect_job_type, detect_work_mode


def test_work_mode_remote_wins():
    assert detect_work_mode("Remote Software Engineer", "", "") == ("Remote", True)


def test_work_mode_hybrid():
    assert detect_work_mode("Software Engineer", "This is a hybrid role", "") == ("Hybrid", False)


def test_work_mode_defaults_onsite():
    assert detect_work_mode("Software Engineer", "", "New York, NY") == ("On-site", False)


def test_job_type_internship():
    assert detect_job_type("Software Engineer Intern", "") == "Internship"


def test_job_type_contract():
    assert detect_job_type("Contractor", "freelance engagement") == "Contract"


def test_job_type_part_time():
    assert detect_job_type("Barista", "part-time position") == "Part-time"


def test_job_type_full_time():
    assert detect_job_type("Engineer", "full-time role") == "Full-time"


def test_job_type_uses_default_when_unknown():
    assert detect_job_type("Engineer", "", default="Full-time") == "Full-time"
