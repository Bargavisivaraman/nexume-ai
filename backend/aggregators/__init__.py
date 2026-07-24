"""
Nexume ATS Aggregators
======================

Public-board adapters for popular Applicant Tracking Systems. Each adapter:
  - takes a company slug (org identifier on that ATS)
  - hits the ATS's public job-board endpoint (no auth required)
  - returns a list of jobs normalized to the canonical Job schema used in
    Supabase (matches jobs.py transform_job output)

These ATSes cover ~8,000 of the highest-quality companies (especially in tech).
Add a company to companies.py with the ATS type + their board slug and it
flows through the whole pipeline.

Public endpoints used:
  - Greenhouse:      https://boards-api.greenhouse.io/v1/boards/{slug}/jobs
  - Lever:           https://api.lever.co/v0/postings/{slug}
  - Ashby:           https://api.ashbyhq.com/posting-api/job-board/{slug}
  - Workable:        https://apply.workable.com/api/v3/accounts/{slug}/jobs

All adapters are async and tolerant of network errors (return [] on failure).
"""

from .greenhouse import fetch_greenhouse
from .lever import fetch_lever
from .ashby import fetch_ashby
from .workable import fetch_workable
from .companies import COMPANIES, AT_TYPES
from .pipeline import run_ats_ingestion

__all__ = [
    "fetch_greenhouse",
    "fetch_lever",
    "fetch_ashby",
    "fetch_workable",
    "COMPANIES",
    "AT_TYPES",
    "run_ats_ingestion",
]
