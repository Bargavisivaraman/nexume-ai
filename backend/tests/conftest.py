"""Shared test fixtures for the backend test suite."""

from types import SimpleNamespace

import pytest


class FakeRequest:
    """Minimal stand-in for a Starlette/FastAPI Request.

    Only exposes the attributes the security helpers actually use:
    a ``headers`` mapping and a ``client`` with a ``host``.
    """

    def __init__(self, headers=None, client_host="203.0.113.7"):
        self.headers = headers or {}
        self.client = SimpleNamespace(host=client_host) if client_host else None


@pytest.fixture
def make_request():
    return FakeRequest
