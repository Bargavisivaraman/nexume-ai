"""Tests for security.validate_pdf_bytes — magic-byte and size validation."""

import pytest
from fastapi import HTTPException

from security import MAX_PDF_BYTES, PDF_MAGIC, validate_pdf_bytes


def test_accepts_valid_pdf_bytes():
    # Should not raise for data starting with the PDF magic bytes.
    validate_pdf_bytes(PDF_MAGIC + b"1.4 rest of the document")


def test_rejects_empty_file():
    with pytest.raises(HTTPException) as exc:
        validate_pdf_bytes(b"")
    assert exc.value.status_code == 400


def test_rejects_oversized_file():
    too_big = PDF_MAGIC + b"0" * (MAX_PDF_BYTES + 1)
    with pytest.raises(HTTPException) as exc:
        validate_pdf_bytes(too_big)
    assert exc.value.status_code == 413


def test_rejects_wrong_magic_bytes():
    with pytest.raises(HTTPException) as exc:
        validate_pdf_bytes(b"PK\x03\x04 this is a zip, not a pdf")
    assert exc.value.status_code == 400
