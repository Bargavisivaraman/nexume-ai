"""Tests for POST /analyze-resume/ — the flagship upload pipeline.

PDF text extraction is monkeypatched where a text-bearing PDF would be
needed (crafting one requires a layout engine); the upload guards use
real bytes, and a real blank PDF exercises the empty-extract path.
"""

import io
import json

from PyPDF2 import PdfWriter

import main
from tests.conftest import SAMPLE_RESUME

# SAMPLE_RESUME is ~150 words — below is_valid_resume's 200-word gate — so pad
# it with realistic filler to represent a full-length resume.
LONG_RESUME = SAMPLE_RESUME + "\nLed further initiatives across platform reliability and developer tooling. " * 12

CANNED = json.dumps({
    "summary_feedback": "Solid resume with a strong ATS score.",
    "strengths": ["Quantified impact"],
    "weaknesses": ["Missing certifications"],
    "missing_skills": ["Terraform"],
    "recommendations": ["Add a cloud certification"],
})


def _pdf_upload(content=b"%PDF-1.4 fake body", name="resume.pdf", mime="application/pdf"):
    return {"file": (name, content, mime)}


def _blank_pdf_bytes():
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def setup_function(_fn):
    main._analysis_cache.clear()


def test_rejects_non_pdf_content_type(api_client):
    resp = api_client.post("/analyze-resume/", files=_pdf_upload(mime="text/plain"))
    assert resp.status_code == 400
    assert "pdf" in resp.json()["detail"].lower()


def test_rejects_spoofed_magic_bytes(api_client):
    resp = api_client.post("/analyze-resume/", files=_pdf_upload(content=b"PK\x03\x04 zip bytes"))
    assert resp.status_code == 400
    assert "magic bytes" in resp.json()["detail"].lower()


def test_rejects_oversized_files(api_client):
    big = b"%PDF-" + b"0" * (5 * 1024 * 1024 + 1)
    resp = api_client.post("/analyze-resume/", files=_pdf_upload(content=big))
    assert resp.status_code == 413


def test_blank_pdf_fails_with_could_not_extract(api_client):
    resp = api_client.post("/analyze-resume/", files=_pdf_upload(content=_blank_pdf_bytes()))
    assert resp.status_code == 400
    assert "could not extract" in resp.json()["detail"].lower()


def test_full_pipeline_merges_scoring_and_llm_feedback(api_client, fake_llm, monkeypatch):
    fake_llm(CANNED)
    monkeypatch.setattr(main, "extract_text_from_pdf", lambda contents: LONG_RESUME)

    resp = api_client.post(
        "/analyze-resume/",
        files=_pdf_upload(),
        data={"job_description": "Python engineer with AWS and Kubernetes experience."},
    )

    assert resp.status_code == 200
    body = resp.json()
    # Local scoring merged in
    assert body["ats_score"] > 0
    assert "quantification" in body["ats_breakdown"]
    assert body["jd_match"] is not None
    # LLM feedback merged in
    assert body["summary_feedback"].startswith("Solid resume")
    assert body["missing_skills"] == ["Terraform"]


def test_non_resume_text_returns_the_canned_zero_payload(api_client, fake_llm, monkeypatch):
    fake = fake_llm(CANNED)
    monkeypatch.setattr(main, "extract_text_from_pdf", lambda contents: "just a grocery list")

    resp = api_client.post("/analyze-resume/", files=_pdf_upload())

    assert resp.status_code == 200
    body = resp.json()
    assert body["ats_score"] == 0
    assert "does not appear to be a valid" in body["summary_feedback"]
    assert fake.calls == 0  # no OpenAI spend on invalid uploads


def test_identical_upload_is_served_from_cache(api_client, fake_llm, monkeypatch):
    fake = fake_llm(CANNED)
    monkeypatch.setattr(main, "extract_text_from_pdf", lambda contents: LONG_RESUME)

    first = api_client.post("/analyze-resume/", files=_pdf_upload())
    second = api_client.post("/analyze-resume/", files=_pdf_upload())

    assert first.status_code == second.status_code == 200
    assert second.json() == first.json()
    assert fake.calls == 1  # the second hit never reached OpenAI
