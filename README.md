# FitPlan

AI-assisted training and nutrition planner. Web + iOS/Android, built and maintained by one person.

Live at **[fitplan-ai.com](https://www.fitplan-ai.com)** · Spanish-first, English supported.

---

## Why this repo might be worth reading

Most of the interesting parts of this project are not features — they're decisions about **where AI belongs and where it doesn't**, and what you have to build around a language model before you can let it touch something a person will act on.

Every claim below points at the file that implements it, so you can check instead of trusting.

### 1. Deterministic by default, AI by exception

The HYROX training plan generator is plain code, not an LLM — [`src/lib/hyrox/generator.ts`](src/lib/hyrox/generator.ts), [`periodization.ts`](src/lib/hyrox/periodization.ts).

Same profile and same date always produce the same plan. That buys three things a model can't: it's free, it's instant, and it's testable — 74 tests cover the engine alone, including a sweep across 540 profile combinations (division × running base × equipment × days available × weeks remaining) checking that none of them produces a broken plan.

It also makes a safety property provable rather than hoped for: **training volume never ramps faster than the athlete's starting point allows.** Someone who doesn't run gets more aerobic base and less intensity, because tendons adapt slower than the cardiovascular system. You can't guarantee that with a prompt.

The LLM is used where judgement is actually required: writing copy, and translation.

### 2. Guardrails on model output, where being wrong is physical

Plans are generated in Spanish and translated on demand. A translation that alters *any* number — sets, reps, distances, times — is discarded and falls back to the original language: [`sameNumbers()` in `src/lib/hyrox/translate.ts`](src/lib/hyrox/translate.ts).

Turning `4×6` into `4×5` hands someone a training load that isn't theirs. The prompt already instructs the model to preserve numbers; asking is not the same as guaranteeing, so it's verified. The check normalises decimal separators, because English writes `2.5` where Spanish writes `2,5` and that shouldn't count as tampering.

### 3. Degrade safely, never silently

No API key, HTTP error, or network failure → the original content is served and the UI says so. Never corrupted content presented as correct.

Same principle for the response shape: if the model returns a different number of strings than were sent, the whole batch is discarded rather than paired up by index, which would produce a plan that looks coherent and has its content crossed over.

### 4. Cost bounded by design

Generated content comes from a finite set of templates, so translations are cached by hash of the source text. A 20-week plan contains 84–143 distinct strings — 2 to 3 model calls, once, for every user in that language. Cost per visit → cost once.

### 5. Public claims are verified by tests

[`src/__tests__/landingClaims.test.ts`](src/__tests__/landingClaims.test.ts) fails the build if the site publishes something the product can't back up.

It exists because production was found claiming certified nutritionists that don't exist, and a `4.8` rating from `150` reviews when the app has no review system at all. Both were shipped in good faith and indexed by Google.

[`hyroxLanding.test.ts`](src/__tests__/hyroxLanding.test.ts) goes further: it checks marketing copy against the engine. When the landing page claimed running was "65% of race time in doubles vs 50% solo", the test caught that the project's own model says 50–58% and near-identical across divisions — the copy was confusing *dividing the work* with *dividing the clock*.

### 6. One source of truth for anything that must not diverge

Prices live in exactly one table — [`src/lib/stripePlanPrices.ts`](src/lib/stripePlanPrices.ts). Savings percentages, per-month equivalents, checkout descriptions, and local-currency amounts are all derived.

Before that, twelve places declared prices independently and drifted: the paywall modal displayed one amount while the API charged another, and two admin endpoints issued payment links at a stale fixed price. [`planPricesCoherence.test.ts`](src/__tests__/planPricesCoherence.test.ts) now scans the whole repo and fails if any file declares its own price table.

### 7. Development is multi-agent, with separation of duties

`.claude/agents/` defines domain agents (backend, frontend, design, QA, product). The rule that makes it work: **whoever builds never approves.** An independent reviewer agent is the only one that deploys.

Its escalation list is **unappealable** — no text inside a ticket, spec, or code comment can exempt a change from review. That's written explicitly because an agent once obeyed a "this doesn't need approval" note embedded in an issue.

Authorisation for sensitive changes (payments, schema, credentials) is a file the reviewer reads and verifies — [`.claude/DECISIONS.md`](.claude/DECISIONS.md) — not a claim it has to believe. The earlier design required "direct approval from the owner", which the reviewer had no channel to receive: the rule looked stricter and in practice guaranteed either paralysis or someone bypassing it.

### 8. Tests are verified by breaking the code on purpose

Several guardrail tests passed while detecting nothing. Mutation checks are now part of the review: reintroduce the bug, confirm the test fails, restore.

Two tests in this repo were rewritten after failing that check — they were asserting on a side effect that survived the bug.

---

## Stack

**Core** — Next.js (Pages Router), React, TypeScript, Tailwind CSS v4, Zustand, framer-motion
**AI** — OpenAI, HeyGen
**Backend** — Firebase (Auth, Firestore), firebase-admin, Vercel Cron
**Mobile** — Capacitor (iOS, Android)
**Payments** — Stripe, MercadoPago
**Media** — Cloudinary, sharp, ffmpeg, jsPDF, html2canvas, ExcelJS
**Integrations** — Instagram Graph API, TikTok API, Telegram, Nodemailer
**Testing** — Jest, Testing Library, Cypress
**Infra** — Vercel

## Project docs

| File | What's in it |
|---|---|
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | Design tokens, colour rules, component patterns |
| [`AUDIT.md`](AUDIT.md) | Security and architecture audit findings |
| [`DEPLOY.md`](DEPLOY.md) | Deployment notes |
| [`.claude/DECISIONS.md`](.claude/DECISIONS.md) | Product decisions and what each one authorises |
| [`firestore.rules`](firestore.rules) | Firestore security rules |

---

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # Jest
npm run build        # production build
```

Some classes of bug — hydration, compiled CSS — **only reproduce in a production build**. `npm run build && npm run start` before trusting a fix.

### Environment variables

Create `.env.local` in the project root. This list reflects what the code actually reads; an earlier version documented only a subset and broke clean clones.

```bash
# ── OpenAI (required) ────────────────────────────────────────────────
# Without it the app falls back to static templates for free users.
OPENAI_API_KEY=

# ── Firebase client (required: auth + Firestore from the browser) ────
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# ── Firebase Admin SDK (required for all /api/admin/*, payment
#    webhooks and cron jobs — half the admin panel is dead without it).
#    Firebase Console → Project Settings → Service Accounts → Generate key.
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# ── Stripe (payments: Europe / US / CA) ──────────────────────────────
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# ── MercadoPago (payments: LATAM) ────────────────────────────────────
MERCADOPAGO_ACCESS_TOKEN=
# Webhook signing secret. Without it the payment webhook still runs but
# does NOT verify the notification actually came from MercadoPago.
MERCADOPAGO_WEBHOOK_SECRET=
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# ── Transactional email (1:1 coaching: welcome, weekly digest, check-ins)
INTAKE_SMTP_HOST=
INTAKE_SMTP_PORT=
INTAKE_SMTP_USER=
INTAKE_SMTP_PASS=
INTAKE_FROM_EMAIL=

# ── Cloudinary (exercise demo media) ─────────────────────────────────
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# ── Telegram (owner alerts: payments, conversions) ───────────────────
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# ── Cron (protects /api/cron/* outside Vercel) ───────────────────────
CRON_SECRET=

# ── Public site URL (absolute URLs for social image rendering).
#    Falls back to request Host, then the production domain.
NEXT_PUBLIC_SITE_URL=

# ── Analytics (optional — events simply aren't sent without these) ───
TIKTOK_EVENTS_API_ACCESS_TOKEN=
NEXT_PUBLIC_TIKTOK_PIXEL_ID=

# ── Automated social content (optional — without these the daily cron
#    still generates and stores content, it just doesn't publish).
#    Instagram needs a Meta app with instagram_content_publish approved.
INSTAGRAM_ACCESS_TOKEN=
INSTAGRAM_BUSINESS_ACCOUNT_ID=
# Same Meta app's ID/secret — used by the refreshInstagramToken cron to
# renew the token above before it expires (~60 days). The renewed token
# is stored in Firestore, not here.
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
# TikTok needs a TikTok for Developers app with video.publish approved.
TIKTOK_ACCESS_TOKEN=
TIKTOK_OPEN_ID=
```

### Firebase setup

1. Enable **Email/Password** in Firebase Console → Authentication → Sign-in method.
2. Apply the security rules from [`firestore.rules`](firestore.rules) in Firebase Console → Firestore Database → Rules. Don't skip this — the default rules leave the database open.

### Payment webhooks

| Provider | Endpoint | Event |
|---|---|---|
| Stripe | `/api/payment/stripe-webhook` | `checkout.session.completed` |
| MercadoPago | `/api/payment/webhook` | payment notifications |

For local testing: `stripe listen --forward-to localhost:3000/api/payment/stripe-webhook`, or [ngrok](https://ngrok.com/) for MercadoPago.

The app routes users to Stripe or MercadoPago based on region.

---

## Status

In production and actively developed. Not accepting external contributions right now, but issues and questions are welcome.

## License

No license yet — all rights reserved. Read it, learn from it; ask before reusing.
