# Terrazas.app Onboarding Checklist

Follow these steps once you have your new Supabase account:

## 1. Supabase Setup
- **New Project:** Create a project named `Terrazas-App`.
- **Database:** Run the SQL from `terrazas/supabase/migrations/20260511_core_tables.sql`.
- **Auth:** 
  - Enable **Email OTP** (Magic Links) for Customers.
  - Enable **Phone OTP** (SMS) for Pros.
  - Configure Twilio credentials in Supabase Auth settings.
- **Storage:** Create a private bucket named `insurance-documents`.

## 2. Environment Variables (Vercel)
Add these to your Vercel project:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Keep secret)
- `LOCAL_AUDITOR_URL` (Your Mac Studio Tailscale IP + Port 5001)

## 3. Local Auditor
- Run `python3 terrazas/scripts/local_auditor_proxy.py` on your Mac Studio.
- Ensure your Vision model is loaded in LM Studio/Ollama.

## 4. Edge Functions
Deploy the functions in `terrazas/supabase/functions/`:
- `audit-insurance`
- `broadcast-job`
- `claim-job`
