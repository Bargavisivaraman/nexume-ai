"""Tests for main.score_sections."""

from main import score_sections


def test_returns_total_and_breakdown(sample_resume):
    total, breakdown = score_sections(sample_resume.lower())
    assert isinstance(total, int)
    assert isinstance(breakdown, dict) and breakdown
    for entry in breakdown.values():
        assert {"found", "points", "max"} <= entry.keys()
        assert 0 <= entry["points"] <= entry["max"]
    # points across sections sum to the reported total
    assert sum(e["points"] for e in breakdown.values()) == total


def test_resume_with_sections_scores_above_empty(sample_resume):
    assert score_sections(sample_resume.lower())[0] > score_sections("")[0]
