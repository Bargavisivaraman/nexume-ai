"""Shared test fixtures for the backend test suite."""

import os
from types import SimpleNamespace

import pytest

# main.py builds the OpenAI/Supabase clients at import time from env vars.
# Provide harmless dummies so the module (and its pure scoring helpers) can be
# imported under test without real credentials. These build client objects only;
# no network call happens until a request is actually made.
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-key")
os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("GROQ_API_KEY", "")


SAMPLE_RESUME = """
Jane Doe
San Francisco, CA | jane.doe@example.com | +1 415 555 0199
linkedin.com/in/janedoe | github.com/janedoe

SUMMARY
Senior Software Engineer with six years of experience building scalable,
reliable backend systems and leading small teams to ship high-impact work.

EXPERIENCE
Senior Software Engineer, Acme Corp (2020 - 2024)
- Led the migration to Kubernetes, reducing deployment time by 40 percent
- Built a Python microservice handling 2M requests per day with 99.9% uptime
- Improved API latency by 35% by introducing a Redis caching layer
- Mentored 5 junior engineers and established code-review standards

Software Engineer, Beta Inc (2018 - 2020)
- Developed React frontend features that increased engagement by 20%
- Automated the CI pipeline, saving the team roughly 10 hours per week
- Designed a PostgreSQL schema that cut report generation time in half

EDUCATION
B.S. in Computer Science, State University (2018)

SKILLS
Python, JavaScript, React, AWS, Docker, Kubernetes, PostgreSQL, Redis, REST APIs
"""


@pytest.fixture
def sample_resume() -> str:
    return SAMPLE_RESUME


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


# ── Fake httpx client for the job-board fetchers ─────────────────────────────
# The fetch_* functions in main.py build their own httpx.AsyncClient internally,
# so we patch httpx.AsyncClient with a fake that returns canned responses.

class FakeResponse:
    def __init__(self, json_data, status_code=200):
        self._json = json_data
        self.status_code = status_code

    def json(self):
        return self._json

    def raise_for_status(self):
        if self.status_code >= 400:
            raise Exception(f"HTTP {self.status_code}")


class FakeAsyncClient:
    """Async-context-manager client whose get() returns queued responses."""

    def __init__(self, responses):
        self._responses = responses

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def get(self, *args, **kwargs):
        if isinstance(self._responses, list):
            return self._responses.pop(0) if self._responses else FakeResponse({}, 200)
        return self._responses


# ── LLM endpoint test helpers ────────────────────────────────────────────────
# The endpoints call the module-global main.openai_client; tests swap it for a
# fake returning a canned completion. Each test uses a unique client IP so the
# per-IP rate-limit buckets never bleed between tests.

class _FakeCompletionMessage:
    def __init__(self, content):
        self.content = content


class _FakeChoice:
    def __init__(self, content):
        self.message = _FakeCompletionMessage(content)


class _FakeCompletion:
    def __init__(self, content):
        self.choices = [_FakeChoice(content)]


class FakeOpenAI:
    """Stands in for main.openai_client. chat.completions.create returns the
    canned content; pass an Exception instance to raise it instead."""

    def __init__(self, content):
        self._content = content
        outer = self

        class _Completions:
            def create(self, **kwargs):
                if isinstance(outer._content, Exception):
                    raise outer._content
                return _FakeCompletion(outer._content)

        class _Chat:
            completions = _Completions()

        self.chat = _Chat()


@pytest.fixture
def fake_llm(monkeypatch):
    """fake_llm('{"a": 1}') patches main.openai_client with a canned reply."""
    import main

    def _patch(content):
        monkeypatch.setattr(main, "openai_client", FakeOpenAI(content))

    return _patch


_ip_counter = {"n": 0}


@pytest.fixture
def api_client():
    """A TestClient plus per-test-unique client IP headers, so the in-memory
    per-IP rate limiters never carry state across tests."""
    from fastapi.testclient import TestClient
    import main

    _ip_counter["n"] += 1
    n = _ip_counter["n"]
    headers = {"x-forwarded-for": f"10.99.{n // 256}.{n % 256}"}
    client = TestClient(main.app)
    client.headers.update(headers)
    return client


@pytest.fixture
def patch_httpx(monkeypatch):
    """Patch main.httpx.AsyncClient to serve the given JSON bodies.

    Pass one body for single-request fetchers, or several for paginated ones
    (they are returned in order). Use status= to simulate an HTTP error.
    """
    import main

    def _patch(*bodies, status=200):
        wrapped = [FakeResponse(b, status) for b in bodies]
        payload = wrapped[0] if len(wrapped) == 1 else wrapped
        monkeypatch.setattr(main.httpx, "AsyncClient", lambda *a, **k: FakeAsyncClient(payload))

    return _patch
