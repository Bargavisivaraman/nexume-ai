"""Pins the lifespan's scheduler contract: deferred first runs.

On the free tier a boot usually means a visitor just woke the instance, so
the first ingestion runs are deliberately pushed back (tier1 +3min,
tier2 +6min, tier3 +15min) to give their requests the quiet CPU. This test
guards those windows — an eager first run would resurrect the boot-time
event-loop crush.
"""

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

import main


def test_first_runs_are_deferred_and_serialized():
    with TestClient(main.app):
        now = datetime.now(timezone.utc)
        expectations = {
            "ats_tier1": timedelta(minutes=3),
            "ats_tier2": timedelta(minutes=6),
            "ats_tier3": timedelta(minutes=15),
        }
        for job_id, min_delay in expectations.items():
            job = main.scheduler.get_job(job_id)
            assert job is not None, f"{job_id} not scheduled"
            # Allow a little slack for test startup time
            assert job.next_run_time >= now + min_delay - timedelta(seconds=30), (
                f"{job_id} first run is too eager: {job.next_run_time}"
            )
            assert job.max_instances == 1  # never overlapping ingestions

    assert not main.scheduler.running  # lifespan shutdown stopped it
