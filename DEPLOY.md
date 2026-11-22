# Deploying Lovora for free (no credit card)

Hosting: **Neon** (Postgres), **Vercel Hobby** (the website — free, no card, personal non-commercial use) and **GitHub Actions** (the scheduled trend refresh). Netlify works too (netlify.toml is included), but the Netlify team used for RentManager had run out of free credits in September 2026, which pauses production deploys.

## Quickest path: Vercel

1. Sign in at vercel.com with GitHub.
2. **Add New → Project →** import your copy of this repository (allow Vercel access to it). Set **Root Directory** to `apps/web`; Vercel installs the pnpm workspace from the repo root and builds the web app.
3. Add one environment variable, `DATABASE_URL` (the Neon pooled string). Session cookies are signed with a key derived from it, so nothing else is required.
4. Deploy. Every push to `main` redeploys automatically, and each build applies any new database migrations first (`pnpm vercel-build`), so new features never run ahead of their tables.
5. Set `APP_URL` to the public origin (for example `https://lovora-app.vercel.app`, no trailing slash). It is used in emailed links and the Google redirect.

### Password recovery by email (about 10 minutes)

Without an email provider, recovery still works with the one-time code saved at sign-up, and `/recover` shows that form only. Adding a provider turns on the 6-digit email flow; the saved code stays as an offline fallback.

Pick **one** provider. Both are supported behind the same mailer; the app chooses `EMAIL_PROVIDER`, or the provider whose API key is present.

**Brevo (easiest without a domain, free 300/day).** Sign up at brevo.com → **Senders, Domains & IPs → Senders** → add and verify the address you will send from → **SMTP & API → API Keys** → create a v3 API key. In Vercel add:

- `EMAIL_PROVIDER=brevo`
- `BREVO_API_KEY=<the v3 key>`
- `EMAIL_FROM=Lovora <the-verified-sender@example.com>`

Brevo works with a verified single sender; a custom domain (with SPF/DKIM) improves deliverability and lets you use `no-reply@yourdomain`.

**Resend (needs a verified domain, free 100/day).** Sign up at resend.com → **Domains** → add your domain and publish the DNS records it shows (SPF/DKIM; DMARC recommended) → wait for **Verified** → **API Keys** → create a sending key. In Vercel add:

- `EMAIL_PROVIDER=resend`
- `RESEND_API_KEY=<the key>`
- `EMAIL_FROM=Lovora <no-reply@yourdomain>`

Use `onboarding@resend.dev` only for a quick test to the account owner's own address; it cannot send to arbitrary recipients.

Redeploy after adding the variables. Locally, no key means the code is printed to the server console instead of emailed. The recovery page enables the email flow only when the provider, key and sender are all present.

Codes are 6 digits, expire in 10 minutes, allow five guesses, can be resent after 60 seconds, and are stored only as a keyed hash with a random salt. Requesting a code for an unknown address returns the same message and sends nothing. A successful reset rotates the recovery code and signs out every other device.

### Sign in and sign up with Google (about 10 minutes)

The Google buttons stay hidden until both credentials are set, so it is safe to deploy before this step.

1. Open console.cloud.google.com and create (or select) a project.
2. **APIs & Services → OAuth consent screen**: choose **External**, set the app name, user-support email and developer contact, and keep the default basic scopes (`openid`, `email`, `profile`). If the app stays in **Testing**, add each Google account under **Test users**. When ready for anyone, press **Publish app**.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.**
   - Authorized JavaScript origins: `https://your-domain` (optional for this server-side flow).
   - Authorized redirect URIs, exactly: `https://your-domain/api/auth/google/callback` and, for local development, `http://localhost:3000/api/auth/google/callback`.
4. Copy the client ID and client secret into Vercel:
   - `GOOGLE_CLIENT_ID=...`
   - `GOOGLE_CLIENT_SECRET=...`
   - `APP_URL=https://your-domain` (no trailing slash)
5. Redeploy and open `/login` or `/welcome`. The Google button appears.

The redirect URI must match character for character (scheme, host, path, no trailing slash). If `APP_URL` is wrong, Google returns `redirect_uri_mismatch`. `GOOGLE_REDIRECT_URI` can override the computed URI when a proxy or preview domain needs it.

The flow uses PKCE and a signed, httpOnly state cookie. Google's ID token is verified server-side against Google's published keys, and the email must be verified. An existing account with that verified email is linked automatically; a new user first completes a short onboarding form (name, world, theme, interests), so no half-configured account is created. Accounts created this way have no password until one is set in **Settings → Account**.

### Calls on mobile data (recommended, free, about 5 minutes)

Calls connect directly between the two phones. On some mobile networks both ends sit behind strict NATs and need a relay (TURN) in the middle. Without one, calls still work on most Wi-Fi and many mobile networks; with one, they connect everywhere.

**Easiest: in the app.** Create a free relay, then paste its two values in **Settings → Call relay** and press **Save relay**. The app checks them with the provider before saving, stores them encrypted, and **Test from this device** proves a relayed connection works from the phone you're holding. No redeploy needed; the next call uses it.

| Provider (free tier) | Where to get it | The two values |
| --- | --- | --- |
| Metered / Open Relay | metered.ca → sign up → **TURN Server** → create an app | the app domain (e.g. `yourapp.metered.live`) and its API key |
| Cloudflare Realtime TURN | dash.cloudflare.com → **Realtime** → **TURN Server** → Create | the Turn Token ID and API token |
| Any TURN server | your own | `turn:`/`turns:` addresses, username, password |

**Or as Vercel environment variables** (Project → Settings → Environment Variables, then redeploy). They take priority over the in-app setting:

| Provider | Variables |
| --- | --- |
| Metered | `METERED_TURN_DOMAIN`, `METERED_TURN_API_KEY` |
| Cloudflare | `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_API_TOKEN` |
| Any TURN server | `TURN_URLS` (comma-separated `turn:`/`turns:` URLs), `TURN_USERNAME`, `TURN_CREDENTIAL` |

Credentials stay on the server; browsers get short-lived ones from `/api/call/ice`.

Until you add your own, calls fall back to Metered's free public relay (Open Relay). It's shared and best-effort, so it may be busy or unavailable; your own free relay is what makes calls reliable. Set `TURN_PUBLIC_FALLBACK=off` to disable the fallback. When a call can't connect, the call screen says why (for example, that the networks need a relay), and **Settings → Call relay → Test from this device** shows what the phone can reach.

### AI research (free Gemini key)

**Research** (`/research`) uses Google's Gemini API. Create a free key at aistudio.google.com → **Get API key**, then either paste it once in **Settings → AI research** (checked with Google, stored encrypted, shared by both of you) or set `GEMINI_API_KEY` in Vercel and redeploy. Optional: `GEMINI_MODELS`, a comma-separated list of models to try in order (the defaults are current Flash models, with Flash-Lite as the fallback).

On a free key, Google Search grounding may not be available and busy models sometimes answer "high demand". Research copes: studies come from OpenAlex (free, no key), each model is tried in turn, and every answer says what it was based on.

### Gallery: live YouTube search (free key)

**Gallery** (`/gallery`) has a live YouTube search box and five horizontal shelves — Movies, Music, Shorts, Animation and News — plus one-tap **Add** into the shared gallery. The summary card shows real counts by kind and by shelf, and opens `/gallery/all` for the full gallery. Create a key: console.cloud.google.com → **APIs & Services → Library** → enable **YouTube Data API v3** → **Credentials → Create credentials → API key** (restrict it to the YouTube Data API). Add `YOUTUBE_API_KEY` in Vercel → Project → Settings → Environment Variables (Production) and redeploy. Optional: `YOUTUBE_REGION_CODE` (defaults to `KE`).

The free tier is 10,000 units/day. A search costs 100 units; results are requested with only the fields the cards render, and the first card paints before duration and views arrive from a second, 1-unit details call. Everything is cached globally for 30 minutes, so both of you — and repeat visits — share the same upstream calls. If the daily limit is reached, the panel explains it and recovers when Google's quota resets. Videos stay on YouTube's privacy-enhanced player; nothing is downloaded.

### Call alerts when the site is closed

Nothing to configure: push keys are derived from `DATABASE_URL` (or `SESSION_SECRET`). After signing in on each phone or computer, tap **Turn on notifications** when asked (or later in **Settings → Calls & alerts**). From then on calls ring and messages pop up on that device even when the site is closed or you've signed out. On an iPhone, first open the site in Safari → Share → **Add to Home Screen**, then sign in from the Home Screen app and turn alerts on there.

> Free-tier limits change. Before relying on them, re-check each provider's current pricing page: Neon's free plan, Netlify's free plan (function timeouts, build minutes), and GitHub Actions minutes for **private** repositories.

## 1. Database: Neon

1. Sign up at neon.tech with GitHub (no card).
2. Create a project, then copy the **pooled** connection string (`…-pooler…/neondb?sslmode=require`).
3. From your machine, run the migrations, seed, passwords and first ingest against it:

   ```bash
   export DATABASE_URL="postgres://…"
   pnpm db:migrate
   pnpm seed
   pnpm passwords --reuse   # applies the passwords already in PASSWORDS.local.md
   pnpm ingest --force
   ```

   `PASSWORDS.local.md` (git-ignored) holds each person's email and password. Leave out `--reuse` to issue fresh ones. Give your partner theirs privately; either of you can change your own password later in Settings → Account.

Neon's free compute scales to zero when idle, so the first visit after a quiet spell takes a second or two longer. Unlike Render's free Postgres, your data is not deleted.

## 2. Website: Netlify

1. Push this repository to a **private** GitHub repo.
2. In Netlify, choose **Add new site → Import from Git** and select the repo. Set **Base directory** to `apps/web` so Netlify finds `apps/web/netlify.toml`; Netlify detects Next.js automatically.
3. Under **Site configuration → Environment variables**, add:
   - `DATABASE_URL`: the Neon pooled string
   - `SESSION_SECRET`: 32+ random characters (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`)
   - `CRON_SECRET`: another random string (only needed if you use the HTTP trigger)
4. Deploy. You get a free `*.netlify.app` address; a custom domain is optional and is the only thing here that costs money.

## 3. Live trends: GitHub Actions

`.github/workflows/ingest.yml` runs every 2 hours. It checks out the code and runs `pnpm ingest` directly against Neon, so no web-function timeout applies.

1. In GitHub, go to **Settings → Secrets and variables → Actions** and add `DATABASE_URL`.
2. Open **Actions → Ingest trends → Run workflow** once to confirm it works.

Each run takes about 2 minutes, roughly 720 minutes a month at this schedule. Keep that inside your private-repo free minutes; if you need headroom, change the cron to every 3 hours. As a backup, the site also refreshes due sources on its own when a visitor arrives after a gap.

### Optional HTTP trigger

`GET/POST /api/cron/ingest` with `Authorization: Bearer $CRON_SECRET` runs one short (8-second) batch. Any source it doesn't reach stays due for the next call. A free cron-job.org job can call it hourly as a second heartbeat.

## Costs

Nothing in this setup costs money. The only optional paid item is a custom domain.
