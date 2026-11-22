# ADR-006 — Email-code recovery and Google sign-in

- Status: Accepted
- Date: 2026-11-21
- Related: ADR-005, H4; migration `0018_supreme_wind_dancer.sql`

## Context

ADR-005 shipped first-party email + password auth with a one-time recovery code. That code was the only way back into an account, and there was no transactional email provider, so a user who lost the code could not recover. The product also needed a low-friction sign-up option, and Google was the requested provider.

Requirements: real email verification for recovery, Google sign-up that does not create half-configured accounts, no account enumeration, no plaintext one-time codes, and safe deployment before provider credentials exist.

## Decision

1. **Email recovery with a 6-digit code.**
   - A provider-agnostic mailer supports **Resend** and **Brevo** (`EMAIL_PROVIDER`, or whichever API key is present). Local development without credentials logs the message to the server console; production requires a sender and key, otherwise the UI keeps the recovery-code form and says email recovery is unavailable.
   - Codes are generated with `crypto.randomInt`, expire after 10 minutes, are single-use and allow five attempts. Only an HMAC-SHA256 hash (keyed from the server secret and scoped to the address) plus a random salt is stored in `email_otps`; the address, a hash of the requesting IP and timestamps are stored for throttling and expiry.
   - Re-requests are limited to one per 60 seconds and the previous unused code is consumed. Per-IP and per-email buckets in `auth_attempts` limit sends and verifications across instances.
   - Responses never say whether an address exists. Unknown addresses get the same success/cooldown message and no email.
   - The saved recovery code remains a fallback and is still rotated on use.
2. **Reset tickets are signed and version-bound.**
   - After a correct code, the server sets a 10-minute httpOnly ticket (HS256 JWT, separate audience) containing the person id and the session version observed at verification.
   - The password update is conditional on that version; a replayed or superseded ticket fails. A successful reset bumps `people.sessionVersion` (signing out other devices), rotates the recovery code, and issues a 10-minute signed continue ticket instead of the session.
   - Signup, invitation acceptance and password reset all defer the session until `/api/auth/continue` is opened from the “I saved it” link. Setting the session inside the action re-renders the page as signed-in, and `/welcome` and `/recover` redirect signed-in visitors, which previously discarded the one-time code before it could be read. The ticket carries the new session version, so a later password change still invalidates it.
3. **Google OAuth 2.0 web-server flow with PKCE.**
   - `/api/auth/google/start` creates a PKCE verifier, state and a signed state cookie, then redirects to Google. The callback exchanges the code server-to-server and verifies the ID token signature, issuer, audience and `email_verified` against Google's JWKS.
   - Accounts link by the stable Google subject first, then by verified lowercase email. `auth_identities` enforces one Google subject per person and one person per subject. A Google account cannot attach to a person that already has a different Google subject.
   - A new Google user gets no account until they submit the short onboarding form (name, world, theme, interests). Accounts created this way have `password_set = false` and no password (a random unusable hash); Settings offers “Set password”.
   - The Google UI and routes are disabled and return a friendly notice until `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.
4. **No third-party JavaScript.** Buttons are ordinary links to our own GET route, so the existing CSP (`form-action 'self'`) and script policy do not change.

## Consequences

- Two new tables (`auth_identities`, `email_otps`) and one column (`people.password_set`) are part of the normal migration path; they carry no `couple_id` and do not affect tenancy queries or the tenant matrix.
- Recovery now depends on email deliverability. A provider outage returns a retry message; the offline recovery code still works, and password reset never silently succeeds without a verified code.
- Google-only accounts gain a new state (`passwordSet = false`). Sign-in via Google works immediately; password sign-in works only after a password is set.
- Residual risks: email account compromise can reset the password (standard for email-based recovery), and there is still no MFA. Google linking relies on verified email matching, which is the provider's guarantee.
- Operational follow-up: verify the sender domain, publish SPF/DKIM/DMARC, add provider keys and Google credentials in Vercel, and test the live flows (H4, H32).
