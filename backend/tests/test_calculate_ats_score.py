"""Tests for main.calculate_ats_score and main.extract_weak_bullets."""

from main import calculate_ats_score, extract_weak_bullets


def test_score_shape_and_bounds(sample_resume):
    final, breakdown = calculate_ats_score(sample_resume)
    assert 1 <= final <= 97
    assert breakdown["final_score"] == final
    assert breakdown["max_possible"] == 135
    for key in ("sections", "quantification", "action_verbs", "keywords",
                "length_format", "contact_info"):
        assert key in breakdown


def test_strong_resume_scores_above_sparse_text(sample_resume):
    assert calculate_ats_score(sample_resume)[0] > calculate_ats_score("hello world")[0]


def test_poor_jd_match_applies_penalty(sample_resume):
    unrelated_jd = "Seeking a licensed veterinarian for equine dentistry and surgery."
    _, breakdown = calculate_ats_score(sample_resume, unrelated_jd)
    assert breakdown["jd_penalty"] > 0


def test_extract_weak_bullets_flags_weak_phrasing():
    text = (
        "- Responsible for maintaining the backend services and infrastructure\n"
        "- Built a Python service handling millions of requests every day\n"
    )
    weak = extract_weak_bullets(text)
    assert any("responsible for" in w.lower() for w in weak)
