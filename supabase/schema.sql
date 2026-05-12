-- =========================================================
-- Terrazas.app — Unified Schema v2
-- Canonical source of truth for all tables.
-- Run this AFTER creating the Supabase project.
-- =========================================================

-- 1. Profiles (Extends Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  user_type TEXT CHECK (user_type IN ('customer', 'provider')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Providers
CREATE TABLE IF NOT EXISTS providers (
  id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  business_name TEXT NOT NULL,
  phone_number TEXT,
  email TEXT,
  google_place_id TEXT,
  rating DECIMAL(3,2),
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  zip_codes TEXT[] DEFAULT '{}',    -- Array of zip codes served
  stripe_connect_id TEXT,
  insurance_status TEXT CHECK (insurance_status IN ('pending', 'verified', 'flagged')) DEFAULT 'pending',
  risk_tier INTEGER DEFAULT 1,      -- 1=Basic, 2=Advanced, 3=Heavy
  insurance_expiry DATE,
  insurance_data JSONB,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Jobs
CREATE TABLE IF NOT EXISTS jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES profiles(id),
  provider_id UUID REFERENCES providers(id),   -- NULL if broadcasting
  status TEXT DEFAULT 'broadcast' CHECK (status IN (
    'broadcast',          -- Active broadcast, waiting for claims
    'pending_claim',      -- A pro sent ETA, waiting for customer approval
    'active',             -- Customer approved the pro
    'en_route',           -- Pro is heading to location
    'in_progress',        -- Pro is working
    'completed',          -- Job done, photos submitted
    'cancelled'           -- Cancelled by customer or system
  )),
  service_type TEXT DEFAULT 'mowing',
  tier TEXT DEFAULT 'basic' CHECK (tier IN ('basic', 'premium')),
  zip_code TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  price DECIMAL(10,2) DEFAULT 45.00,
  photo_before_url TEXT,
  photo_after_url TEXT,
  condition_notes TEXT,               -- Yard Vision AI output
  ai_warning BOOLEAN DEFAULT FALSE,   -- Flag if AI detected bad conditions
  eta_minutes INTEGER,
  pending_pro_id UUID REFERENCES providers(id),  -- Pro who sent ETA
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Claims (Log of the "Race")
CREATE TABLE IF NOT EXISTS claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES providers(id),
  eta_minutes INTEGER DEFAULT 30,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  was_successful BOOLEAN DEFAULT FALSE
);

-- 5. Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE UNIQUE,
  customer_id UUID REFERENCES profiles(id),
  provider_id UUID REFERENCES providers(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  photo_url TEXT,
  tip_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================
-- Row Level Security
-- =========================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read/update their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Providers: Public read for active providers, owners can update
CREATE POLICY "Anyone can view active providers" ON providers
  FOR SELECT USING (is_active = true);
CREATE POLICY "Providers can update own record" ON providers
  FOR UPDATE USING (auth.uid() = id);

-- Jobs: Customers see their own, providers see broadcasts + their claimed jobs
CREATE POLICY "Customers see own jobs" ON jobs
  FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "Providers see broadcast jobs" ON jobs
  FOR SELECT USING (status = 'broadcast');
CREATE POLICY "Providers see their claimed jobs" ON jobs
  FOR SELECT USING (auth.uid() = provider_id);
CREATE POLICY "Authenticated users can create jobs" ON jobs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Claims: Providers can insert claims, read their own
CREATE POLICY "Providers can create claims" ON claims
  FOR INSERT WITH CHECK (auth.uid() = provider_id);
CREATE POLICY "Providers see own claims" ON claims
  FOR SELECT USING (auth.uid() = provider_id);

-- Reviews: Customers can create, public read
CREATE POLICY "Anyone can view reviews" ON reviews
  FOR SELECT USING (true);
CREATE POLICY "Customers can create reviews" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

-- =========================================================
-- Functions
-- =========================================================

-- Atomic Job Claim (prevents race conditions)
CREATE OR REPLACE FUNCTION claim_job(p_job_id UUID, p_pro_id UUID, p_eta INTEGER DEFAULT 30)
RETURNS JSON AS $$
DECLARE
  v_status TEXT;
BEGIN
  -- Lock the row to prevent concurrent claims
  SELECT status INTO v_status FROM jobs WHERE id = p_job_id FOR UPDATE;

  IF v_status IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Job not found');
  END IF;

  IF v_status != 'broadcast' AND v_status != 'available' THEN
    RETURN json_build_object('success', false, 'message', 'Job is no longer available');
  END IF;

  UPDATE jobs
  SET
    status = 'pending_claim',
    pending_pro_id = p_pro_id,
    eta_minutes = p_eta,
    updated_at = NOW()
  WHERE id = p_job_id;

  RETURN json_build_object('success', true, 'message', 'ETA sent to customer for approval');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Customer Confirmation
CREATE OR REPLACE FUNCTION confirm_pro(p_job_id UUID, p_approved BOOLEAN)
RETURNS JSON AS $$
DECLARE
  v_pending_pro UUID;
BEGIN
  SELECT pending_pro_id INTO v_pending_pro FROM jobs WHERE id = p_job_id FOR UPDATE;

  IF v_pending_pro IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'No pending pro for this job');
  END IF;

  IF p_approved THEN
    UPDATE jobs
    SET status = 'active', provider_id = v_pending_pro, pending_pro_id = NULL, claimed_at = NOW(), updated_at = NOW()
    WHERE id = p_job_id;
    RETURN json_build_object('success', true, 'message', 'Pro confirmed');
  ELSE
    UPDATE jobs
    SET status = 'broadcast', pending_pro_id = NULL, eta_minutes = NULL, updated_at = NOW()
    WHERE id = p_job_id;
    RETURN json_build_object('success', true, 'message', 'Job rebroadcast');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-update rating when review is created
CREATE OR REPLACE FUNCTION update_provider_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE providers
  SET rating = (
    SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE provider_id = NEW.provider_id
  ), updated_at = NOW()
  WHERE id = NEW.provider_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER on_review_created
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_provider_rating();

-- Enable Realtime for jobs table
ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
