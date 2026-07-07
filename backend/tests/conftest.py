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
