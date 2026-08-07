"""Tests for the in-memory resume-analysis cache helpers."""

import main
from main import _cache_get, _cache_key, _cache_set


def setup_function(_fn):
    main._analysis_cache.clear()


def test_cache_key_depends_on_file_and_jd():
    assert _cache_key(b"pdf", "jd") == _cache_key(b"pdf", "jd")
    assert _cache_key(b"pdf", "jd") != _cache_key(b"pdf", "other jd")
    assert _cache_key(b"pdf", "jd") != _cache_key(b"other", "jd")


def test_set_then_get_roundtrips():
    _cache_set("k", {"score": 1})
    assert _cache_get("k") == {"score": 1}


def test_entries_expire_after_the_ttl(monkeypatch):
    t = [1000.0]
    monkeypatch.setattr(main.time, "monotonic", lambda: t[0])

    _cache_set("k", {"score": 1})
    t[0] += main._CACHE_TTL + 1

    assert _cache_get("k") is None
    assert "k" not in main._analysis_cache  # expired entry is evicted


def test_cache_evicts_the_oldest_at_capacity(monkeypatch):
    t = [1000.0]
    monkeypatch.setattr(main.time, "monotonic", lambda: t[0])

    for i in range(500):
        _cache_set(f"k{i}", {"i": i})
        t[0] += 0.001

    _cache_set("overflow", {"i": 500})

    assert len(main._analysis_cache) == 500
    assert _cache_get("k0") is None          # oldest evicted
    assert _cache_get("overflow") == {"i": 500}
