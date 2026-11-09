"""Tests for security.get_client_ip."""

from security import get_client_ip


def test_uses_rightmost_x_forwarded_for(make_request):
    # The rightmost entry is the one OUR proxy appended; everything to its
    # left is client-supplied and spoofable.
    req = make_request(headers={"x-forwarded-for": "203.0.113.9, 10.0.0.1, 10.0.0.2"})
    assert get_client_ip(req) == "10.0.0.2"


def test_spoofed_leftmost_entries_cannot_rotate_the_ip(make_request):
    # An attacker prepending fake IPs must still resolve to the proxy-appended
    # real address — otherwise the per-IP rate limits are a no-op.
    real = "198.51.100.77"
    for fake in ("1.1.1.1", "2.2.2.2", "3.3.3.3"):
        req = make_request(headers={"x-forwarded-for": f"{fake}, {real}"})
        assert get_client_ip(req) == real


def test_single_entry_x_forwarded_for(make_request):
    req = make_request(headers={"x-forwarded-for": "203.0.113.9"})
    assert get_client_ip(req) == "203.0.113.9"


def test_falls_back_to_x_real_ip(make_request):
    req = make_request(headers={"x-real-ip": "198.51.100.4"})
    assert get_client_ip(req) == "198.51.100.4"


def test_falls_back_to_peer_address(make_request):
    req = make_request(headers={}, client_host="192.0.2.5")
    assert get_client_ip(req) == "192.0.2.5"


def test_unknown_when_no_client(make_request):
    req = make_request(headers={}, client_host=None)
    assert get_client_ip(req) == "unknown"
