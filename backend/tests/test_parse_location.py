"""Tests for the shared ATS location parser.

Regression for the bug where every ATS row was hardcoded country="US", so the
US job feed served Spotify's London/Stockholm/Toronto postings.
"""

import asyncio

import httpx
import pytest

from aggregators.common import parse_location
from aggregators.greenhouse import fetch_greenhouse
from aggregators.lever import fetch_lever


@pytest.mark.parametrize(
    "loc, expected",
    [
        # US — state codes and names
        ("New York, NY", ("New York", "NY", "US")),
        ("Los Angeles, CA", ("Los Angeles", "CA", "US")),
        ("Austin, Texas", ("Austin", "TX", "US")),
        ("Washington, DC", ("Washington", "DC", "US")),
        ("Hybrid - Chicago, IL", ("Chicago", "IL", "US")),
        ("San Francisco, CA or Remote", ("San Francisco", "CA", "US")),
        ("Boston, MA, United States", ("Boston", "MA", "US")),
        ("Remote, California", (None, "CA", "US")),
        # Remote placeholders keep the default country and no fake city
        ("Remote", (None, None, "US")),
        ("Remote (US)", (None, None, "US")),
        ("US - Remote", (None, None, "US")),
        ("Remote - Germany", (None, None, "DE")),
        # Bare non-US cities — the actual production failures
        ("London", ("London", None, "GB")),
        ("Toronto", ("Toronto", None, "CA")),
        ("Stockholm", ("Stockholm", None, "SE")),
        ("Seoul", ("Seoul", None, "KR")),
        ("Jakarta", ("Jakarta", None, "ID")),
        ("Brussels", ("Brussels", None, "BE")),
        ("Singapore", (None, None, "SG")),
        ("Taiwan", (None, None, "TW")),
        # Explicit countries
        ("London, UK", ("London", None, "GB")),
        ("Toronto, Ontario, Canada", ("Toronto", "Ontario", "CA")),
        ("Bangalore, India", ("Bangalore", None, "IN")),
        ("Berlin, Germany", ("Berlin", None, "DE")),
        ("United Kingdom", (None, None, "GB")),
        # Unknown → default, city preserved for the location filter
        ("Portland", ("Portland", None, "US")),
        ("Springfield", ("Springfield", None, "US")),
        ("", (None, None, "US")),
        (None, (None, None, "US")),
    ],
)
def test_parse_location(loc, expected):
    assert parse_location(loc) == expected


def test_parse_location_respects_default_country():
    assert parse_location("Remote", "CA") == (None, None, "CA")
    # but explicit evidence still wins over the default
    assert parse_location("Austin, TX", "CA")[2] == "US"


def test_austin_is_not_mistaken_for_a_us_alias():
    # "us" appears inside "Austin" — must not short-circuit country detection
    assert parse_location("Austin")[2] == "US"
    assert parse_location("Brussels")[2] == "BE"


def _client(payload):
    return httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(200, json=payload)))


def test_greenhouse_tags_foreign_offices_with_their_country():
    sample = {"jobs": [
        {"id": 1, "title": "Engineer", "location": {"name": "London"}, "content": "", "absolute_url": "u"},
        {"id": 2, "title": "Engineer", "location": {"name": "New York, NY"}, "content": "", "absolute_url": "u"},
        {"id": 3, "title": "Engineer", "location": {"name": "Remote"}, "content": "", "absolute_url": "u"},
    ]}
    rows = asyncio.run(fetch_greenhouse(_client(sample), "acme", "Acme"))
    by_id = {r["job_id"]: r for r in rows}
    assert by_id["gh_acme_1"]["country"] == "GB"
    assert by_id["gh_acme_2"]["country"] == "US"
    assert by_id["gh_acme_2"]["city"] == "New York"
    assert by_id["gh_acme_2"]["state"] == "NY"
    assert by_id["gh_acme_3"]["country"] == "US"
    assert by_id["gh_acme_3"]["city"] is None


def test_lever_prefers_its_structured_country_field():
    sample = [
        {"id": "a", "text": "Engineer", "categories": {"location": "Remote"}, "country": "CA",
         "descriptionPlain": "", "hostedUrl": "u"},
        {"id": "b", "text": "Engineer", "categories": {"location": "Stockholm"},
         "descriptionPlain": "", "hostedUrl": "u"},
    ]
    rows = asyncio.run(fetch_lever(_client(sample), "spotify", "Spotify"))
    by_id = {r["job_id"]: r for r in rows}
    assert by_id["lever_spotify_a"]["country"] == "CA"   # API field wins over "Remote"
    assert by_id["lever_spotify_b"]["country"] == "SE"   # parsed from the city
