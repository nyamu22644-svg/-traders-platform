-- Migration: Create commission and attribution tables
-- Adds: commission_events, deriv_client_attributions, commission_payouts, client_payout_destinations

-- 12. Commission Events (partner feed level records)
create table if not exists public.commission_events (
  id uuid default gen_random_uuid() primary key,
  site_id uuid not null references public.sites on delete cascade,
  client_loginid text,
  trade_reference text,
  referral_code text,
  attribution_id uuid,
  source text default 'deriv',
  currency text default 'USD',
  gross_commission numeric(18,8) not null default 0,
  total_commission_pct numeric(5,2) not null default 3,
  platform_share_pct numeric(5,2) not null default 20,
  client_share_pct numeric(5,2) not null default 80,
  platform_amount numeric(18,8) not null default 0,
  client_amount numeric(18,8) not null default 0,
  status text default 'pending' check (status in ('pending', 'confirmed', 'reversed', 'paid_out')),
  occurred_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

drop trigger if exists handle_commission_events_updated_at on public.commission_events;
create trigger handle_commission_events_updated_at before update on public.commission_events
  for each row execute procedure public.handle_updated_at();

-- 13. Deriv Client Attribution (site-level mapping for partner commissions)
create table if not exists public.deriv_client_attributions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.users on delete cascade,
  site_id uuid not null references public.sites on delete cascade,
  client_loginid text not null,
  referral_code text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  source text default 'oauth',
  is_active boolean default true,
  last_seen_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (site_id, client_loginid)
);

create index if not exists deriv_client_attributions_loginid_idx
  on public.deriv_client_attributions (client_loginid);

create index if not exists deriv_client_attributions_referral_code_idx
  on public.deriv_client_attributions (referral_code)
  where referral_code is not null;

drop trigger if exists handle_deriv_client_attributions_updated_at on public.deriv_client_attributions;
create trigger handle_deriv_client_attributions_updated_at before update on public.deriv_client_attributions
  for each row execute procedure public.handle_updated_at();

-- 14. Commission Payouts (client settlement records)
create table if not exists public.commission_payouts (
  id uuid default gen_random_uuid() primary key,
  site_id uuid not null references public.sites on delete cascade,
  client_loginid text,
  period_start date,
  period_end date,
  currency text default 'USD',
  total_client_amount numeric(18,8) not null default 0,
  total_platform_amount numeric(18,8) not null default 0,
  payout_model text default 'platform_collects_and_pays_clients' check (payout_model in ('platform_collects_and_pays_clients', 'deriv_direct_split_if_supported')),
  payout_cycle text default 'monthly' check (payout_cycle in ('weekly', 'monthly')),
  status text default 'scheduled' check (status in ('scheduled', 'processing', 'paid', 'failed', 'cancelled')),
  external_reference text,
  paid_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

drop trigger if exists handle_commission_payouts_updated_at on public.commission_payouts;
create trigger handle_commission_payouts_updated_at before update on public.commission_payouts
  for each row execute procedure public.handle_updated_at();

-- 15. Client Payout Destinations
create table if not exists public.client_payout_destinations (
  id uuid default gen_random_uuid() primary key,
  site_id uuid not null references public.sites on delete cascade,
  client_loginid text not null,
  payout_method text default 'manual' check (payout_method in ('manual', 'crypto_wallet', 'bank_account', 'mobile_money')),
  destination_label text,
  destination_value text,
  notes text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (site_id, client_loginid)
);

drop trigger if exists handle_client_payout_destinations_updated_at on public.client_payout_destinations;
create trigger handle_client_payout_destinations_updated_at before update on public.client_payout_destinations
  for each row execute procedure public.handle_updated_at();

-- Notify PostgREST to reload schema cache
notify pgrst, 'reload schema';
