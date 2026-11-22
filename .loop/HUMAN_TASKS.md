# Human tasks

The loop cannot make legal, billing, store, production-access or irreversible decisions. Resolve a task, write the decision under `Answer:`, tick the box, then re-run `./loop.sh`. Never paste secrets here.

## Blocking environment and accounts

- [ ] **Install pnpm and gitleaks (H1)** — E0-002 needs pnpm; CI secret scanning needs gitleaks — run `corepack enable` then `corepack prepare pnpm@latest --activate`; install gitleaks from https://github.com/gitleaks/gitleaks#installing; confirm Windows is the only dev machine.
  Answer:
- [ ] **Create staging and production Neon projects (H2)** — migrations and staging tests need isolated databases — create two Neon projects (or branches) and give the loop staging credentials only. Supabase is no longer required for auth or storage per ADR-005; revisit only if managed RLS is chosen.
  Answer:
- [ ] **Approve the monthly budget (H3)** — paid plans are required for a commercial service; Vercel Hobby is non-commercial — list approved vendors (Vercel Pro, Supabase, TURN, email, Sentry, EAS, AI) and a hard monthly cap; add it to docs/RUNBOOK.md.
  Answer:
- [ ] **Choose a transactional email provider and sender domain (H4)** — email verification and password-reset-by-email need a verified sender — pick Resend/Postmark/SES, add SPF/DKIM/DMARC, provide the from-address, and create the API key in the secret store. Until then accounts rely on the one-time recovery code.
  Answer: Partial, 2026-11-21 — a provider-agnostic Resend + Brevo mailer and 6-digit email recovery are implemented (ADR-006). Still needed: choose the production sender (Brevo verified single sender, or a Resend verified domain), publish SPF/DKIM/DMARC, then add `EMAIL_PROVIDER`, `EMAIL_FROM`, and the API key in Vercel. Never paste the key here.
- [ ] **Create Google OAuth credentials (H32)** — Google sign-in is implemented but hidden until credentials exist — in Google Cloud Console create an External OAuth consent screen, a Web application OAuth client, and register `https://<domain>/api/auth/google/callback` (plus `http://localhost:3000/api/auth/google/callback` for local dev); set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel, add `APP_URL`, publish the app when ready. Steps are in DEPLOY.md; never paste the secret here.
  Answer:
- [ ] **Smoke-test live auth after configuration (H33)** — after adding email and Google env vars, verify on production: sign-up, sign-out, email code arrival, wrong-code rejection, successful reset (other devices signed out), Google sign-in for an existing account, and first-time Google onboarding. Record results in docs/VERIFICATION.md without personal data.
  Answer:
- [ ] **Confirm product identity (H5)** — policies, store listings and data regions depend on it — decide product name, domain, support email, legal entity and launch countries; run a trademark/name check.
  Answer:
- [ ] **Verify the demo-account migration (H6)** — slug/passcode login is removed; `pnpm seed` upgrades the two local demo accounts to email + password without touching couple data, and production has no public users yet. Before launch, verify the seeded accounts on staging and confirm no production data existed under the old login.
  Answer:
- [x] **Configure Vercel and the production database (H31)** — the Vercel project `lovora` is linked from the repo root, Root Directory `apps/web`, Node 24, with production `DATABASE_URL`, `SESSION_SECRET`, Blob and `YOUTUBE_API_KEY` present; `vercel-build` runs `pnpm db:migrate && next build`, so schema changes (including `drizzle/0016_spotty_pride.sql`, which adds and backfills `room_state.queue_data`) apply on deploy; demo credentials in `apps/web/PASSWORDS.local.md` are local only.
  Answer: Configured and verified 2026-11-21: production deploy `lovora-bav66jcqa` aliased to https://lovora-app.vercel.app; build log shows "Migrations applied."; `/api/health` returns 200 with `database: up`, `/login` 200 and `/together` 307 to sign-in. Source is not on `main` yet because the loop contract forbids pushing.
- [x] **Require CI and protect main (H30)** — repository settings cannot be enforced from code — in GitHub open Settings ? Rules/Branches, protect `main`, require the `CI / check` status check, require a pull request and dismiss stale approvals; then tick this box.
  Answer: Applied by the loop on 2026-11-19: `main` requires the `check` status, a pull request and conversation resolution; admins are included; force pushes and deletions are blocked.

## Legal, safety and privacy

- [ ] **Kenya ODPC and legal review (H7)** — registration, cross-border transfers, DPIA and breach deadlines are UNVERIFIED — commission counsel to confirm ODPC registration/exemption, the September 2026 cross-border guidance, DPIA scope and the statutory breach deadline; attach the memo to docs/COMPLIANCE.md.
  Answer:
- [ ] **Privacy policy, terms, community/copyright guidelines (H8)** — store submissions require them — have counsel draft/approve text naming processors (Supabase, Vercel, Sentry, email, TURN, AI), retention and rights; publish at stable URLs.
  Answer:
- [ ] **CSAM scanning provider and reporting duties (H9)** — upload safety and legal obligations cannot be guessed — select a hash-matching provider, document reporting obligations and escalation contacts, approve the quarantine flow, and fund the account.
  Answer:
- [ ] **Jamendo/CC catalogue licensing decision (H10)** — the free API tier may be non-commercial and per-track licences vary — obtain commercial terms or approve strictly commercial-use CC filtering with attribution; if neither is acceptable, approve launching without a catalogue.
  Answer:
- [ ] **YouTube minimum-functionality review (H11)** — background play/player-UI rules must be followed — read https://developers.google.com/youtube/terms/required-minimum-functionality, approve official-player-only and no-background/no-download behaviour, and confirm store review notes.
  Answer:
- [ ] **Age and consent policy (H12)** — 18+ and consent are store/privacy requirements — approve the age gate, terms/privacy acceptance, re-consent flow and consent records.
  Answer:
- [ ] **E2EE decision (H13)** — a future private vault changes search/AI/moderation; no E2EE claims may ship first — read the ADR from E9-010 and decide post-v1 scope.
  Answer:

## Stores and launch

- [ ] **Apple Developer enrolment (H14)** — iOS builds, Sign in with Apple and APNs require it — enrol (individual or organisation), create the APNs key, grant App Store Connect access.
  Answer:
- [ ] **Google Play account type (H15)** — personal accounts need 12 testers for 14 days; organisations need a D-U-N-S number — decide, create the account, Play Console access and FCM project.
  Answer:
- [ ] **Expo/EAS project (H16)** — mobile builds and submissions need it — create the project, configure credentials, and name who may run production builds/submits.
  Answer:
- [ ] **TURN provider account and cost cap (H17)** — calls need a relay fallback — choose a provider, create restricted credentials, set a hard usage cap and record the cost formula in the ADR/RUNBOOK.
  Answer:
- [ ] **Sentry, analytics and push credentials (H18)** — observability and notifications need accounts/keys — create Sentry projects (PII scrubbing), confirm analytics is consent-only (or defer), and provide APNs/FCM/Web Push credentials.
  Answer:
- [ ] **Recruit beta testers (H19)** — Play personal accounts require 12 testers for 14 continuous days — recruit and track testers, plan their feedback triage and fix window.
  Answer:
- [ ] **Store listing sign-off (H20)** — screenshots/copy/review notes must be accurate — approve icon, screenshots, feature graphic, listing text and review notes (UGC controls, calls, YouTube; no DRM screen-share claims).
  Answer:
- [ ] **Real-device and store-review verification (H21)** — simulators cannot prove ringing, CallKit, background audio or 16 KB pages — run the device matrix (minimum and target iOS/Android, mid-range Android) and the store review checklist; record results.
  Answer:
- [ ] **Rotate any exposed secrets (H22)** — the audit found none committed, but any credential shared in chat/screenshots/logs is compromised — rotate now and record the rotation list.
  Answer:

## Decisions the loop should not guess

- [ ] **Business model and pricing (H23)** — M9 is flag-gated and no price may be invented — decide free vs premium limits, IAP/web billing approach, and whether RevenueCat or equivalent is allowed; record an ADR.
  Answer:
- [ ] **Launch regions and languages (H24)** — affects compliance, store availability and i18n order — choose launch countries and confirm English-first, with the next languages ranked.
  Answer:
- [ ] **Verify Play 16 KB and 12-tester rules (H25)** — currently UNVERIFIED — check Play Console help and the chosen Expo SDK, and record the findings in docs/VERIFICATION.md.
  Answer:
- [ ] **Verify Supabase Realtime authorization (H26)** — private-channel/RLS design depends on the current docs — read https://supabase.com/docs/guides/realtime/authorization and record constraints before E3-001/E4-001.
  Answer:
- [ ] **Verify Apple 1.2 NCII update (H27)** — the 2026-10-16 extension is UNVERIFIED — re-read the current guideline text and update docs/COMPLIANCE.md before E13-005.
  Answer:
- [ ] **Verify Supabase/LiveKit/email/EAS pricing (H28)** — budgets need current quotes — collect official pricing at target volume and attach links to the cost model.
  Answer:

## Cleanup (non-blocking)

- [ ] **Remove unused Next.js starter SVGs (H29)** — `public/next.svg`, `vercel.svg` and similar appear unreferenced — confirm with a reference search, then delete in E0-007.
  Answer:
