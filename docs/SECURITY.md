# Security model

Status: planning document for the multi-couple product. It records intended controls and current gaps; it is not evidence that controls are implemented. Implementation stories are referenced. Report vulnerabilities to the security contact once published (H5).

## Scope and assets

Highest-value assets:

1. **Private couple content**: messages, call metadata, media, memories, daily answers, research questions, personal journals.
2. **Identity**: email addresses, OAuth identities, sessions, invitations, membership.
3. **Availability and cost**: realtime, storage, AI, TURN, email.
4. **Operational secrets**: Supabase service role, AI keys, TURN credentials, email keys, signing keys.
5. **Integrity**: deletion/export jobs, audit log, moderation evidence.

Actors: two members of a couple; anonymous internet; abusive authenticated users (including a hostile partner); bots/scrapers; compromised dependencies; insiders/support operators; payment/legal authorities (future).

## Trust boundaries

- Browser/mobile client ↔ our server and Supabase APIs (untrusted client input; session token is the only authority).
- Our server ↔ database/storage/realtime (service role bypasses RLS and is treated as highly privileged).
- Our services ↔ third parties (Gemini, OpenAlex, feeds, YouTube, email, TURN, Sentry).
- Staging ↔ production (separate projects and credentials; loop has no production access).

## Non-negotiable controls

| Area | Control | Story |
| --- | --- | --- |
| Tenant isolation | `couple_id` on every owned row; RLS default-deny; session-derived couple; cross-couple tests in CI | E1-002, E2-001–E2-004, E12-004 |
| Storage isolation | Private buckets, `<couple_id>/…` paths, short-lived signed URLs, traversal tests | E6-001 |
| Realtime isolation | Private channels authorized via RLS; no client-trusted channel ids | E3-001, E4-001 |
| Auth | Managed auth, OTP/OAuth, rate limits, session revocation, recovery verification | E1-003–E1-007, E9-005 |
| Secrets | Per-environment secrets, no git, rotation inventory; service role server-only | E0-003, E0-006, E9-006 |
| Uploads | MIME sniffing, size limits, EXIF removal, CSAM hash match, quarantine, report path | E6-002, E6-004 |
| Calls | Short-lived per-call TURN credentials, no recording, no global relay secret | E4-003, E4-008 |
| AI | Per-couple sealed BYO keys (never returned), server-side quotas, token/cost metering, prompt-injection fencing, output moderation, no content logging | E7-003, E7-004 |
| Abuse | Report/block, moderation queue, per-IP/user limits, anomaly alerts | E9-001, E9-002, E9-005 |
| Browser hardening | Per-request nonce CSP, HSTS, frame denial, referrer/permissions policy, sanitized violation reports; no wildcard CORS | E9-011 |
| Dependencies | gitleaks + audit + SAST in CI; patch critical advisories promptly | E0-003, E0-004 |

## Threat model

| Threat | Example | Mitigations | Residual risk |
| --- | --- | --- | --- |
| Cross-tenant read (IDOR) | Change an id and fetch another couple's chat | RLS + session-derived couple + 404 on mismatch + pgTAP matrix | Application bugs before RLS tested; mitigated by default-deny gate |
| Cross-tenant write | Insert a message with another `couple_id` | `with check` policies; server sets `couple_id`; FK/composite tests | Service-role path mistakes |
| Session theft | XSS or leaked refresh token | httpOnly/Secure cookies on web; Keychain/Keystore on native; CSP; short-lived access tokens; revocation | Device compromise; no MFA yet (Supabase supports it) |
| Invite abuse | Spam/brute-force invite codes | Single-use, expiry, rate limits, unguessable tokens, audit | Social engineering of partner |
| Account enumeration | Different errors for known emails | Uniform responses, throttling, generic OTP request replies | Timing side channels |
| Email/PIN brute force | Guessing a recovery code | 10-minute expiry, five attempts, per-IP and per-email buckets, single-use hashed codes | Compromised email inbox |
| OAuth state/redirect abuse | Forged callback or open redirect | Signed state cookie, PKCE, exact redirect URI, same-origin-only `next`, server-side ID token verification | Misconfigured provider settings |
| Hostile partner | Access after separation | Unlink/leave, block, deletion, session revocation; shared-data policy explicit | Past copies exported by the other member |
| Upload abuse | CSAM, malware, oversized files | Hash matching, MIME/limits, quarantine, no public bucket, provider reporting | Novel content not in hash sets; legal process required |
| TURN/call abuse | Relay used as free VPN | Per-call short TTL, rate limits, usage alerts, blocking | Cost spike before alert |
| AI prompt injection | Feed text instructs the model to reveal data | Fence external content, no secrets in context, output filters, least data | Model-level failures; tests are probabilistic |
| Secret leakage | Key in logs, build output, client bundle | Server-only env, redaction, secret scanning, rotation | Human error; audit + gitleaks |
| DoS via polling | Many clients poll-write | Realtime + throttles + rate limits + load tests; remove write-on-poll | Realtime plan saturation |
| Supply chain | Compromised package | Lockfile, audit, gitleaks, SAST, pinned actions, review | Zero-days |
| Insider/support abuse | Staff reads private messages | Break-glass with reason + audit, no content by default, least privilege | Small team concentration |
| Deletion failure | Data remains after "delete" | Purge queue with verification, alerts, evidence pack | Backups may retain until expiry; disclose |

## Auth and session details

- First-party email + password auth on Neon: bcrypt cost 12, case-insensitive email uniqueness, generic errors, dummy hash comparison for unknown accounts, and database-backed per-IP/per-email attempt buckets.
- Sessions are HS256 JWTs in the httpOnly `lovora_session` cookie (30 days) with a `ver` claim matched to `people.sessionVersion`. Password change, email-code reset and "sign out everywhere" bump the version and revoke older tokens.
- Email recovery: 6-digit codes expire in 10 minutes, allow five attempts, are single-use, and are stored only as an HMAC hash with a per-row salt. Sends/resends are limited to one per 60 seconds per address and capped per IP and per email in `auth_attempts`. Unknown addresses receive the same response and no email.
- A verified code yields a 10-minute signed reset ticket bound to the account's session version; the conditional password update defeats replay. Reset rotates the recovery code and signs out other devices.
- Signup, invitation acceptance and reset finish with a 10-minute signed continue ticket in an httpOnly cookie; `/api/auth/continue` exchanges it for the session (`ver` claim checked as usual). The session is deliberately not created while the one-time code screen is open, so a re-render cannot redirect away and hide the code.
- Google sign-in uses OAuth 2.0 with PKCE and a signed state cookie. The ID token is verified server-side against Google's JWKS (issuer, audience, signature, `email_verified`). Accounts link by Google subject, then verified email. New Google users complete onboarding before an account exists; those accounts have no password until they set one.
- Every auth route is server-side; no third-party JS is loaded for Google, and all forms post to our own origin (CSP `form-action 'self'`).
- Email change requires verification of both old and new addresses; recovery is audited (E1-011).
- MFA: not in v1 for consumers; consider TOTP/passkeys post-launch. Store the decision.

## Media and content safety

- Private buckets only; no public object URLs; signed URL TTL short and audited.
- Upload reservation → validation → scanning → visibility. Nothing is visible to the partner before scanning completes (fail closed).
- CSAM hash matching provider and reporting process must be legally reviewed (H9); evidence retained per law.
- Report/block across message, profile, media and room; NCII escalation is immediate and documented (E9-002).
- YouTube is embedded via the official player; no download/proxy/caching; store copy must not claim DRM screen-share.

## Logging and telemetry

- Never log message bodies, media contents, daily answers, OTPs, tokens, keys, full emails or IPs in application logs. Use pseudonymous ids.
- Sentry: scrub request bodies and query strings; disable automatic PII where possible; review events.
- Audit log covers admin actions, exports, deletions, entitlement overrides, moderation; append-only. The `audit_log` table has a database trigger that rejects `UPDATE` and `DELETE`; entitlement overrides record actor, reason and before/after limits.
- Entitlements are per couple and changed server-side only; no client-callable plan action exists. Break-glass changes require `ENTITLEMENTS_ADMIN=1` plus an actor and reason, and every change is audited.
- Metrics may include counts/latency, not content.

## Secrets management

- Separate credentials per environment; production never on developer/loop machines.
- `.env.example` documents names only. `.env*`, `apps/web/.data/`, keys, passcodes are gitignored.
- Rotation owners and dates in the inventory (E9-006); rehearse rotation of session/auth/TURN/AI keys.
- No secrets in client bundles; `NEXT_PUBLIC_*` is treated as public.

## Secret scanning (E0-003)

- `.github/workflows/security.yml` runs `gitleaks/gitleaks-action` over the **full commit history** (`fetch-depth: 0`) on every push to `main`, every pull request, a weekly schedule and manual dispatch. A finding fails the workflow; it is never `continue-on-error`.
- `.gitleaks.toml` extends the default rule set (`useDefault = true`) and suppresses **nothing** today. A false positive is added only as a path-scoped allowlist entry with a one-line reason; a real secret is rotated (H22) and purged from history instead of suppressed inline.
- Local history scan (2026-11-18): a pattern sweep of `git log -p --all` for AWS/Google/GitHub/Slack/OpenAI keys, PEM private keys, JWTs and `postgres://user:pass@` connection strings returned **3 hits, all false positives** — a CLI validation message and a docs list of secret *names*. The only `.env`-like file ever added is `.env.example`. gitleaks itself is not installed on the dev machine (H1); the CI job is the enforcement point.

## Dependency audit policy (E0-003)

- The production audit runs through `pnpm run audit:deps` → [scripts/audit-deps.mjs](file:///C:/Users/kkc36/Projects/Lovora/scripts/audit-deps.mjs), which reads [security/audit-allowlist.json](file:///C:/Users/kkc36/Projects/Lovora/security/audit-allowlist.json). Threshold and scope live in that file so a waiver is a reviewed change, not a flag added to a workflow step.
- Policy: `scope: "prod"` (a dev-only finding is never laundered into the production result); `threshold: "high"` (any finding at or above it fails the build unless waived); every waiver names an advisory id, reason, owner and **expiry** — an expired waiver stops suppressing, so it gets re-reviewed instead of becoming permanent.
- The script fails loudly if `pnpm audit` output cannot be parsed or returns no advisories map, so an output-shape change can never be mistaken for "clean".
- Current result (2026-11-18): `pnpm audit --prod` reports **0 advisories** among 193 production dependencies; the allowlist is empty.
- `.github/workflows/security.yml` also runs a **Semgrep baseline** (`semgrep scan --config auto`) and uploads the SARIF artifact. It reports rather than blocks until the baseline is triaged; publishing to code scanning and adding `--error` is the follow-up.

## Dependency and build security

- CI: pnpm frozen lockfile, typegen, typecheck, lint, tests, build; gitleaks full history; dependency audit; Semgrep/CodeQL (E0-003).
- Current versions (2026-11-15): Next 16.4.6 and eslint-config-next 16.4.6; `pnpm audit --prod` reports no known vulnerabilities. The zod override (4.6.7, in `pnpm-workspace.yaml`) replaces the exact 4.1.11 pin under `@vercel/cli-config` (GHSA-mrhx-c7xc-m3w5); recheck it when `@vercel/blob` updates.
- `pnpm audit` still reports two moderate dev-only findings: `esbuild <=0.24.2` through `drizzle-kit`'s legacy `@esbuild-kit` chain, and `minimatch <11.0.1` through ESLint tooling. Neither is shipped at runtime; revisit when those tools update. No critical or high findings remain.
- GitHub Actions pinned; least-privilege tokens; no secrets in PR workflows from forks.

## Browser security headers

- Page responses receive a fresh nonce CSP generated in `apps/web/src/proxy.ts`; Next.js reads the nonce from the request and the HTML script tags match it. `script-src` uses `'strict-dynamic'` plus the nonce, so dynamically loaded YouTube API scripts are allowed without `'unsafe-inline'`. Styles still allow `'unsafe-inline'` because the UI uses JSX style attributes.
- Static headers come from `apps/web/next.config.ts`: `nosniff`, `DENY`, strict referrer policy, restrictive permissions policy, COOP `same-origin-allow-popups` and CORP `same-origin`; HSTS (`max-age=63072000`) is emitted only when `NODE_ENV=production`.
- All browser API calls are same-origin. The app emits no `Access-Control-Allow-Origin` header and no wildcard; any future cross-origin endpoint must add an explicit origin allowlist and a test rather than broadening this default.
- CSP reports go to `/api/csp-report` for both `report-uri` and the Reporting API. The endpoint requires a CSP/reports content type, caps bodies at 8 KiB, and logs only the effective directive and a masked blocked origin. It never logs the full document URL, referrer, query string, or page content.
- Local production-mode evidence is recorded in `docs/VERIFICATION.md`; an external header scan and real-browser YouTube exercise still require a deployed HTTPS URL.

## Verification and testing

- pgTAP/Storage tests create two couples and prove deny on select/insert/update/delete and path traversal (E2-003).
- Playwright e2e covers signup→invite→chat→gallery→export→delete (E12-002).
- Auth/session tests cover expiry, revocation, rotation, email change.
- Load tests at target concurrency (E3-008, E5-008, E11-001).
- Manual pre-launch: report/block, deletion, CSAM quarantine, secret scan, restore drill.
- Keep evidence in `docs/VERIFICATION.md`; no gate is claimed without output.
- E9-011 local check: production-mode response has a matching nonce in HTML and CSP, HSTS/security headers, no ACAO header, and the report endpoint returns 204 while logging only the masked origin.

## Incident response

See `docs/RUNBOOK.md` for steps. Severity levels: SEV1 cross-tenant exposure/active abuse; SEV2 outage or data-loss risk; SEV3 degraded feature; SEV4 minor. For SEV1: contain (revoke keys/sessions, disable feature), preserve evidence, notify the human owner immediately, follow legal notification timelines (Kenya pending, H7), communicate without exposing details.

## Known gaps (today)

- No RLS; custom auth with signed sessions and recovery but no MFA; recovery depends on email deliverability (saved-code fallback remains); in-memory-only push/other feature state in places; global AI/TURN secrets; no moderation/report/block; no CSAM scanning; CSP/security headers implemented but not yet externally scanned; no observability; Vercel Hobby non-commercial.

All are mapped to stories; none may remain open at public launch.
