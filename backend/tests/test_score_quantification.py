"""Tests for main.score_quantification."""

from main import score_quantification


def test_bullets_with_metrics_score_higher_than_without():
    quantified = (
        "- Increased revenue by 40% in one year\n"
        "- Reduced latency by 250ms across all endpoints\n"
        "- Saved $1,200,000 through infrastructure optimization\n"
        "- Grew the user base by 3x over two quarters here\n"
    )
    vague = (
        "- Worked on various backend systems and features here\n"
        "- Helped the team with several ongoing projects here\n"
        "- Contributed to different parts of the codebase here\n"
        "- Participated in meetings and planning sessions here\n"
    )
    assert score_quantification(quantified)[0] > score_quantification(vague)[0]


def test_detail_shape_and_bounds():
    pts, detail = score_quantification("- Improved throughput by 30% this quarter here now\n")
    assert detail["max"] == 30
    assert 0 <= pts <= 30
    assert "metric_density_pct" in detail


def test_no_bullets_scores_zero():
    pts, detail = score_quantification("")
    assert pts == 0
