-- ─────────────────────────────────────────────────────────────────────────────
-- LandTheRole.ai — Supabase SQL Migration
-- Run this entire file in your Supabase project → SQL Editor → New Query
-- Safe to run multiple times (all statements are idempotent)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Add missing columns to existing jobs table ────────────────────────────
-- (These columns were referenced in code but never created in Supabase)

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS city              text,
  ADD COLUMN IF NOT EXISTS state             text,
  ADD COLUMN IF NOT EXISTS is_remote         boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS work_mode         text     DEFAULT 'On-site',
  ADD COLUMN IF NOT EXISTS industry          text     DEFAULT 'Other',
  ADD COLUMN IF NOT EXISTS experience_level  text     DEFAULT 'Mid Level',
  ADD COLUMN IF NOT EXISTS job_type          text,
  ADD COLUMN IF NOT EXISTS salary_min        numeric,
  ADD COLUMN IF NOT EXISTS salary_max        numeric,
  ADD COLUMN IF NOT EXISTS salary_currency   text     DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS salary_period     text,
  ADD COLUMN IF NOT EXISTS source_name       text     DEFAULT 'Job Board',
  ADD COLUMN IF NOT EXISTS hash_dedupe       text,
  ADD COLUMN IF NOT EXISTS is_active         boolean  DEFAULT true,
  -- ── ATS aggregator additions (Greenhouse / Lever / Ashby / Workable) ──────
  ADD COLUMN IF NOT EXISTS sector            text,
  ADD COLUMN IF NOT EXISTS is_internship     boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_new_grad       boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS tech_stack        jsonb;

-- ── 2. Back-fill defaults for any existing rows ───────────────────────────────
UPDATE jobs
SET
  is_active        = COALESCE(is_active, true),
  industry         = COALESCE(industry, 'Other'),
  experience_level = COALESCE(experience_level, 'Mid Level'),
  work_mode        = COALESCE(work_mode, 'On-site'),
  is_remote        = COALESCE(is_remote, false)
WHERE
  is_active IS NULL
  OR industry IS NULL
  OR experience_level IS NULL;

-- ── 3. Performance indexes ─────────────────────────────────────────────────────
-- Compound index used by every /jobs/ query
CREATE INDEX IF NOT EXISTS idx_jobs_country_active_fetched
  ON jobs (country, is_active, fetched_at DESC);

-- Filter indexes (used by individual filters)
CREATE INDEX IF NOT EXISTS idx_jobs_industry        ON jobs (industry);
CREATE INDEX IF NOT EXISTS idx_jobs_job_type        ON jobs (job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_experience_lvl  ON jobs (experience_level);
CREATE INDEX IF NOT EXISTS idx_jobs_is_remote       ON jobs (is_remote);
CREATE INDEX IF NOT EXISTS idx_jobs_work_mode       ON jobs (work_mode);
CREATE INDEX IF NOT EXISTS idx_jobs_state           ON jobs (state);
CREATE INDEX IF NOT EXISTS idx_jobs_posted_at       ON jobs (posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_hash_dedupe     ON jobs (hash_dedupe);

-- ATS aggregator indexes
CREATE INDEX IF NOT EXISTS idx_jobs_sector          ON jobs (sector);
CREATE INDEX IF NOT EXISTS idx_jobs_is_internship   ON jobs (is_internship) WHERE is_internship = true;
CREATE INDEX IF NOT EXISTS idx_jobs_is_new_grad     ON jobs (is_new_grad)   WHERE is_new_grad   = true;
CREATE INDEX IF NOT EXISTS idx_jobs_source_name     ON jobs (source_name);
CREATE INDEX IF NOT EXISTS idx_jobs_tech_stack      ON jobs USING GIN (tech_stack);

-- Title search (supports ilike pattern matching)
CREATE INDEX IF NOT EXISTS idx_jobs_title_lower
  ON jobs (lower(title) text_pattern_ops);

-- ── 4. Ingestion runs audit table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingestion_runs (
  id           uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id       text         NOT NULL,
  country      text         NOT NULL,
  queries_run  int          DEFAULT 0,
  fetched      int          DEFAULT 0,
  inserted     int          DEFAULT 0,
  skipped      int          DEFAULT 0,
  errors       int          DEFAULT 0,
  completed_at timestamptz,
  created_at   timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingestion_runs_created
  ON ingestion_runs (created_at DESC);

-- ── 4b. Pro waitlist ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waitlist (
  id           uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  email        text         NOT NULL UNIQUE,
  source       text         DEFAULT 'site',
  created_at   timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_created ON waitlist (created_at DESC);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access waitlist" ON waitlist;
CREATE POLICY "Service role full access waitlist"
  ON waitlist FOR ALL
  USING (auth.role() = 'service_role');

-- ── 5. Row-Level Security (allow public read of active jobs) ──────────────────
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Drop policy first so this script is safe to re-run
DROP POLICY IF EXISTS "Public read active jobs" ON jobs;
CREATE POLICY "Public read active jobs"
  ON jobs FOR SELECT
  USING (is_active = true);

-- Allow service role (backend) to insert/update/delete
DROP POLICY IF EXISTS "Service role full access" ON jobs;
CREATE POLICY "Service role full access"
  ON jobs FOR ALL
  USING (auth.role() = 'service_role');

-- Ingestion runs: service role only
ALTER TABLE ingestion_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ingestion" ON ingestion_runs;
CREATE POLICY "Service role full access ingestion"
  ON ingestion_runs FOR ALL
  USING (auth.role() = 'service_role');
