# ADR-005 — First-party email auth on Neon

- Status: Accepted (email recovery and Google sign-in extended by ADR-006)
- Date: 2026-11-19
- Supersedes in part: ADR-001 decision to adopt Supabase Auth
- Related: E1-003, H2, H4

## Context

ADR-001 planned Supabase Postgres + RLS + Supabase Auth. The data layer stayed on Neon because the existing Drizzle schema, migrations and tenant tests already run against Neon and PGlite, and a second database vendor adds migration risk without changing the tenancy guarantees. That left the auth question open: managed auth (Supabase) or first-party auth on the same database.

Shipping required working sign-up, sign-in, invitations, recovery and session revocation for thousands of couples — not a two-account pilot.

## Decision

1. **First-party email + password auth, stored in Neon.**
   - `people.email` is unique case-insensitively (partial lower(email) unique index); `people.passwordHash` is bcrypt cost 12.
   - Sessions are signed JWTs (HS256, 30 days) in the httpOnly `lovora_session` cookie with a `ver` claim matched against `people.sessionVersion`; changing a password, recovering an account or signing out everywhere invalidates every existing session.
   - Login errors are generic; authentication runs a dummy bcrypt comparison for unknown emails to reduce timing signals.
   - Attempts are throttled per email and per IP using a database-backed bucket table (`auth_attempts`), so limits survive restarts and work across instances.
2. **Invitations are database rows, not signed links.** Only the SHA-256 hash of the token is stored, links expire after 7 days, are single-use (atomic conditional update), and a new invitation revokes pending ones.
3. **Recovery is a one-time code**, issued at sign-up and regenerable from Settings after re-entering the current password. It is stored only as a SHA-256 hash, is rotated on use, and a successful recovery revokes other sessions. ADR-006 adds email-code recovery and keeps this code as the offline fallback.
4. **No users in Supabase Auth.** Two vendors would mean two identity sources, two session models and an account-claim migration. The demo accounts are migrated in place by `pnpm seed`; there are no public users yet, so no claim flow is required.

## Consequences

- Account and invitation tables are covered by the same migrations, composite foreign keys and tenant tests as the rest of the product.
- Email recovery and Google sign-in are implemented in ADR-006; provider credentials and a verified sender are still deployment tasks (H4, H32).
- Session revocation is immediate for our own JWT checks, but the JWT secret must be rotated if it leaks; rotate `SESSION_SECRET` to sign out every session.
- If Supabase Auth is ever reconsidered, treat it as a migration with a claim path, not a drop-in: passwords are bcrypt hashes and sessions are custom.
- RLS is still the defense-in-depth goal for a managed Postgres; until then tenancy is enforced in the application layer (`ctxFor`, `visibleTo`, tenant tests).
