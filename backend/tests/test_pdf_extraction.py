"""Tests for PDF text extraction and the corrupt-PDF endpoint path."""

import io

import pytest
from PyPDF2 import PdfWriter

from main import extract_text_from_pdf


def test_blank_page_extracts_empty_text():
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    buf = io.BytesIO()
    writer.write(buf)

    assert extract_text_from_pdf(buf.getvalue()) == ""


def test_corrupt_bytes_raise():
    with pytest.raises(Exception):
        extract_text_from_pdf(b"%PDF-1.4 then absolute garbage with no xref")


def test_corrupt_pdf_maps_to_a_clean_500_at_the_endpoint(api_client):
    resp = api_client.post(
        "/analyze-resume/",
        files={"file": ("resume.pdf", b"%PDF-1.4 then absolute garbage", "application/pdf")},
    )
    assert resp.status_code == 500
    assert "failed to process" in resp.json()["detail"].lower()
