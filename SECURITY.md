# Nexume Security

This document describes Nexume's current security posture, the hardenings shipped to date, and the prioritised roadmap. It exists so future-you can see what's actually protected vs aspirational.

---

## Current architecture (one-liner)

```
[user browser]──HTTPS──▶ [Vercel CDN + edge security headers]
                                            │
                              ───────────────┴─────────────── static React/Vite
                                            │
                                            ▼
                       [Render: FastAPI (Uvicorn)]
                                            │
                       ────────┬─────────────┬───────────
                               ▼             ▼            ▼
                     [Supabase Postgres]  [OpenAI]   [JSearch/ATS APIs]
                       (service-role key)  (API key)  (API key)
```

**No user accounts exist.** No JWT, no sessions, no passwords stored. Resume history, saved jobs, application tracker, and admin-mode flag are all browser `localStorage`. Half the OWASP authentication concerns are inapplicable until auth is built.

---

## What's protected as of this commit

| Threat | Defence |
|---|---|
| **Cross-origin API abuse** | `CORSMiddleware` restricted to `https://nexume-ai.vercel.app`, Vercel preview branches via regex, and `localhost:5173/3000` for dev. `allow_credentials=False`. |
| **OpenAI/LLM cost drain** | Per-IP sliding-window rate limiter in `backend/security.py`. LLM routes capped at 10/min, TTS at 30/min, DB-reads at 120/min, admin at 20/min. Memory-bounded to 50k IPs. |
| **Unauthenticated admin actions** | `/jobs/refresh/` and `/jobs/ingest-ats` now require `X-Admin-Token` header matching env var `NEXUME_ADMIN_TOKEN`. Missing/wrong token returns **404** (not 403) so probing reveals nothing. |
| **Clickjacking** | `X-Frame-Options: DENY` (both API + Vercel) and CSP `frame-ancestors 'none'`. |
| **MIME-confusion attacks** | `X-Content-Type-Options: nosniff` on every response. |
| **XSS (frontend)** | CSP locks `script-src` to self, `connect-src` to backend only, `object-src 'none'`. React already auto-escapes; no `dangerouslySetInnerHTML` used. |
| **Referrer leakage** | `Referrer-Policy: strict-origin-when-cross-origin` on every response. |
| **Permissive sensors** | `Permissions-Policy` disables camera/geolocation/payment/USB; allows microphone only for our own origin (for the Interview Simulator). |
| **HTTPS downgrade** | `Strict-Transport-Security: max-age=63072000; includeSubDomains` (2 years). |
| **PDF upload exploits** | `validate_pdf_bytes()` checks `%PDF-` magic header + 5 MB size cap. MIME alone is client-controlled. |
| **Server fingerprinting** | `Server: Nexume` overrides Uvicorn's default header. |
| **API docs disclosure** | `/docs`, `/redoc`, `/openapi.json` disabled in production. |
| **SQL injection** | All DB access goes through Supabase Postgrest client → parameterised by construction. No raw SQL string concatenation anywhere. |
| **CSRF** | API is stateless (no cookies); CSRF is non-applicable. **Will become applicable when auth is added — must use SameSite=Strict cookies + double-submit token at that point.** |
| **DB row-level access** | Supabase RLS enabled on `jobs` and `ingestion_runs`. Public can only SELECT `is_active = true` rows. Writes require service role. |
| **Secrets in repo** | `.env` is gitignored; all keys live only in Render env vars + local dev `.env`. |

### Required env vars on Render

| Var | Purpose |
|---|---|
| `OPENAI_API_KEY` | LLM + TTS |
| `SUPABASE_URL` | DB host |
| `SUPABASE_KEY` | Postgrest service-role key |
| `JSEARCH_API_KEY` | Legacy jobs aggregator |
| **`NEXUME_ADMIN_TOKEN`** (new) | Long random string. Required header value for `/jobs/refresh/` and `/jobs/ingest-ats`. Generate with: `python -c "import secrets; print(secrets.token_urlsafe(48))"`. |

If `NEXUME_ADMIN_TOKEN` is unset, those endpoints **fail closed** (return 404). The internal APScheduler call paths run inside the same process and bypass the HTTP guard entirely, so they keep working.

---

## What's NOT protected yet — roadmap

The order matters. Don't skip ahead.

### Before public launch (must-have)

| Item | Effort | Notes |
|---|---|---|
| **Real auth system** | 1–2 weeks | Use Supabase Auth (email/password + magic-link is free, built-in). Then JWT verification middleware on the FastAPI side that calls `supabase.auth.get_user(jwt)`. |
| **Email verification** | 1 day | Supabase Auth handles this out-of-box. Just enable + add the email template. |
| **Password reset** | 1 day | Same — Supabase Auth flow. |
| **GitHub Dependabot** | 30 min | Free, click-to-enable on the repo. Alerts on vulnerable npm/pip deps. |
| **Encrypted resume storage** | 1 week | If you ever store resumes server-side (right now you don't), add app-level AES-GCM encryption on the column. Supabase storage is already encrypted at rest but app-level is defence-in-depth. |
| **Move JSearch/OpenAI keys to a secrets manager** | 2 hours | Doppler or AWS Secrets Manager. Render env vars are fine for now but rotate quarterly. |

### Before monetisation (December 2026)

| Item | Effort | Notes |
|---|---|---|
| **2FA / MFA** | 3 days | TOTP via Supabase Auth. Required for billing dashboard access. |
| **OAuth (Google/LinkedIn sign-in)** | 3 days | Supabase has these built-in. Reduces password-management attack surface. |
| **Stripe webhook signature verification** | 1 day | Critical — verify `Stripe-Signature` header on every webhook or you can be tricked into provisioning entitlements you weren't paid for. |
| **GDPR compliance** | 1 week | Data-export endpoint, hard-delete endpoint, privacy policy, DPA with subprocessors. Required if any EU user signs up. |
| **Brute-force lockout on login** | 1 day | After auth ships: lock account for 15 min after 5 failed logins per IP+email. |
| **Suspicious-login detection** | 3 days | New device → email "is this you?" via Supabase Auth's built-in flow. |
| **Cloudflare in front of Render** | 1 day | Free tier gets you DDoS protection + WAF rules. Worth it before public launch. |
| **CAPTCHA on sign-up + login** | 1 day | Turnstile (free, Cloudflare) or hCaptcha. Stops bot signups. |

### Before scale (10k+ users / when seeing real abuse)

| Item | Effort | Notes |
|---|---|---|
| **Redis-backed rate limiter** | 2 days | The current in-memory limiter is per-worker. When you scale to multiple Render workers it stops being shared state. Swap to Upstash Redis (free tier sufficient). |
| **Audit logging** | 1 week | Every admin action + auth event written to a separate immutable log table. Required for SOC 2 / enterprise customers. |
| **Bot detection** | 1 week | Cloudflare Turnstile interaction signals, anomaly detection on request patterns. |
| **Penetration test** | 1–2 weeks | **Hire someone.** Don't DIY. Budget $5–15k for a serious test. |
| **SAST/DAST in CI** | 1 day | Snyk or Semgrep on every PR. |
| **Secret scanning** | 1 hour | GitHub native secret scanning (free) + Gitleaks pre-commit hook. |
| **WAF custom rules** | ongoing | Cloudflare WAF — block obvious payloads (SQL keywords in URL, etc.). |
| **Encrypted backups** | 1 day | Supabase paid plan does this; check region for compliance. |

### Always-on

| Practice | How |
|---|---|
| **Rotate `NEXUME_ADMIN_TOKEN` quarterly** | Generate new with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Update Render env var. Re-deploy. |
| **Patch dependencies monthly** | `npm audit fix` + `pip list --outdated`. Dependabot handles this once enabled. |
| **Review Render + Supabase access logs** | Anomaly detection on request patterns. |
| **Never commit `.env`** | Already gitignored. Pre-commit hook with gitleaks for safety. |
| **No prod secrets in chat/screenshots** | Self-explanatory. |

---

## Rate-limit configuration (current)

Defined in `backend/security.py` and applied via FastAPI `dependencies=[Depends(...)]`:

| Tier | Limit | Routes |
|---|---|---|
| `LIMIT_EXPENSIVE` | 10 req / 60s / IP | `/chat/`, `/interview-turn/`, `/interview-summary/`, `/generate-interview/`, `/evaluate-answer/`, `/analyze-resume/`, `/rewrite-bullet/`, `/generate-cover-letter/`, `/optimize-linkedin/`, `/generate-cold-email/`, `/analyze-skill-gap/`, `/estimate-salary/` |
| `LIMIT_TTS` | 30 req / 60s / IP | `/interview-tts/` |
| `LIMIT_READ` | 120 req / 60s / IP | `/jobs/`, `/jobs/stats`, `/jobs/status/` |
| `LIMIT_ADMIN` | 20 req / 60s / IP | `/jobs/refresh/`, `/jobs/ingest-ats` (token required first) |
| `LIMIT_DEFAULT` | 60 req / 60s / IP | Not currently applied anywhere — available for new routes |
| **unlimited** | — | `/warmup`, `/health` (cheap, used by status checks) |

Exceeded limit returns **HTTP 429** with a `Retry-After` header. The client IP comes from `X-Forwarded-For` (Render's reverse proxy) with fallback to direct peer.

To tighten/loosen, edit the `RateLimiter(...)` instantiations near the top of `security.py`.

---

## Threat model snapshot

| Asset | Threat actor | Vector | Mitigation |
|---|---|---|---|
| OpenAI account balance | Random bot / Discord scraper | Spam LLM endpoints | Rate limit (10/min × CORS lockdown) |
| Supabase service-role key | Render env breach | RCE on Render worker | Out of scope; rotate annually; use Cloudflare to add a layer |
| Resume content | Account takeover | Stolen JWT (post-auth) | **Pending**: short-lived JWT + refresh rotation + httpOnly Secure SameSite=Strict cookies |
| `jobs` table integrity | Attacker | SQL injection via search | Postgrest parameterises; no raw SQL exists in code |
| Application uptime | Bot army | DDoS | **Pending**: Cloudflare free tier before public launch |
| Admin actions | Random visitor | Direct POST to `/jobs/refresh/` | `X-Admin-Token` guard returning 404 |

---

## How to verify the hardenings are live

After deploy:

```bash
# 1. CORS lockdown — should be REJECTED
curl -i -H "Origin: https://evil.example.com" https://landtherole-ai.onrender.com/jobs/stats
# Expect: NO Access-Control-Allow-Origin header echoing the bad origin

# 2. Rate limit on /chat/ — eleventh request in 60s should 429
for i in $(seq 1 11); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://landtherole-ai.onrender.com/chat/ \
    -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"hi"}]}'
done
# Expect: ten 200s then 429

# 3. Admin endpoint without token — should 404
curl -i -X POST https://landtherole-ai.onrender.com/jobs/refresh/
# Expect: HTTP/2 404

# 4. Admin endpoint with token — should 200
curl -i -X POST https://landtherole-ai.onrender.com/jobs/refresh/ \
  -H "X-Admin-Token: $NEXUME_ADMIN_TOKEN"
# Expect: HTTP/2 200

# 5. Security headers
curl -sI https://landtherole-ai.onrender.com/health | grep -E "X-Frame-Options|X-Content-Type-Options|Strict-Transport"
# Expect: all three present

# 6. Disabled docs
curl -i https://landtherole-ai.onrender.com/docs
# Expect: 404

# 7. CSP at the edge (Vercel)
curl -sI https://nexume-ai.vercel.app/ | grep -i "content-security-policy"
# Expect: full CSP header
```

If any of these fail post-deploy, something regressed.
