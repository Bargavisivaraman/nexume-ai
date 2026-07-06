"""
Registry of companies whose public ATS boards we ingest.

Format per entry:
  {
    "name":       "Stripe",          # display name (what users see)
    "ats":        "greenhouse",      # one of: greenhouse | lever | ashby | workable
    "slug":       "stripe",          # the org slug on that ATS
    "industry":   "Technology",      # high-level (matches jobs.py INDUSTRY_MAP keys)
    "tier":       "tier1",           # tier1 = run hourly, tier2 = daily, tier3 = weekly
  }

To add a company:
  1. Find their ATS (often listed at bottom of their careers page or in the URL)
  2. Add an entry below
  3. The next ingestion run will pull their jobs automatically

Public ATS URL patterns to find slugs:
  greenhouse:  job-boards.greenhouse.io/<slug>/   or   boards.greenhouse.io/<slug>
  lever:       jobs.lever.co/<slug>
  ashby:       jobs.ashbyhq.com/<slug>
  workable:    apply.workable.com/<slug>
"""

AT_TYPES = ("greenhouse", "lever", "ashby", "workable")

# ── Starter registry: ~150 well-known companies across sectors ───────────────
COMPANIES: list[dict] = [
    # ── Tier 1: Major tech (highest user demand) ─────────────────────────────
    {"name": "Stripe",         "ats": "greenhouse", "slug": "stripe",         "industry": "Technology", "tier": "tier1"},
    {"name": "Airbnb",         "ats": "greenhouse", "slug": "airbnb",         "industry": "Technology", "tier": "tier1"},
    {"name": "Coinbase",       "ats": "greenhouse", "slug": "coinbase",       "industry": "Technology", "tier": "tier1"},
    {"name": "Discord",        "ats": "greenhouse", "slug": "discord",        "industry": "Technology", "tier": "tier1"},
    {"name": "Notion",         "ats": "greenhouse", "slug": "notion",         "industry": "Technology", "tier": "tier1"},
    {"name": "Figma",          "ats": "ashby",      "slug": "figma",          "industry": "Technology", "tier": "tier1"},
    {"name": "OpenAI",         "ats": "greenhouse", "slug": "openai",         "industry": "Technology", "tier": "tier1"},
    {"name": "Anthropic",      "ats": "greenhouse", "slug": "anthropic",      "industry": "Technology", "tier": "tier1"},
    {"name": "Vercel",         "ats": "greenhouse", "slug": "vercel",         "industry": "Technology", "tier": "tier1"},
    {"name": "Linear",         "ats": "ashby",      "slug": "linear",         "industry": "Technology", "tier": "tier1"},
    {"name": "Brex",           "ats": "greenhouse", "slug": "brex",           "industry": "Finance",    "tier": "tier1"},
    {"name": "Ramp",           "ats": "greenhouse", "slug": "ramp",           "industry": "Finance",    "tier": "tier1"},
    {"name": "Mercury",        "ats": "greenhouse", "slug": "mercury",        "industry": "Finance",    "tier": "tier1"},
    {"name": "Plaid",          "ats": "greenhouse", "slug": "plaid",          "industry": "Finance",    "tier": "tier1"},
    {"name": "Robinhood",      "ats": "greenhouse", "slug": "robinhood",      "industry": "Finance",    "tier": "tier1"},
    {"name": "Asana",          "ats": "lever",      "slug": "asana",          "industry": "Technology", "tier": "tier1"},
    {"name": "GitHub",         "ats": "greenhouse", "slug": "github",         "industry": "Technology", "tier": "tier1"},
    {"name": "Cloudflare",     "ats": "greenhouse", "slug": "cloudflare",     "industry": "Technology", "tier": "tier1"},
    {"name": "Snowflake",      "ats": "greenhouse", "slug": "snowflake",      "industry": "Technology", "tier": "tier1"},
    {"name": "Databricks",     "ats": "greenhouse", "slug": "databricks",     "industry": "Technology", "tier": "tier1"},

    # ── Developer tools / Infra ──────────────────────────────────────────────
    {"name": "PostHog",        "ats": "ashby",      "slug": "posthog",        "industry": "Technology", "tier": "tier2"},
    {"name": "Supabase",       "ats": "ashby",      "slug": "supabase",       "industry": "Technology", "tier": "tier2"},
    {"name": "Replit",         "ats": "ashby",      "slug": "replit",         "industry": "Technology", "tier": "tier2"},
    {"name": "MongoDB",        "ats": "greenhouse", "slug": "mongodb",        "industry": "Technology", "tier": "tier2"},
    {"name": "Datadog",        "ats": "greenhouse", "slug": "datadog",        "industry": "Technology", "tier": "tier2"},
    {"name": "HashiCorp",      "ats": "greenhouse", "slug": "hashicorp",      "industry": "Technology", "tier": "tier2"},
    {"name": "Elastic",        "ats": "greenhouse", "slug": "elastic",        "industry": "Technology", "tier": "tier2"},
    {"name": "Confluent",      "ats": "greenhouse", "slug": "confluent",      "industry": "Technology", "tier": "tier2"},
    {"name": "Modal Labs",     "ats": "ashby",      "slug": "modal",          "industry": "Technology", "tier": "tier2"},
    {"name": "Pinecone",       "ats": "ashby",      "slug": "pinecone",       "industry": "Technology", "tier": "tier2"},

    # ── Consumer / Social ────────────────────────────────────────────────────
    {"name": "Pinterest",      "ats": "greenhouse", "slug": "pinterest",      "industry": "Technology", "tier": "tier2"},
    {"name": "Reddit",         "ats": "greenhouse", "slug": "reddit",         "industry": "Technology", "tier": "tier2"},
    {"name": "DoorDash",       "ats": "greenhouse", "slug": "doordash",       "industry": "Technology", "tier": "tier1"},
    {"name": "Instacart",      "ats": "greenhouse", "slug": "instacart",      "industry": "Technology", "tier": "tier2"},
    {"name": "Lyft",           "ats": "lever",      "slug": "lyft",           "industry": "Technology", "tier": "tier1"},
    {"name": "Eventbrite",     "ats": "lever",      "slug": "eventbrite",     "industry": "Technology", "tier": "tier2"},
    {"name": "Spotify",        "ats": "lever",      "slug": "spotify",        "industry": "Technology", "tier": "tier1"},
    {"name": "Roblox",         "ats": "greenhouse", "slug": "roblox",         "industry": "Technology", "tier": "tier2"},
    {"name": "Riot Games",     "ats": "greenhouse", "slug": "riotgames",      "industry": "Technology", "tier": "tier2"},

    # ── Enterprise SaaS ──────────────────────────────────────────────────────
    {"name": "Atlassian",      "ats": "greenhouse", "slug": "atlassian",      "industry": "Technology", "tier": "tier1"},
    {"name": "Twilio",         "ats": "greenhouse", "slug": "twilio",         "industry": "Technology", "tier": "tier2"},
    {"name": "Zendesk",        "ats": "greenhouse", "slug": "zendesk",        "industry": "Technology", "tier": "tier2"},
    {"name": "Box",            "ats": "greenhouse", "slug": "box",            "industry": "Technology", "tier": "tier2"},
    {"name": "Dropbox",        "ats": "greenhouse", "slug": "dropbox",        "industry": "Technology", "tier": "tier2"},
    {"name": "Okta",           "ats": "greenhouse", "slug": "okta",           "industry": "Technology", "tier": "tier2"},
    {"name": "Segment",        "ats": "greenhouse", "slug": "segment",        "industry": "Technology", "tier": "tier2"},
    {"name": "Squarespace",    "ats": "greenhouse", "slug": "squarespace",    "industry": "Technology", "tier": "tier2"},
    {"name": "Pendo",          "ats": "greenhouse", "slug": "pendo",          "industry": "Technology", "tier": "tier3"},
    {"name": "Calendly",       "ats": "greenhouse", "slug": "calendly",       "industry": "Technology", "tier": "tier3"},

    # ── Crypto / Web3 ────────────────────────────────────────────────────────
    {"name": "Kraken",         "ats": "greenhouse", "slug": "kraken",         "industry": "Finance",    "tier": "tier2"},
    {"name": "Gemini",         "ats": "greenhouse", "slug": "gemini",         "industry": "Finance",    "tier": "tier3"},
    {"name": "Polygon Labs",   "ats": "ashby",      "slug": "polygon",        "industry": "Technology", "tier": "tier3"},

    # ── Healthcare / Bio ─────────────────────────────────────────────────────
    {"name": "Oscar Health",   "ats": "greenhouse", "slug": "oscar",          "industry": "Healthcare", "tier": "tier2"},
    {"name": "Hims & Hers",    "ats": "greenhouse", "slug": "himsandhers",    "industry": "Healthcare", "tier": "tier3"},
    {"name": "23andMe",        "ats": "greenhouse", "slug": "23andme",        "industry": "Research & Science", "tier": "tier3"},
    {"name": "Recursion",      "ats": "greenhouse", "slug": "recursion",      "industry": "Research & Science", "tier": "tier3"},
    {"name": "Moderna",        "ats": "workable",   "slug": "moderna",        "industry": "Healthcare", "tier": "tier3"},

    # ── Logistics / Marketplaces ─────────────────────────────────────────────
    {"name": "Faire",          "ats": "greenhouse", "slug": "faire",          "industry": "Retail & Hospitality", "tier": "tier2"},
    {"name": "Shipbob",        "ats": "lever",      "slug": "shipbob",        "industry": "Supply Chain", "tier": "tier3"},
    {"name": "Flexport",       "ats": "greenhouse", "slug": "flexport",       "industry": "Supply Chain", "tier": "tier2"},

    # ── Cybersecurity ────────────────────────────────────────────────────────
    {"name": "1Password",      "ats": "greenhouse", "slug": "1password",      "industry": "Technology", "tier": "tier2"},
    {"name": "Snyk",           "ats": "greenhouse", "slug": "snyk",           "industry": "Technology", "tier": "tier2"},

    # ── Climate / Energy ─────────────────────────────────────────────────────
    {"name": "Tesla",          "ats": "workable",   "slug": "tesla",          "industry": "Engineering", "tier": "tier1"},
    {"name": "Rivian",         "ats": "workable",   "slug": "rivian",         "industry": "Engineering", "tier": "tier2"},
    {"name": "Lucid Motors",   "ats": "workable",   "slug": "lucidmotors",    "industry": "Engineering", "tier": "tier3"},
    {"name": "Watershed",      "ats": "ashby",      "slug": "watershed",      "industry": "Technology", "tier": "tier3"},

    # ── Finance: traditional ─────────────────────────────────────────────────
    {"name": "Affirm",         "ats": "lever",      "slug": "affirm",         "industry": "Finance",    "tier": "tier2"},
    {"name": "Chime",          "ats": "greenhouse", "slug": "chime",          "industry": "Finance",    "tier": "tier2"},
    {"name": "Carta",          "ats": "greenhouse", "slug": "carta",          "industry": "Finance",    "tier": "tier2"},
    {"name": "Bill.com",       "ats": "greenhouse", "slug": "billcom",        "industry": "Finance",    "tier": "tier3"},
    {"name": "Wealthfront",    "ats": "greenhouse", "slug": "wealthfront",    "industry": "Finance",    "tier": "tier3"},

    # ── Media / Design ───────────────────────────────────────────────────────
    {"name": "Canva",          "ats": "greenhouse", "slug": "canva",          "industry": "Design & Creative", "tier": "tier1"},
    {"name": "Webflow",        "ats": "greenhouse", "slug": "webflow",        "industry": "Design & Creative", "tier": "tier2"},

    # ── Education / EdTech ───────────────────────────────────────────────────
    {"name": "Duolingo",       "ats": "greenhouse", "slug": "duolingo",       "industry": "Education",  "tier": "tier2"},
    {"name": "Coursera",       "ats": "greenhouse", "slug": "coursera",       "industry": "Education",  "tier": "tier2"},
    {"name": "Khan Academy",   "ats": "lever",      "slug": "khanacademy",    "industry": "Education",  "tier": "tier3"},

    # ── Marketing / Adtech ───────────────────────────────────────────────────
    {"name": "HubSpot",        "ats": "greenhouse", "slug": "hubspot",        "industry": "Marketing",  "tier": "tier2"},
    {"name": "Klaviyo",        "ats": "greenhouse", "slug": "klaviyo",        "industry": "Marketing",  "tier": "tier3"},
    {"name": "Iterable",       "ats": "lever",      "slug": "iterable",       "industry": "Marketing",  "tier": "tier3"},

    # ── Productivity / Workflow ──────────────────────────────────────────────
    {"name": "Loom",           "ats": "greenhouse", "slug": "loom",           "industry": "Technology", "tier": "tier3"},
    {"name": "Miro",           "ats": "greenhouse", "slug": "miro",           "industry": "Technology", "tier": "tier2"},
    {"name": "ClickUp",        "ats": "lever",      "slug": "clickup",        "industry": "Technology", "tier": "tier3"},

    # ── AI / ML startups ─────────────────────────────────────────────────────
    {"name": "Hugging Face",   "ats": "ashby",      "slug": "huggingface",    "industry": "Technology", "tier": "tier1"},
    {"name": "Scale AI",       "ats": "greenhouse", "slug": "scaleai",        "industry": "Technology", "tier": "tier1"},
    {"name": "Cohere",         "ats": "ashby",      "slug": "cohere",         "industry": "Technology", "tier": "tier2"},
    {"name": "Perplexity",     "ats": "ashby",      "slug": "perplexity",     "industry": "Technology", "tier": "tier2"},
    {"name": "Mistral",        "ats": "ashby",      "slug": "mistral",        "industry": "Technology", "tier": "tier3"},
    {"name": "Together AI",    "ats": "ashby",      "slug": "togetherai",     "industry": "Technology", "tier": "tier3"},
    {"name": "ElevenLabs",     "ats": "ashby",      "slug": "elevenlabs",     "industry": "Technology", "tier": "tier3"},
    {"name": "Runway",         "ats": "ashby",      "slug": "runway",         "industry": "Design & Creative", "tier": "tier3"},

    # ── Hardware ─────────────────────────────────────────────────────────────
    {"name": "Anduril",        "ats": "greenhouse", "slug": "anduril",        "industry": "Engineering", "tier": "tier2"},
    {"name": "SpaceX",         "ats": "workable",   "slug": "spacex",         "industry": "Engineering", "tier": "tier1"},
]


def list_companies_by_ats(ats_type: str) -> list[dict]:
    return [c for c in COMPANIES if c["ats"] == ats_type]


def list_companies_by_tier(tier: str) -> list[dict]:
    return [c for c in COMPANIES if c.get("tier") == tier]
