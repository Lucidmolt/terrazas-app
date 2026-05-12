# Terrazas.app - Execution Plan (V3)

## 💠 Phase 1: Core Logistics & Premium UI (ACTIVE)
- [x] **Code Segregation**: Logic moved to `terrazas/js/app.js`.
- [x] **Enhanced Glassmorphism**: High-blur backdrops and layered UI.
- [x] **Provider Seeding**: Injected "Green Leaf Pro" (TX) and "West Coast Greens" (CA) into Supabase.
- [x] **Database Readiness**: `is_active` toggle added and filtered in queries.
- [x] **Broadcast Engine**: Implement 15-minute "Claim" window logic and real-time UI countdown.
- [x] **Notification Loop**: Edge Function configured to alert all active pros in the zip code.

## 💠 Phase 2: Functional Verification (STAGING)
- [ ] **Yard Vision™ Pricing Guard**: Use Gemini 2.0 Flash to analyze the user-uploaded yard photo.
    - *Detection*: Identify excessive debris, high grass (>12 inches), or pet waste.
    - *Automated Upcharge*: If "High Growth" or "Debris" is detected, trigger a UI alert: "Condition Detected: +$15 Debris/Growth Fee."
    - *Provider Transparency*: If a user proceeds with a 'Basic' tier despite a 'Severe' scan advice, the broadcast to providers includes a **"Condition Warning: Under-Tired Job"** badge. This allows Pros to make an informed decision on whether to claim it based on the extra effort required.
- [ ] **Smart Route Optimization**: Group jobs by zip code and traffic patterns to maximize provider revenue.
- [ ] **Auto-Billing & Instant Payout**: Stripe Connect integration for fund release upon "Before/After" photo approval.

## 💠 Phase 3: Verification & Compliance
- [ ] **Texas/California License Check**:
    - Texas: Irrigation (TECQ) and Pesticide (TDA) verification.
    - California: C-27 Landscaping Contractor License (CSLB) verification.
- [ ] **Certificate of Insurance (COI) OCR**: Automated OCR to verify "Additionally Insured" status.
- [ ] **Background Checks**: Integration with Sterling or Checkr for provider vetting.

## 💠 Phase 4: Scaling & Growth
- [ ] **Referral Loop**: Discounted first cut for both referrer and new user.
- [ ] **Subscription Model**: Weekly/Bi-weekly "Set and Forget" maintenance.

---
*Last Updated: 2026-05-09 22:15 CDT*
