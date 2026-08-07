"""Tests for main.score_action_verbs."""

from main import score_action_verbs


def test_detail_shape_and_bounds(sample_resume):
    pts, detail = score_action_verbs(sample_resume)
    assert detail["max"] == 20
    assert 0 <= pts <= 20
    assert {"strong_verb_lines", "weak_phrase_lines", "penalty_applied"} <= detail.keys()


def test_strong_verbs_counted(sample_resume):
    # The sample resume's bullets start with Led / Built / Improved / Developed ...
    _, detail = score_action_verbs(sample_resume)
    assert detail["strong_verb_lines"] > 0
