"""Tests for main.score_keyword_relevance."""

from main import score_keyword_relevance


def test_detail_shape_and_bounds(sample_resume):
    pts, detail = score_keyword_relevance(sample_resume.lower())
    assert detail["max"] == 30
    assert 0 <= pts <= 30
    assert {"domains_covered", "total_keywords_found", "per_domain"} <= detail.keys()


def test_keyword_rich_resume_scores_above_empty(sample_resume):
    assert score_keyword_relevance(sample_resume.lower())[0] > score_keyword_relevance("")[0]
