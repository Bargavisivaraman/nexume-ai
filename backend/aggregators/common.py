"""Shared helpers for ATS adapters."""

import hashlib
import re
from datetime import datetime, timezone
from typing import Optional


# ── seniority / type detection ───────────────────────────────────────────────
INTERNSHIP_RE = re.compile(r"\b(intern|internship|co[- ]?op)\b", re.IGNORECASE)
NEW_GRAD_RE   = re.compile(r"\b(new[ -]?grad|new[ -]?graduate|graduate(?: program)?|university grad|2024 grad|2025 grad|2026 grad|early career)\b", re.IGNORECASE)
ENTRY_RE      = re.compile(r"\b(entry[ -]?level|junior|jr\.?|associate|level[ -]?1|l1)\b", re.IGNORECASE)
SENIOR_RE     = re.compile(r"\b(senior|sr\.?|staff|principal|lead|architect)\b", re.IGNORECASE)
EXEC_RE       = re.compile(r"\b(director|vp|vice president|chief|cto|ceo|coo|cfo|head of|founding)\b", re.IGNORECASE)
REMOTE_RE     = re.compile(r"\b(remote|wfh|work from home|distributed)\b", re.IGNORECASE)
HYBRID_RE     = re.compile(r"\bhybrid\b", re.IGNORECASE)
FULLTIME_RE   = re.compile(r"\bfull[ -]?time\b", re.IGNORECASE)
PARTTIME_RE   = re.compile(r"\bpart[ -]?time\b", re.IGNORECASE)
CONTRACT_RE   = re.compile(r"\b(contract|contractor|freelance|temporary)\b", re.IGNORECASE)

# Tech-stack tokens → canonical display labels. Mapping (rather than a bare
# list + string munging) keeps casing correct and lets synonyms such as
# "postgres"/"postgresql" or "node.js"/"nodejs" collapse to one label.
TECH_STACK_LABELS = {
    "python": "Python", "javascript": "JavaScript", "typescript": "TypeScript",
    "java ": "Java", " go ": "Go", "golang": "Go", "rust": "Rust",
    "ruby": "Ruby", "kotlin": "Kotlin", "swift": "Swift", "c++": "C++", "c#": "C#",
    "php": "PHP", "scala": "Scala", "elixir": "Elixir",
    "react": "React", "vue": "Vue", "angular": "Angular", "svelte": "Svelte",
    "next.js": "Next.js", "nextjs": "Next.js", "nuxt": "Nuxt", "remix": "Remix",
    "node.js": "Node.js", "nodejs": "Node.js", "django": "Django", "flask": "Flask",
    "fastapi": "FastAPI", "rails": "Rails", "spring": "Spring", "laravel": "Laravel",
    "postgres": "PostgreSQL", "postgresql": "PostgreSQL", "mysql": "MySQL",
    "mongodb": "MongoDB", "redis": "Redis", "elasticsearch": "Elasticsearch",
    "dynamodb": "DynamoDB", "cassandra": "Cassandra",
    "aws": "AWS", "gcp": "GCP", "azure": "Azure", "docker": "Docker",
    "kubernetes": "Kubernetes", "terraform": "Terraform", "ansible": "Ansible",
    "graphql": "GraphQL", "rest api": "REST API", "grpc": "gRPC",
    "kafka": "Kafka", "rabbitmq": "RabbitMQ",
    "tensorflow": "TensorFlow", "pytorch": "PyTorch", "jax": "JAX",
    "huggingface": "Hugging Face", "langchain": "LangChain", "llm": "LLM",
    "tailwind": "Tailwind", "css": "CSS", "sass": "Sass", "webpack": "Webpack", "vite": "Vite",
    "figma": "Figma", "sketch": "Sketch",
}


def detect_experience_level(title: str, description: str = "") -> str:
    """Best-effort seniority classification from title (description is a fallback)."""
    text = f"{title} {description[:500]}"
    if INTERNSHIP_RE.search(text):  return "Entry Level"
    if NEW_GRAD_RE.search(text):    return "Entry Level"
    if EXEC_RE.search(title):       return "Executive"
    if SENIOR_RE.search(title):     return "Senior"
    if ENTRY_RE.search(title):      return "Entry Level"
    return "Mid Level"


def detect_internship(title: str, description: str = "") -> bool:
    return bool(INTERNSHIP_RE.search(f"{title} {description[:500]}"))


def detect_new_grad(title: str, description: str = "") -> bool:
    return bool(NEW_GRAD_RE.search(f"{title} {description[:500]}"))


def detect_work_mode(title: str, description: str, location: str = "") -> tuple[str, bool]:
    """Returns (work_mode, is_remote_bool). Order matters: remote > hybrid > on-site."""
    text = f"{title} {description[:800]} {location}"
    if REMOTE_RE.search(text):
        return ("Remote", True)
    if HYBRID_RE.search(text):
        return ("Hybrid", False)
    return ("On-site", False)


def detect_job_type(title: str, description: str, default: Optional[str] = None) -> Optional[str]:
    text = f"{title} {description[:400]}"
    if INTERNSHIP_RE.search(text): return "Internship"
    if CONTRACT_RE.search(text):   return "Contract"
    if PARTTIME_RE.search(text):   return "Part-time"
    if FULLTIME_RE.search(text):   return "Full-time"
    return default


def extract_tech_stack(description: str, limit: int = 12) -> list[str]:
    """Returns a deduped list of tech/skill labels found in the description.

    Synonyms collapse to a single canonical label (for example both
    "postgres" and "postgresql" yield "PostgreSQL", appearing only once).
    """
    if not description: return []
    lowered = description.lower()
    found = []
    seen = set()
    for tok, label in TECH_STACK_LABELS.items():
        if tok in lowered and label not in seen:
            found.append(label)
            seen.add(label)
            if len(found) >= limit:
                break
    return found


def parse_salary(text: str) -> tuple[Optional[float], Optional[float], Optional[str]]:
    """Best-effort salary parser. Returns (min, max, period) — any may be None.

    Handles:
      - "$120,000 - $160,000"
      - "$120k - $160k"
      - "$50/hour"
      - ranges separated by 'to' or '–'
    """
    if not text:
        return (None, None, None)
    t = text.lower().replace(",", "")

    # hourly
    hourly = re.search(r"\$?(\d+(?:\.\d+)?)\s*(?:/|per\s)\s*(?:hour|hr|h)\b", t)
    if hourly:
        v = float(hourly.group(1))
        return (v, v, "hour")

    # k-style ranges: $120k - $160k
    krange = re.search(r"\$?(\d{2,4})\s*k\s*[-–to]+\s*\$?(\d{2,4})\s*k", t)
    if krange:
        lo, hi = float(krange.group(1)) * 1000, float(krange.group(2)) * 1000
        return (lo, hi, "year")

    # standard ranges: $120000 - $160000
    rng = re.search(r"\$?(\d{4,7})\s*[-–to]+\s*\$?(\d{4,7})", t)
    if rng:
        lo, hi = float(rng.group(1)), float(rng.group(2))
        if 10000 <= lo <= 1_000_000:
            return (lo, hi, "year")

    # single k-style: $120k
    ksingle = re.search(r"\$?(\d{2,4})\s*k\b", t)
    if ksingle:
        v = float(ksingle.group(1)) * 1000
        return (v, v, "year")

    return (None, None, None)


# ── location → (city, state, country) ────────────────────────────────────────
# ATS boards give a free-text location ("London", "New York, NY", "Remote -
# Germany", "Toronto, Ontario, Canada"). We need a real country so the US feed
# stops showing Stockholm and Jakarta. Unknown strings fall back to the
# adapter's default country (companies in our registry are mostly US-based),
# so recall only drops where we are confident the job is abroad.

US_STATE_CODES = {
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
    "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
    "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV",
    "WI","WY","DC",
}
US_STATE_NAMES = {
    "alabama":"AL","alaska":"AK","arizona":"AZ","arkansas":"AR","california":"CA",
    "colorado":"CO","connecticut":"CT","delaware":"DE","florida":"FL","georgia":"GA",
    "hawaii":"HI","idaho":"ID","illinois":"IL","indiana":"IN","iowa":"IA","kansas":"KS",
    "kentucky":"KY","louisiana":"LA","maine":"ME","maryland":"MD","massachusetts":"MA",
    "michigan":"MI","minnesota":"MN","mississippi":"MS","missouri":"MO","montana":"MT",
    "nebraska":"NE","nevada":"NV","new hampshire":"NH","new jersey":"NJ","new mexico":"NM",
    "new york":"NY","north carolina":"NC","north dakota":"ND","ohio":"OH","oklahoma":"OK",
    "oregon":"OR","pennsylvania":"PA","rhode island":"RI","south carolina":"SC",
    "south dakota":"SD","tennessee":"TN","texas":"TX","utah":"UT","vermont":"VT",
    "virginia":"VA","washington":"WA","west virginia":"WV","wisconsin":"WI","wyoming":"WY",
    "district of columbia":"DC","washington dc":"DC","washington d.c.":"DC",
}

# Country names / aliases → ISO-2. Matched as whole comma-separated parts or
# whole words, longest alias first.
COUNTRY_ALIASES = {
    "united states":"US","usa":"US","u.s.":"US","u.s.a.":"US","us":"US","america":"US",
    "united kingdom":"GB","uk":"GB","u.k.":"GB","england":"GB","scotland":"GB","wales":"GB","great britain":"GB",
    "canada":"CA","ireland":"IE","germany":"DE","deutschland":"DE","france":"FR","spain":"ES","españa":"ES",
    "portugal":"PT","italy":"IT","italia":"IT","netherlands":"NL","the netherlands":"NL","belgium":"BE",
    "switzerland":"CH","austria":"AT","sweden":"SE","norway":"NO","denmark":"DK","finland":"FI",
    "poland":"PL","czech republic":"CZ","czechia":"CZ","hungary":"HU","romania":"RO","greece":"GR",
    "ukraine":"UA","estonia":"EE","latvia":"LV","lithuania":"LT","serbia":"RS","bulgaria":"BG","croatia":"HR",
    "turkey":"TR","türkiye":"TR","israel":"IL","united arab emirates":"AE","uae":"AE","saudi arabia":"SA",
    "india":"IN","pakistan":"PK","bangladesh":"BD","sri lanka":"LK","singapore":"SG","malaysia":"MY",
    "indonesia":"ID","philippines":"PH","vietnam":"VN","thailand":"TH","japan":"JP","south korea":"KR",
    "korea":"KR","china":"CN","hong kong":"HK","taiwan":"TW","australia":"AU","new zealand":"NZ",
    "brazil":"BR","brasil":"BR","mexico":"MX","méxico":"MX","argentina":"AR","colombia":"CO","chile":"CL",
    "peru":"PE","uruguay":"UY","costa rica":"CR","south africa":"ZA","nigeria":"NG","kenya":"KE","egypt":"EG",
    # ISO-3 codes some boards use ("Ontario, CAN"). Short aliases only match as
    # a whole comma-part or in upper case — see parse_location.
    "can":"CA","gbr":"GB","deu":"DE","ind":"IN","aus":"AU","fra":"FR","jpn":"JP","sgp":"SG","irl":"IE",
    "nld":"NL","mex":"MX","bra":"BR","esp":"ES","che":"CH","swe":"SE","pol":"PL","ita":"IT","kor":"KR",
    "are":"AE","isr":"IL","nzl":"NZ","prt":"PT","bel":"BE","aut":"AT","dnk":"DK","nor":"NO","fin":"FI",
}

# Major non-US hiring cities that ATS boards list bare ("London", "Toronto").
# Only unambiguous ones — anything that collides with a US city name is omitted.
CITY_COUNTRY = {
    # Regions / provinces that boards list instead of a country
    "ontario":"CA","british columbia":"CA","alberta":"CA","quebec":"CA","nova scotia":"CA","manitoba":"CA",
    "karnataka":"IN","maharashtra":"IN","telangana":"IN","tamil nadu":"IN","haryana":"IN","uttar pradesh":"IN",
    "bavaria":"DE","bayern":"DE","catalonia":"ES","cataluña":"ES","new south wales":"AU","queensland":"AU",
    "greater london":"GB","west midlands":"GB","leinster":"IE",
    # UK / Ireland
    "london":"GB","manchester":"GB","edinburgh":"GB","glasgow":"GB","bristol":"GB","leeds":"GB",
    "birmingham, uk":"GB","belfast":"GB","dublin":"IE","cork":"IE",
    # Canada
    "toronto":"CA","vancouver":"CA","montreal":"CA","montréal":"CA","ottawa":"CA","calgary":"CA",
    "waterloo":"CA","kitchener":"CA","edmonton":"CA","quebec city":"CA","québec":"CA","halifax":"CA",
    # Europe
    "berlin":"DE","munich":"DE","münchen":"DE","hamburg":"DE","frankfurt":"DE","cologne":"DE","köln":"DE",
    "paris":"FR","lyon":"FR","amsterdam":"NL","rotterdam":"NL","utrecht":"NL","eindhoven":"NL",
    "brussels":"BE","bruxelles":"BE","antwerp":"BE","zurich":"CH","zürich":"CH","geneva":"CH","basel":"CH",
    "vienna":"AT","wien":"AT","stockholm":"SE","gothenburg":"SE","göteborg":"SE","malmö":"SE","malmo":"SE",
    "oslo":"NO","copenhagen":"DK","københavn":"DK","helsinki":"FI","madrid":"ES","barcelona":"ES",
    "valencia":"ES","lisbon":"PT","lisboa":"PT","porto":"PT","milan":"IT","milano":"IT","rome":"IT",
    "roma":"IT","warsaw":"PL","warszawa":"PL","krakow":"PL","kraków":"PL","wroclaw":"PL","wrocław":"PL",
    "gdansk":"PL","prague":"CZ","praha":"CZ","brno":"CZ","budapest":"HU","bucharest":"RO","athens":"GR",
    "kyiv":"UA","kiev":"UA","tallinn":"EE","riga":"LV","vilnius":"LT","belgrade":"RS","sofia":"BG",
    "zagreb":"HR","istanbul":"TR","ankara":"TR",
    # Middle East / Africa
    "tel aviv":"IL","tel aviv-yafo":"IL","jerusalem":"IL","haifa":"IL","dubai":"AE","abu dhabi":"AE",
    "riyadh":"SA","doha":"QA","cairo":"EG","lagos":"NG","nairobi":"KE","cape town":"ZA","johannesburg":"ZA",
    # Asia-Pacific
    "bangalore":"IN","bengaluru":"IN","hyderabad":"IN","mumbai":"IN","pune":"IN","chennai":"IN",
    "delhi":"IN","new delhi":"IN","gurgaon":"IN","gurugram":"IN","noida":"IN","kolkata":"IN",
    "singapore":"SG","kuala lumpur":"MY","jakarta":"ID","manila":"PH","ho chi minh city":"VN","hanoi":"VN",
    "bangkok":"TH","tokyo":"JP","osaka":"JP","seoul":"KR","beijing":"CN","shanghai":"CN","shenzhen":"CN",
    "hangzhou":"CN","hong kong":"HK","taipei":"TW","sydney":"AU","melbourne":"AU","brisbane":"AU",
    "perth":"AU","canberra":"AU","auckland":"NZ","wellington":"NZ",
    # Latin America
    "são paulo":"BR","sao paulo":"BR","rio de janeiro":"BR","mexico city":"MX","ciudad de méxico":"MX",
    "guadalajara":"MX","monterrey":"MX","buenos aires":"AR","bogotá":"CO","bogota":"CO","medellín":"CO",
    "medellin":"CO","santiago":"CL","lima":"PE","montevideo":"UY","san josé":"CR",
}

_COUNTRY_ALIAS_RE = re.compile(
    r"(?<![\w.])(" + "|".join(
        re.escape(a) for a in sorted(COUNTRY_ALIASES, key=len, reverse=True)
    ) + r")(?![\w.])",
    re.IGNORECASE,
)
_LOCATION_NOISE_RE = re.compile(
    r"\b(remote|hybrid|on[- ]?site|flexible|anywhere|distributed|office|hq|headquarters)\b",
    re.IGNORECASE,
)


def parse_location(loc_str: Optional[str], default_country: str = "US") -> tuple[Optional[str], Optional[str], str]:
    """Split a free-text ATS location into (city, state, country).

    Country resolution, in order of confidence:
      1. an explicit country name/code anywhere in the string ("Remote - Germany")
      2. a US state code or name as a part ("Austin, TX", "Remote, California")
      3. a known non-US city ("London", "Toronto, Ontario")
      4. ``default_country``

    city/state keep the old best-effort behaviour (first part / second part)
    but a recognised US state is normalised to its two-letter code and a
    trailing country part is not mistaken for a state.
    """
    if not loc_str or not loc_str.strip():
        return None, None, default_country

    raw = loc_str.strip()
    parts = [p.strip() for p in re.split(r"[,/|·•]|\s[-–—]\s", raw) if p.strip()]
    lowered = [p.lower() for p in parts]

    # 1. explicit country anywhere
    country: Optional[str] = None
    for p in lowered:
        if p in COUNTRY_ALIASES:
            country = COUNTRY_ALIASES[p]
            break
    if country is None:
        m = _COUNTRY_ALIAS_RE.search(raw)
        # Bare "us"/"uk" only count when they stand as their own part or are
        # upper-case, so "Austin, TX" ("us" inside "Austin") can't match.
        if m and (len(m.group(1)) > 3 or m.group(1).isupper() or m.group(1).lower() in lowered):
            country = COUNTRY_ALIASES[m.group(1).lower()]

    # 2. US state as a part. Two-letter codes win over names so "Washington, DC"
    #    is DC (not WA) and "New York, NY" reads the NY, leaving "New York" as
    #    the city.
    state: Optional[str] = None
    for p in parts:
        m = _STATE_CODE_RE.match(p)
        if m and m.group(1) in US_STATE_CODES:
            state = m.group(1)
            break
    if state is None:
        for p in lowered[1:] or lowered:   # a bare "New York" is a city first
            if p in US_STATE_NAMES:
                state = US_STATE_NAMES[p]
                break
    if country is None and state is not None:
        country = "US"

    # 3. known non-US city (whole part match, or the whole string)
    if country is None:
        for p in lowered:
            if p in CITY_COUNTRY:
                country = CITY_COUNTRY[p]
                break
        if country is None and raw.lower() in CITY_COUNTRY:
            country = CITY_COUNTRY[raw.lower()]

    if country is None:
        country = default_country

    # city = first part that is a real place (not "Remote (US)", a country,
    # or a bare state code). A US state *name* in first position stays a city
    # ("New York", "Washington") because that's how boards list the city.
    city: Optional[str] = None
    for idx, p in enumerate(parts):
        pl = p.lower()
        if _is_placeholder(p) or pl in COUNTRY_ALIASES:
            continue
        if _STATE_CODE_RE.fullmatch(p) and p.upper() in US_STATE_CODES:
            continue
        if idx > 0 and pl in US_STATE_NAMES:
            continue
        city = p
        break

    # Non-US: keep the second part as a region only if it isn't the country
    if state is None and len(parts) > 1:
        second = parts[1]
        if second != city and second.lower() not in COUNTRY_ALIASES and not _is_placeholder(second):
            state = second

    return city, state, country


_STATE_CODE_RE = re.compile(r"^([A-Z]{2})(?![A-Za-z])")


def _is_placeholder(part: str) -> bool:
    """True for parts that carry no place — "Remote", "Remote (US)", "Hybrid"."""
    rest = _LOCATION_NOISE_RE.sub("", part)
    rest = _COUNTRY_ALIAS_RE.sub("", rest)
    return rest.strip(" -–—()[]/") == ""


def compute_dedupe_hash(title: str, company: str, location: str) -> str:
    """MD5 of normalized title|company|location — secondary dedup key."""
    raw = f"{(title or '').lower().strip()}|{(company or '').lower().strip()}|{(location or '').lower().strip()}"
    return hashlib.md5(raw.encode()).hexdigest()


def truncate(s: Optional[str], n: int) -> Optional[str]:
    if not s: return None
    s = s.strip()
    return s[:n] if len(s) > n else s


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
