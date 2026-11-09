"""Tests for aggregators.pipeline.dedupe_rows_by_job_id."""

from aggregators.pipeline import dedupe_rows_by_job_id


def test_empty_results():
    assert dedupe_rows_by_job_id([]) == ([], 0)


def test_dedupes_across_companies_by_job_id():
    company_a = {"name": "A"}
    company_b = {"name": "B"}
    results = [
        (company_a, [{"job_id": "1"}, {"job_id": "2"}]),
        (company_b, [{"job_id": "2"}, {"job_id": "3"}]),  # "2" is a duplicate
    ]
    rows, fetched = dedupe_rows_by_job_id(results)
    assert [r["job_id"] for r in rows] == ["1", "2", "3"]
    # fetched counts every fetched row, including the duplicate
    assert fetched == 4


def test_skips_rows_without_job_id():
    results = [({"name": "A"}, [{"job_id": None}, {"title": "no id"}, {"job_id": "9"}])]
    rows, fetched = dedupe_rows_by_job_id(results)
    assert [r["job_id"] for r in rows] == ["9"]
    assert fetched == 3


def test_ignores_companies_with_no_rows():
    results = [({"name": "A"}, []), ({"name": "B"}, [{"job_id": "1"}])]
    rows, fetched = dedupe_rows_by_job_id(results)
    assert [r["job_id"] for r in rows] == ["1"]
    assert fetched == 1
