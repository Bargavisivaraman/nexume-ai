"""Tests for security._admin_token and security.require_admin."""

import asyncio
import hashlib

import pytest
from fastapi import HTTPException

from security import _admin_token, require_admin


def test_admin_token_prefers_explicit_env(monkeypatch):
    monkeypatch.setenv("NEXUME_ADMIN_TOKEN", "explicit-token")
    monkeypatch.setenv("SUPABASE_KEY", "some-supabase-key")
    assert _admin_token() == "explicit-token"


def test_admin_token_derived_from_supabase_key(monkeypatch):
    monkeypatch.delenv("NEXUME_ADMIN_TOKEN", raising=False)
    monkeypatch.setenv("SUPABASE_KEY", "some-supabase-key")
    expected = hashlib.sha256(b"nexume-admin-v1:some-supabase-key").hexdigest()
    assert _admin_token() == expected


def test_admin_token_empty_when_unconfigured(monkeypatch):
    monkeypatch.delenv("NEXUME_ADMIN_TOKEN", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)
    assert _admin_token() == ""


def test_require_admin_rejects_when_unconfigured(monkeypatch, make_request):
    monkeypatch.delenv("NEXUME_ADMIN_TOKEN", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(require_admin(make_request(headers={})))
    assert exc.value.status_code == 404


def test_require_admin_accepts_correct_token(monkeypatch, make_request):
    monkeypatch.setenv("NEXUME_ADMIN_TOKEN", "secret-token")
    req = make_request(headers={"x-admin-token": "secret-token"})
    # Should not raise.
    asyncio.run(require_admin(req))


def test_require_admin_rejects_wrong_token(monkeypatch, make_request):
    monkeypatch.setenv("NEXUME_ADMIN_TOKEN", "secret-token")
    req = make_request(headers={"x-admin-token": "wrong-token"})
    with pytest.raises(HTTPException) as exc:
        asyncio.run(require_admin(req))
    assert exc.value.status_code == 404
