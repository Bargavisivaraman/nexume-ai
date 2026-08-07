"""Tests for main.analyze_jd_match."""

from main import analyze_jd_match


def test_result_shape_and_bounds(sample_resume):
    jd = "Looking for a Python engineer with AWS, Docker, and Kubernetes experience."
    result = analyze_jd_match(sample_resume, jd)
    assert 0 <= result["match_pct"] <= 98
    assert result["verdict"] in {"Strong Match", "Moderate Match", "Weak Match"}
    assert result["verdict_color"] in {"green", "yellow", "red"}
    assert isinstance(result["missing_keywords"], list)


def test_matching_resume_scores_higher_than_unrelated(sample_resume):
    relevant_jd = "Python engineer with AWS, Docker, Kubernetes, PostgreSQL and Redis."
    unrelated_jd = "Seeking a licensed veterinarian for equine dentistry and surgery."
    assert (
        analyze_jd_match(sample_resume, relevant_jd)["match_pct"]
        > analyze_jd_match(sample_resume, unrelated_jd)["match_pct"]
    )
