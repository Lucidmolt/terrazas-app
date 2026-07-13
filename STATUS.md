# Terrazas App — Current State

**Updated: July 13, 2026** · This document reflects the state after the single-business pivot and cleanup pass. It replaces PLAN.md / PLAN_BACKEND.md as the source of truth (those describe the old marketplace vision).

## What this app is now

A booking + quote-request site for **Terrazas Lawn Care & Tree Service** (Liberal, KS):

> **The pre-pivot marketplace version is preserved on the [`marketplace-legacy`](https://github.com/Lucidmolt/terrazas-app/tree/marketplace-legacy) branch** (broadcast/claim race, multi-provider onboarding, SMS claim links, escrow UI, edge functions). The multi-provider data model (Claim, Veto, EscrowHold, tiers, escalation) also remains in the current schema/lib — bypassed, not removed — so the marketplace can be rebuilt on top of this version later.

- **Anyone** can visit the site, check if their zip is served, and either **book lawn mowing at a flat rate** or **request a free quote** for tree removal, trimming, stump grinding, landscaping, sod, irrigation, weed control, or snow removal.
- Every request is **auto-assigned to the Terrazas provider account** — there is no more multi-provider broadcast/claim race. The marketplace data model was kept intact underneath, so re-opening to other landscapers later is a config change, not a rebuild.
- The business runs jobs from the **Pro dashboard** (`/pro`): accept bookings, send quote prices, drive jobs through en-route → in-progress → completed (with photo proof), chat with customers.
- Customers track everything from `/dashboard`: accept/decline quotes, live crew tracking on service day, reviews + tips after completion, recurring mowing plans.
- Payments are **pay-after-service** for now — no money moves through the app (see Launch Blockers).

All business-specific config (name, phone, service list, service-area zips, owner email) lives in **`lib/business.ts`** — edit that file to change services or coverage. The single-business assignment logic is `getBusinessProvider()` in `lib/business-server.ts`.

## Stack

Next.js 15 (App Router) + React 19 · Prisma → Supabase Postgres (data) · Supabase Auth (email OTP) · Resend (email) · Google Maps (geocoding/autocomplete) · web-push (PWA notifications) · Stripe (present but dormant) · Pluggable yard-photo AI (LM Studio / Ollama local, Claude/Gemini cloud).

Supabase is used **only** for auth + file storage. All data access goes through Prisma (`lib/db.ts`). The old parallel SQL schema and Deno edge functions were deleted as dead code.

## The flow (verified end-to-end 2026-07-13)

```
QUOTE SERVICE (tree work, landscaping, …)
customer: /post → describe job + photos + preferred day → submit
   job status: pending_claim  (business notified in-app + email)
owner: /pro feed → sees description/photos → enters price → SEND QUOTE
   job status: pending_approval  (customer notified; NO auto-approve — quotes wait)
customer: /dashboard → Accept Quote ($ total incl. fees) or Decline
   accept → active ("On the schedule")   decline → cancelled (owner notified)

FIXED-PRICE BOOKING (mowing)
customer: /post → scope/lot/urgency/extras → live-priced receipt → submit
   job status: pending_claim
owner: /pro feed → ACCEPT BOOKING → straight to active (no approval round-trip)
   (owner may instead send an adjusted price → same quote-approval path)

SERVICE DAY (both)
owner: On My Way (en_route, customer sees live map) → Start (in_progress)
   → upload after-photo → completed (photo REQUIRED, AI quality audit runs)
customer: review + optional tip
```

State machine rules now enforced server-side (`app/api/jobs/status/route.ts`): only the provider advances work, customers can only cancel (and only before work starts), nothing can be rewound, completion requires an after photo. Quotes never auto-approve (the old 10-minute auto-approve applies only to legacy price-adjustment claims).

## What was done in the 2026-07-13 session

### Deleted (dead code — recoverable from git)
- Pre-Next.js prototypes: `index.html`, `js/app.js`, `provider-signup.html`, `components/HighStakesUI.tsx`
- The abandoned parallel Supabase layer: `supabase/schema.sql`, `supabase/migrations/`, all 5 edge functions (one hardcoded a personal email)
- Dead/demo API routes: `checkout`, `jobs/claim` (legacy unsafe claim), `jobs/confirm`, `economy-ack`, `tos/accept`, `business/search`, `admin/repulse`, `admin/jobs/claim-mock`, `/claim/[token]` page (hardcoded `demo-provider`)
- Customer-dashboard "🧪 Dev Tool" buttons (mock claim, self-advance status), `prisma/dev.db`

### Security fixes
| Severity | Fix |
|---|---|
| **Critical** | Self-serve admin escalation: signup metadata role was copied into the DB unvalidated — anyone could become admin. Now whitelisted to `customer`/`pro`; admin is DB-only. |
| High | `/api/yard-vision` was unauthenticated and could mutate any job's price. Now requires auth; price changes only for the job's owner. |
| High | `/api/provider/optimize-route` returned full job records (exact addresses) for arbitrary job IDs. Now scoped to the provider's own jobs. |
| Med | Reviews/tips accepted arbitrary `providerId`/`customerId` from the request body (rating manipulation). Now derived server-side from the job. |
| Med | Notifications mark-read IDOR (any user could mark anyone's read). Ownership enforced. |
| Med | Upload `folder` path injection — whitelisted. |
| Med | Job status transitions had no state machine (customers could self-complete jobs, statuses could be rewound). Enforced. |
| — | `.env.pull.preview` untracked from git (contained a Vercel OIDC token); `.env.pull.*` gitignored. |

### Bug fixes & wiring
- **Masking bug**: pros were shown block-level-masked addresses for their *own* claimed jobs (Provider-ID vs User-ID confusion in `maskJobsForViewer`). Fixed — the business sees full details of assigned jobs.
- **Body scroll was disabled globally** (`overflow-hidden` on `<body>` for the old fixed-viewport landing) — dashboard/post/pro pages taller than the viewport couldn't scroll. Removed.
- `notifyJobCompleted` + `onJobCompleted` (job-count/tier progression) existed but were never called — wired into completion.
- Recurring-jobs cron existed but was never scheduled — added to `vercel.json` (daily 07:00 UTC).
- Subscriptions zip hardcode bug (always `'67901'` when coords supplied) — fixed.
- Seed data used role `'provider'` which the app never checks (`'pro'`) — seeded pros could never pass role checks. Fixed + normalized existing rows.
- AuthModal stale-state bug that could skip onboarding for new users. Fixed.
- Missing PWA icons (`icon-192/512.png`, `apple-touch-icon.png`) — generated and installed.
- Privacy page personal email (`lucidmolt@icloud.com`) → business email; Terms "Last updated" no longer shows today's date perpetually.
- Email sending consolidated into **one** Resend client (`sendRawEmail` in `lib/email.ts`) — previously 3 clients with 2 different from-address defaults, which is why some emails 401'd after the key rotation. Configure with just `RESEND_API_KEY` + `RESEND_FROM_EMAIL` (restart dev server after changing env).
- Quote dates displayed a day early (UTC/local shift) — fixed.

### Database
- Added `Job.requestType` (`book`|`quote`), `Job.preferredDate`, `Job.timeWindow` (additive `prisma db push`, applied).
- Reworked `prisma/seed.ts`: idempotent upserts — creates the **Terrazas provider** (verified, tier 1, all service-area zips, real phone/bio) owned by `terrazaslawncare@gmail.com`, an **admin** user (`austinapplebee@keatingtractor.com`), and removed the old `@test.com` marketplace demo data. Run with `npm run db:seed`.

## Test accounts (dev database)

| Who | Login | Notes |
|---|---|---|
| Business owner | `terrazaslawncare@gmail.com` | Email OTP works normally. A Supabase auth user was created during testing (with a random throwaway password that was not retained). **Two test emails were sent to this real inbox on Jul 13** ("New quote request — Tree Removal", "New booking — Lawn Mowing") — ignore/delete them. |
| Admin | `austinapplebee@keatingtractor.com` | DB role `admin` (seeded). Log in via OTP. Note: `/admin` page-gating also checks Supabase `user_metadata.role`, which OTP signup won't set — the admin APIs will work; if the page redirects you, we can set the metadata or relax the page gate. |
| Test customer | `test-customer2@gmail.com` | Created during E2E testing; owns the two sample jobs (a quoted tree removal marked "on the schedule", a mowing booking en-route). Password auth; delete when done testing. |
| Your customer test | `afapplebee@gmail.com` | Your original account, kept. Has one legacy pre-pivot job. |

## Launch blockers (in order)

1. **Supabase service-role key is invalid.** The project was migrated to Supabase's new API keys (`sb_publishable_…` anon key works), but `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`/Vercel is the old revoked JWT. **Photo uploads (booking photos, completion proof, disputes) fail until you paste the new `sb_secret_…` key** from Supabase Dashboard → Settings → API. Everything else works without it.
2. **Resend** — reconfigured Jul 13 (working key + `alerts@updates.terrazas.app` verified). If the domain changes again, update `RESEND_API_KEY` + `RESEND_FROM_EMAIL` and restart. Customer-facing emails (quote ready, completed) and business alerts all flow through one sender now.
3. **Decide the production domain.** Code references `terrazas.app` in email links and metadata; the business's chamber listing points to `callterrazas.com`, and `terrazaslawncare.com` no longer resolves. Pick one, set it in Vercel, and we should factor the hardcoded URLs into an env var (`NEXT_PUBLIC_APP_URL`) — currently ~a dozen hardcoded `https://terrazas.app/...` strings in emails/notifications.
4. **Terms of Service rewrite.** `/terms` still describes the marketplace (10-min claim windows, two-tier pros, escrow, 3-veto rule). Needs a single-business rewrite before real customers rely on it. Privacy policy is fine.
5. **Vercel env sync.** Everything above must also be set in Vercel project env (plus `CRON_SECRET` already set). `vercel.json` now has 4 crons — note Vercel Hobby allows only daily crons; all 4 are daily-compatible.

## Known gaps / deliberate deferrals

- **Payments are out of band.** Stripe code exists (intents, refunds, Connect transfers) but nothing charges customers — the UI says "pay after the work is done." When you want in-app payment: wire a checkout step post-quote-acceptance, capture on completion, and delete the payout/escrow machinery or repurpose it. The Stripe webhook has a status-regression bug (`payment_intent.succeeded` resets jobs to `broadcast`) — harmless while dormant, must fix before enabling payments.
- **Payout/escrow/tier system is dormant** (single business = the business pays itself). Earnings tab on /pro shows mock-mode numbers; `clearHeldFunds` has a known early-release bug — irrelevant until multi-provider returns.
- **SMS (Twilio) not configured** — notification cascade falls back to email; `TWILIO_*` env vars are absent. Optional.
- **Yard Vision AI** defaults to a local LM Studio server (dev machine). For production either set `YARD_VISION_PROVIDER=cloud` with an Anthropic/Gemini key or hide the entry card. Quality audit fails-open (any AI error = passing score) — acceptable for now, flagged in code.
- **Announcements feature** ("pros in your area") still exists and works — it's now effectively "Terrazas is in your neighborhood" marketing pings. Harmless; could be surfaced or removed.
- `requireAuth` links Supabase→Prisma users by email rather than the `supabaseId` column; fine at this scale, worth tightening later.
- No automated tests. The E2E walkthrough above was manual (see test accounts). Adding a Playwright happy-path suite would be the next quality investment.

## How to run

```bash
npm install            # postinstall runs prisma generate
npm run dev            # http://localhost:3000
npm run db:seed        # idempotent — safe to re-run; sets up Terrazas provider + admin
npx prisma studio      # browse the database
```

Required env (`.env.local`): `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (⚠️ needs new-format key), `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_GOOGLE_MAPS_KEY`, `GOOGLE_MAPS_API_KEY`, `VAPID_*` (3), `CRON_SECRET`, `YARD_VISION_PROVIDER` (+ provider-specific keys), `STRIPE_*` (dormant).
