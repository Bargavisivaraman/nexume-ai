"""Tests for aggregators.common.extract_tech_stack."""

from aggregators.common import extract_tech_stack


def test_returns_empty_for_no_description():
    assert extract_tech_stack("") == []
    assert extract_tech_stack(None) == []


def test_detects_and_labels_common_stack():
    result = extract_tech_stack("Built with Python, React, AWS, gRPC and a REST API.")
    assert "Python" in result
    assert "React" in result
    assert "AWS" in result
    assert "gRPC" in result
    assert "REST API" in result


def test_dotted_names_keep_correct_casing():
    result = extract_tech_stack("Frontend uses Node.js and Next.js.")
    assert "Node.js" in result
    assert "Next.js" in result
    # Regression: the old .title() path produced "Node.Js" / "Next.Js"
    assert "Node.Js" not in result
    assert "Next.Js" not in result


def test_synonyms_collapse_to_single_label():
    # "postgresql" contains "postgres"; both must collapse to one "PostgreSQL"
    result = extract_tech_stack("We run PostgreSQL in production.")
    assert result.count("PostgreSQL") == 1


def test_respects_limit():
    desc = "Python JavaScript TypeScript React Vue Angular AWS GCP Azure Docker"
    assert len(extract_tech_stack(desc, limit=3)) == 3
