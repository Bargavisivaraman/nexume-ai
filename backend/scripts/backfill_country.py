"""
One-off backfill: re-derive `country` for existing jobs rows from their stored
location string using aggregators.common.parse_location.

Background: until Aug 2026 every ATS adapter hardcoded country="US", so the
US feed contained London/Toronto/Stockholm postings. New ingestion runs are
fixed; this script repairs rows already in the table.

Usage (from backend/, with .env present):
    python scripts/backfill_country.py            # dry run — prints what would change
    python scripts/backfill_country.py --apply    # write the changes
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv  # noqa: E402
from supabase import create_client  # noqa: E402

from aggregators.common import parse_location  # noqa: E402

PAGE = 1000
UPDATE_BATCH = 300


def main() -> None:
    apply = "--apply" in sys.argv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY")
    if not url or not key:
        sys.exit("SUPABASE_URL / SUPABASE_KEY missing")
    sb = create_client(url, key)

    # Only ATS-sourced rows were mis-tagged (live APIs carry a real country).
    changes: dict[str, list[str]] = {}
    scanned = 0
    offset = 0
    while True:
        res = (
            sb.table("jobs")
            .select("job_id,location,country")
            .eq("country", "US")
            .in_("source_name", ["Greenhouse", "Lever", "Ashby"])
            .order("job_id")
            .range(offset, offset + PAGE - 1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            break
        for r in rows:
            scanned += 1
            _, _, new_country = parse_location(r.get("location"), "US")
            if new_country != r["country"]:
                changes.setdefault(new_country, []).append(r["job_id"])
        offset += PAGE
        if len(rows) < PAGE:
            break

    total = sum(len(v) for v in changes.values())
    print(f"scanned {scanned} US-tagged ATS rows; {total} would move out of US")
    for country, ids in sorted(changes.items(), key=lambda kv: -len(kv[1])):
        print(f"  {country}: {len(ids)}")

    if not apply:
        print("\ndry run — re-run with --apply to write")
        return

    written = 0
    for country, ids in changes.items():
        for i in range(0, len(ids), UPDATE_BATCH):
            batch = ids[i : i + UPDATE_BATCH]
            sb.table("jobs").update({"country": country}).in_("job_id", batch).execute()
            written += len(batch)
            print(f"  {country}: {written}/{total} updated", end="\r")
    print(f"\ndone — {written} rows updated (server /jobs/stats cache refreshes within 30s)")


if __name__ == "__main__":
    main()
