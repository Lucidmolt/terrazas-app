# Terrazas.app - Infrastructure & Backend Upgrade Plan

## 💠 Phase 1: The "Brain" (Supabase Schema)
- [ ] **Table: `profiles`**: Extended user data (Customer/Provider flag).
- [ ] **Table: `providers`**: 
    - Google Place ID (for verification)
    - Rating (synced from Google)
    - Phone Number (Twilio target)
    - Active Status / Zip Codes served.
- [ ] **Table: `jobs`**: 
    - Status: `broadcast`, `pending_claim`, `active`, `completed`, `cancelled`.
    - Customer ID, Provider ID (null if broadcast).
    - Price, Zip Code, Photo URL.
- [ ] **Table: `claims`**: Log of which providers attempted to claim a job (to analyze speed).

## 💠 Phase 2: Supply-Side Verification (Google Places)
- [ ] Integrate **Google Places Autocomplete** in the Provider Onboarding flow.
- [ ] Implement backend check to fetch/store Rating, Phone, and Website from Google Place ID.
- [ ] Add "Google Verified" badge logic to the UI.

## 💠 Phase 3: The "Race" Engine (Twilio + Magic Links)
- [ ] **Edge Function: `dispatch-job`**:
    - Triggered on new job creation.
    - Queries providers in the zip code.
    - Sends Twilio SMS with a unique `claim_token`.
- [ ] **PWA Route: `/claim/[token]`**:
    - One-click claim logic (atomically update `jobs.provider_id` where `provider_id` is null).
    - Success/Failure UI feedback.

## 💠 Phase 4: Yard Vision™ (Gemini Guardrails)
- [ ] **Edge Function: `analyze-yard`**:
    - Triggered when customer uploads a photo.
    - Uses Gemini 2.0 Flash to detect height/debris.
    - Returns price adjustment suggestion to the UI.

## 💠 Phase 5: Feedback Loop & Reviews
- [ ] **Table: `reviews`**: Rating (1-5), comments, and photo upload.
- [ ] **Post-Job UI**: Automated trigger for customers once job is marked `completed`.
- [ ] **Rating Aggregation**: Database trigger to update a provider's average `rating` in the `providers` table whenever a new review is submitted.

## 💠 Phase 6: Wallet & Payouts (Stripe Connect)
- [ ] Implement Stripe Express onboarding for providers.
- [ ] Payment Intent creation on booking.
- [ ] Transfer payout on "Job Completed" status change.

---
*Target: Move from Static Prototype to Functional Dispatch Engine.*
