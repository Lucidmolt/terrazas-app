-- Terrazas.app Core Schema Update

-- 1. Jobs Table
create table jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users(id),
  service_type text not null, -- 'Mowing', 'Cleanup', 'Tree Removal'
  zip_code text not null,
  address text not null,
  estimated_pay decimal(10,2),
  required_risk_tier integer default 1,
  status text default 'available', -- 'available', 'pending_confirmation', 'claimed', 'completed', 'cancelled'
  claimed_by uuid references pro_profiles(id),
  eta_minutes integer,
  pending_pro_id uuid references pro_profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Payouts/Transactions Table
create table transactions (
  id uuid primary key default gen_random_uuid(),
  pro_id uuid references pro_profiles(id),
  job_id uuid references jobs(id),
  amount decimal(10,2) not null,
  type text not null, -- 'job_pay', 'tip', 'refund'
  stripe_transfer_id text,
  status text default 'pending', -- 'pending', 'paid', 'failed'
  created_at timestamptz default now()
);

-- Enable Real-time for these tables
alter publication supabase_realtime add table jobs;
alter publication supabase_realtime add table transactions;

-- 3. Atomic Job Claim Function (with ETA Negotiation)
create or replace function claim_job(p_job_id uuid, p_pro_id uuid, p_eta integer)
returns json as $$
declare
  v_status text;
begin
  select status into v_status from jobs where id = p_job_id for update;

  if v_status != 'available' then
    return json_build_object('success', false, 'message', 'Job is no longer available');
  end if;

  update jobs 
  set 
    status = 'pending_confirmation', 
    pending_pro_id = p_pro_id,
    eta_minutes = p_eta,
    updated_at = now()
  where id = p_job_id;

  return json_build_object('success', true, 'message', 'ETA sent to customer for approval');
end;
$$ language plpgsql security definer;

-- 4. Customer Confirmation Function
create or replace function confirm_pro(p_job_id uuid, p_approved boolean)
returns json as $$
declare
  v_pending_pro uuid;
begin
  select pending_pro_id into v_pending_pro from jobs where id = p_job_id for update;

  if p_approved then
    update jobs set status = 'claimed', claimed_by = v_pending_pro, pending_pro_id = null where id = p_job_id;
    return json_build_object('success', true, 'message', 'Pro confirmed');
  else
    update jobs set status = 'available', pending_pro_id = null, eta_minutes = null where id = p_job_id;
    return json_build_object('success', true, 'message', 'Job rebroadcast');
  end if;
end;
$$ language plpgsql security definer;
