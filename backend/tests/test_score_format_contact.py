"""Tests for main.score_length_and_format and main.score_contact_info."""

from main import score_contact_info, score_length_and_format


def test_length_and_format_shape_and_bounds(sample_resume):
    pts, detail = score_length_and_format(sample_resume)
    assert detail["max"] == 15
    assert 0 <= pts <= 15
    assert {"word_count", "bullet_count"} <= detail.keys()


def test_contact_info_detects_all_channels(sample_resume):
    pts, detail = score_contact_info(sample_resume)
    checks = detail["checks"]
    assert checks["email"] is True
    assert checks["phone"] is True
    assert checks["linkedin"] is True
    assert checks["github"] is True
    assert 0 < pts <= 10


def test_contact_info_empty_scores_zero():
    pts, _ = score_contact_info("no contact details here at all")
    assert pts == 0
