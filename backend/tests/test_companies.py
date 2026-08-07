"""Tests for the company registry and its query helpers."""

from aggregators.companies import (
    AT_TYPES,
    COMPANIES,
    list_companies_by_ats,
    list_companies_by_tier,
)

VALID_TIERS = {"tier1", "tier2", "tier3"}
REQUIRED_KEYS = {"name", "ats", "slug", "industry", "tier"}


def test_registry_is_non_empty():
    assert len(COMPANIES) > 0


def test_every_entry_has_required_keys():
    for c in COMPANIES:
        assert REQUIRED_KEYS.issubset(c.keys()), f"missing keys in {c}"


def test_every_entry_has_a_known_ats():
    for c in COMPANIES:
        assert c["ats"] in AT_TYPES, f"unknown ats in {c}"


def test_every_entry_has_a_valid_tier():
    for c in COMPANIES:
        assert c["tier"] in VALID_TIERS, f"invalid tier in {c}"


def test_slugs_are_unique_per_ats():
    seen = set()
    for c in COMPANIES:
        key = (c["ats"], c["slug"])
        assert key not in seen, f"duplicate slug for {key}"
        seen.add(key)


def test_list_companies_by_ats_filters():
    for company in list_companies_by_ats("greenhouse"):
        assert company["ats"] == "greenhouse"


def test_list_companies_by_tier_filters():
    for company in list_companies_by_tier("tier1"):
        assert company["tier"] == "tier1"
