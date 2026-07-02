"""Tests for security.RateLimiter."""

import pytest
from fastapi import HTTPException

import security
from security import RateLimiter


def test_allows_requests_up_to_the_limit(make_request):
    limiter = RateLimiter(requests_per_window=3, window_seconds=60)
    req = make_request(headers={"x-forwarded-for": "203.0.113.1"})
    for _ in range(3):
        limiter.check(req)  # should not raise


def test_blocks_requests_over_the_limit(make_request):
    limiter = RateLimiter(requests_per_window=2, window_seconds=60)
    req = make_request(headers={"x-forwarded-for": "203.0.113.2"})
    limiter.check(req)
    limiter.check(req)
    with pytest.raises(HTTPException) as exc:
        limiter.check(req)
    assert exc.value.status_code == 429
    assert "Retry-After" in exc.value.headers


def test_separate_ips_are_tracked_independently(make_request):
    limiter = RateLimiter(requests_per_window=1, window_seconds=60)
    limiter.check(make_request(headers={"x-forwarded-for": "203.0.113.3"}))
    # A different IP has its own bucket and should not be blocked.
    limiter.check(make_request(headers={"x-forwarded-for": "203.0.113.4"}))


def test_window_expiry_frees_capacity(make_request, monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr(security.time, "time", lambda: clock[0])

    limiter = RateLimiter(requests_per_window=1, window_seconds=60)
    req = make_request(headers={"x-forwarded-for": "203.0.113.5"})
    limiter.check(req)

    clock[0] += 61  # advance past the window
    limiter.check(req)  # the earlier hit has expired, so this is allowed
