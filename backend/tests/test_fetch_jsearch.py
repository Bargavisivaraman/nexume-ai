"""Tests for jobs.fetch_jsearch — the client is passed in, so no patching."""

import asyncio

from jobs import fetch_jsearch
from tests.conftest import FakeAsyncClient, FakeResponse


def _run(coro):
    return asyncio.run(coro)


def test_returns_the_data_list_on_success():
    client = FakeAsyncClient(FakeResponse({"data": [{"job_id": "1"}, {"job_id": "2"}]}))
    rows = _run(fetch_jsearch(client, "key", "python developer"))
    assert [r["job_id"] for r in rows] == ["1", "2"]


def test_returns_empty_on_unexpected_shape():
    client = FakeAsyncClient(FakeResponse({"data": {"not": "a list"}}))
    assert _run(fetch_jsearch(client, "key", "python")) == []


def test_returns_empty_on_http_error():
    client = FakeAsyncClient(FakeResponse({}, status_code=429))
    assert _run(fetch_jsearch(client, "key", "python")) == []


def test_returns_empty_when_the_request_raises():
    class _Boom:
        async def get(self, *a, **k):
            raise RuntimeError("network down")

    assert _run(fetch_jsearch(_Boom(), "key", "python")) == []
