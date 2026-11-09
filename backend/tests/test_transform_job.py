"""Tests for jobs.transform_job (JSearch raw result -> normalized row)."""

from jobs import transform_job


def _raw(**overrides):
    base = {
        "job_id": "abc123",
        "job_title": "Senior Backend Engineer",
        "employer_name": "Acme Inc",
        "job_city": "Austin",
        "job_state": "TX",
        "job_description": "Build APIs. This role is remote.",
        "job_apply_link": "https://www.linkedin.com/jobs/view/abc123",
        "job_employment_type": "FULLTIME",
        "job_is_remote": True,
    }
    base.update(overrides)
    return base


def test_transforms_a_complete_record():
    row = transform_job(_raw(), country="US")
    assert row is not None
    assert row["job_id"] == "abc123"
    assert row["title"] == "Senior Backend Engineer"
    assert row["company"] == "Acme Inc"
    assert row["location"] == "Austin, TX"
    assert row["is_remote"] is True
    assert row["work_mode"] == "Remote"
    assert row["industry"] == "Technology"
    assert row["experience_level"] == "Senior"
    assert row["source_name"] == "LinkedIn"
    assert row["country"] == "US"


def test_returns_none_when_required_fields_missing():
    assert transform_job(_raw(job_id=""), country="US") is None
    assert transform_job(_raw(job_title=""), country="US") is None
    assert transform_job(_raw(employer_name=""), country="US") is None


def test_remote_inferred_from_description_when_flag_absent():
    row = transform_job(_raw(job_is_remote=False,
                             job_description="Fully remote position"), country="US")
    assert row["is_remote"] is True
