# Terrazas.app Production Wiring Plan

## 1. Domain & Infrastructure
- [ ] **Cloudflare CNAME**: Point `terrazas.app` to `cname.vercel-dns.com`.
- [ ] **Vercel Domains**: Add `terrazas.app` to the project in the Vercel dashboard.
- [ ] **SSL Verification**: Ensure Cloudflare proxy (Orange Cloud) is handled (Full/Strict SSL).

## 2. Supabase Backend (Real-Time State)
- [ ] **Project Setup**: Create/Link Supabase project.
- [ ] **Schema Design**:
    - `profiles`: User/Provider metadata.
    - `jobs`: Status, Zip, Client ID, Provider ID, Tier, Price.
    - `providers`: Business info, Rating, Area coverage.
- [ ] **Client SDK**: Integrate `@supabase/supabase-js` into `index.html`.
- [ ] **Real-time**: Enable replication for `jobs` so the client UI updates when a job is claimed.

## 3. Stripe Connect (Payments)
- [ ] **Account Setup**: Configure Stripe Connect for Marketplace (Standard or Express).
- [ ] **Payment Flow**:
    - Frontend creates PaymentIntent.
    - Webhook updates Supabase job status to `paid`.
- [ ] **Payouts**: Automation for splitting fees and paying providers upon job completion.

## 4. Provider Dispatch (Telegram Bot)
- [ ] **Bot Registration**: Create `@TerrazasProviderBot` via BotFather.
- [ ] **Logic Engine**:
    - Listen to Supabase `jobs` inserts (Broadcast).
    - Push alerts to Telegram with "Claim" button.
    - On claim: Update Supabase `provider_id` and notify Client.

## 5. Security & PWA
- [ ] **Auth**: Supabase OTP (One-Time Password) for frictionless login.
- [ ] **PWA Manifest**: Finalize `manifest.json` and service worker for "Add to Home Screen".
