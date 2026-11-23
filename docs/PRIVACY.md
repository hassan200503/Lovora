# Privacy and data map

Status: internal working document, not the public privacy policy. Legal review is required (H7/H8); Kenya ODPC positions are **unverified**. Do not publish until counsel signs off.

## Principles

- Collect the minimum needed to run a private two-person space.
- No ads, no tracking, no sale of personal data.
- Private by default; sharing between the two members is explicit; public profiles are opt-in.
- Users can export and delete their data in-app.
- Notification previews can be content-free; presence and last-seen have controls.
- AI receives only the minimum context needed for a request and is metered; content is not used for training by us.

## Data inventory

| Category | Examples | Purpose | Where | Retention (proposed) | Access |
| --- | --- | --- | --- | --- | --- |
| Account | Email, display name, auth id, avatar | Sign-in, identity, support | Postgres (`people`) | Until deletion + 30-day grace | User, support (break-glass) |
| Auth identities | Google subject id, verified email, provider timestamps | Google sign-in linking | Postgres (`auth_identities`) | Until unlinked or deletion | User, support |
| Recovery codes | One-way hash of the offline code | Account recovery | Postgres (`people.recovery_hash`) | Until rotated or deletion | None (hash only) |
| Email recovery | Email, HMAC code hash, salt, IP hash, attempt count, expiry | Password reset verification | Postgres (`email_otps`) | Removed by the next recovery sweep after 24 hours | Security/support (metadata) |
| Couple | Couple id, member roles, start date, world names, time zone, topics | Personalisation, rituals | Postgres | Until deletion | Both members |
| Invitations | Email/token hash, expiry, inviter | Partner linking | Postgres | 30 days after expiry/use | Inviter, support |
| Messages | Text, media refs, replies, reactions, receipts, typing (ephemeral) | Core communication | Postgres + Storage | Until user deletion (configurable retention post-launch) | Couple |
| Calls | Participants, timestamps, duration, outcome; no content/recording | History, missed calls | Postgres | 90 days (history), signals minutes | Couple |
| Media | Photos, videos, songs, voice notes, thumbnails, EXIF-stripped metadata | Gallery/chat/rooms | Storage + metadata | Until deletion; purge within grace | Couple |
| Memories/story | Text, dates, linked media, plans | Shared history | Postgres | Until deletion | Couple (public only if opted in) |
| Personal world | Journal, skills, projects, radar, learning | Personal features | Postgres | Until deletion; private by default | Owner (+partner only if shared) |
| Daily answers | Question, answers, reveal time | Ritual | Postgres | Until deletion | Couple after both answer |
| Discovery | Saved items, topics, source preferences | Feed | Postgres | Until deletion | Couple |
| Research | Prompts, answers, threads, citations, quiz | Learning | Postgres | Until deletion | Couple/owner per thread |
| AI usage | Token counts, cost, model, timestamps (no prompt body in logs) | Quotas, billing | Postgres | 12 months | Support/admin aggregate |
| Support/moderation | Reports, evidence, actions, audit log | Safety/legal | Postgres | Per legal schedule | Trained staff, audited |
| Consent | Terms/privacy version, timestamp, 18+ attestation | Compliance proof | Postgres | Life of account + legal hold | Support/legal |
| Technical | IP in server logs (short), device/OS, error traces | Security/diagnostics | Logs/Sentry | 30 days (proposed) | Engineering, restricted |
| Push | Device tokens, platform, preferences | Notifications | Postgres/push provider | Until device removed/account deletion | Owner/support |
| Billing (future) | Plan, payment ids (processor-held card data) | Entitlements | Processor + Postgres ids | Per tax law | Finance/support |

Not collected in v1: precise location, contacts, advertising ids, biometrics, health data, minors' data.

## Purposes and lawful bases (to confirm with counsel)

- **Contract**: providing the account, messaging, calls, rooms, storage and support.
- **Consent**: optional public profile, non-essential notifications, AI features where required, marketing (none planned).
- **Legitimate interests**: security, abuse prevention, service integrity, limited diagnostics — balanced against user rights.
- **Legal obligation**: CSAM reporting, tax, lawful requests, breach notification.
- Kenya Data Protection Act terminology and registration duties are unverified; do not state a lawful basis publicly until reviewed (H7).

## Processors and transfers

| Processor | Data | Purpose | Location/transfer |
| --- | --- | --- | --- |
| Supabase | All app data | DB, auth, storage, realtime | Region chosen at project creation; verify and document |
| Vercel | Web requests/logs | Hosting | Global edge; configure region |
| Expo/EAS | Build artifacts, push tokens | Mobile builds/push | US (verify DPA) |
| Sentry | Error traces, pseudonymous ids | Diagnostics | Configure EU/US region; scrub PII |
| TURN provider | IP/port metadata during calls | Relay | Region-dependent; short-lived |
| Transactional email (Resend or Brevo) | Email address, message subject/body containing a one-time code | Password recovery email | Provider account; verify DPA and region |
| Google Identity (OAuth) | Verified email, name, Google subject id; Google sees the browser IP/device during the redirect | Sign-in/sign-up with Google | Google terms; acts as a separate controller for its own data |
| Google (Gemini/YouTube) | Prompt context; YouTube embeds receive IP/device data | AI research; video playback | Google terms; YouTube embed acts as a separate controller for playback data |
| OpenAlex/iNaturalist/feeds | Public content queries | Discover | Public APIs; no user data beyond request metadata |

Cross-border transfer mechanism for Kenya and other regions is **UNVERIFIED**; needs legal input (H7). Maintain a subprocessor list in the public policy.

## Retention

- Account data: until deletion request + 30-day grace, then purged from live systems.
- Backups: expire on the provider's schedule (document actual PITR window); deleted data is not restored except for disaster recovery, then purged again.
- Calls: metadata 90 days; signalling rows minutes.
- Invitations: 30 days after expiry.
- Moderation/legal records: per legal requirement and counsel.
- Logs: 30 days unless security incident requires longer.
- Exports/deletion jobs: 7 days after delivery/expiry.

## User rights and flows

- **Access/export**: in-app async export (E1-008), secure expiring link, includes relational data and media.
- **Deletion**: in-app on web and native, 30-day grace, partner notified, complete purge (E1-009/E13-004).
- **Correction**: display name/email/settings self-service; support for the rest.
- **Withdraw consent**: disable optional features, delete account.
- **Object/restrict**: contact privacy contact; legal process documented.
- **Unlink/leave**: policy for shared vs personal content defined in E1-010.
- Requests are verified to prevent account takeover; support actions are audited.

## Children

The service is 18+ (E9-004). Age attestation, store ratings and terms must match. If a minor is discovered, suspend and delete per policy and law; do not collect more data to verify age than necessary.

## AI-specific privacy

- Prompts/responses are stored for the couple's threads; do not send partner-private content into a shared thread without consent.
- Provider retention/training terms must be reviewed; prefer configurations that do not train on submitted data.
- Usage logs exclude prompt bodies; cost accounting uses counts.
- Optional BYO key is encrypted at rest, never shown again, and deletions remove it.
- Output moderation may send content to a moderation provider; disclose it.

## Cookies and web storage

- Essential: session/auth cookies, CSRF protections, local preferences.
- No advertising or cross-site tracking cookies in v1.
- If analytics are added, they must be privacy-respecting, disclosed, and consent-gated where required.

## Security of processing

Access control, encryption in transit, provider at-rest encryption, RLS, signed URLs, audit logs, least-privilege support, incident response. See `docs/SECURITY.md`.

## Contact and changes

- Privacy contact: _placeholder, needs a real address (H5/H8)_.
- Policy versioning and re-consent on material change (E9-004).
- This document must not be published as-is; it is an engineering input to the legal policy.

## Open questions

1. Primary data region and Kenya transfer basis (H7).
2. Whether message/media retention should default shorter and be user-configurable.
3. Whether to offer E2E encryption for messages/media post-launch (major architecture change; would limit server-side search/AI).
4. AI provider data-retention settings and whether a DPA is available.
5. Store-required disclosures for YouTube embeds and push providers.
