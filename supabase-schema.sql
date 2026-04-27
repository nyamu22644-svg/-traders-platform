-- Run this in your Supabase SQL Editor

-- 0. Create updated_at trigger function
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- 1. Create Users Table (Extends auth.users)
create table if not exists public.users (
  id uuid references auth.users not null primary key,
  email text not null,
  role text default 'user' check (role in ('user', 'admin')),
  deriv_loginid text unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.users
  add column if not exists deriv_loginid text;

create unique index if not exists users_deriv_loginid_unique_idx
  on public.users (deriv_loginid)
  where deriv_loginid is not null;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.prevent_non_admin_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and new.id = auth.uid()
     and old.role is distinct from new.role
     and not public.is_admin() then
    raise exception 'Only admins can change user roles';
  end if;

  return new;
end;
$$;

drop trigger if exists handle_users_updated_at on public.users;
create trigger handle_users_updated_at before update on public.users
  for each row execute procedure public.handle_updated_at();

drop trigger if exists prevent_non_admin_role_change on public.users;
create trigger prevent_non_admin_role_change before update on public.users
  for each row execute procedure public.prevent_non_admin_role_change();

-- 2. Create Sites Table
create table if not exists public.sites (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users not null,
  name text not null,
  type text not null check (type in ('bot_platform', 'smart_trader', 'signal_site')),
  status text default 'draft' check (status in ('draft', 'active', 'suspended', 'maintenance', 'offline')),
  is_public boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

drop trigger if exists handle_sites_updated_at on public.sites;
create trigger handle_sites_updated_at before update on public.sites
  for each row execute procedure public.handle_updated_at();

-- 3. Create Domains Table
create table if not exists public.domains (
  id uuid default gen_random_uuid() primary key,
  site_id uuid not null unique references public.sites on delete cascade,
  domain text not null unique,
  verified boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.domains
  add column if not exists provider text default 'manual';

alter table public.domains
  add column if not exists status text default 'draft';

alter table public.domains
  add column if not exists verification_token text;

alter table public.domains
  add column if not exists verification_record_type text default 'TXT';

alter table public.domains
  add column if not exists verification_record_name text default '_tradesaas-challenge';

alter table public.domains
  add column if not exists verification_record_value text;

alter table public.domains
  add column if not exists dns_record_type text default 'A';

alter table public.domains
  add column if not exists dns_record_name text default '@';

alter table public.domains
  add column if not exists dns_record_value text default '76.76.21.21';

alter table public.domains
  add column if not exists last_verified_at timestamp with time zone;

alter table public.domains
  add column if not exists auto_renew boolean default true;

alter table public.domains
  add column if not exists purchase_price numeric(12,2);

alter table public.domains
  add column if not exists expires_at timestamp with time zone;

alter table public.domains
  add column if not exists provisioning_error text;

update public.domains
set provider = coalesce(provider, 'manual'),
    status = case when verified = true then 'active' else coalesce(status, 'draft') end,
    verification_record_type = coalesce(verification_record_type, 'TXT'),
    verification_record_name = coalesce(verification_record_name, '_tradesaas-challenge'),
    dns_record_type = coalesce(dns_record_type, 'A'),
    dns_record_name = coalesce(dns_record_name, '@'),
    dns_record_value = coalesce(dns_record_value, '76.76.21.21')
where provider is null
   or status is null
   or verification_record_type is null
   or verification_record_name is null
   or dns_record_type is null
   or dns_record_name is null
   or dns_record_value is null;

alter table public.domains
  drop constraint if exists domains_provider_check;

alter table public.domains
  add constraint domains_provider_check
  check (provider in ('manual', 'namecheap', 'namecheap_affiliate', 'porkbun', 'platform_subdomain'));

alter table public.domains
  drop constraint if exists domains_status_check;

alter table public.domains
  add constraint domains_status_check
  check (status in ('draft', 'pending_verification', 'active', 'purchase_pending', 'failed'));

drop trigger if exists handle_domains_updated_at on public.domains;
create trigger handle_domains_updated_at before update on public.domains
  for each row execute procedure public.handle_updated_at();

-- 3b. Domain Purchase Requests Table
create table if not exists public.domain_purchase_requests (
  id uuid default gen_random_uuid() primary key,
  site_id uuid not null references public.sites on delete cascade,
  domain_name text not null,
  provider text not null default 'namecheap' check (provider in ('namecheap')),
  years integer not null default 1 check (years >= 1 and years <= 10),
  registrant_email text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  availability_snapshot jsonb default '{}'::jsonb,
  last_error text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

drop trigger if exists handle_domain_purchase_requests_updated_at on public.domain_purchase_requests;
create trigger handle_domain_purchase_requests_updated_at before update on public.domain_purchase_requests
  for each row execute procedure public.handle_updated_at();

-- 4. Create Site Configs Table
create table if not exists public.site_configs (
  id uuid default gen_random_uuid() primary key,
  site_id uuid not null unique references public.sites on delete cascade,
  theme_color text default '#000000',
  primary_color text default '#000000',
  secondary_color text default '#ffffff',
  site_title text,
  description text,
  logo_url text,
  enabled_modules jsonb default '[]',
  enabled_tools jsonb default '["dashboard", "bot_builder", "free_bots", "analysis", "charts", "d_trader", "signal_center", "money_management", "copy_trader", "fast_trader"]',
  layout_style text default 'default',
  navigation_items jsonb default '[]',
  hero_content jsonb default '{}',
  cta_content jsonb default '{}',
  support_social_links jsonb default '{}',
  total_commission_pct numeric(5,2) default 3,
  platform_commission_pct numeric(5,2) default 20,
  client_commission_pct numeric(5,2) default 80,
  deriv_referral_code text,
  deriv_utm_source text,
  deriv_utm_medium text,
  deriv_utm_campaign text,
  payout_model text default 'platform_collects_and_pays_clients' check (payout_model in ('platform_collects_and_pays_clients', 'deriv_direct_split_if_supported')),
  payout_cycle text default 'monthly' check (payout_cycle in ('weekly', 'monthly')),
  payout_minimum numeric(12,2) default 10,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.site_configs
  add column if not exists enabled_tools jsonb default '["dashboard", "bot_builder", "free_bots", "analysis", "charts", "d_trader", "signal_center", "money_management", "copy_trader", "fast_trader"]';

alter table public.site_configs
  add column if not exists total_commission_pct numeric(5,2) default 3;

alter table public.site_configs
  add column if not exists platform_commission_pct numeric(5,2) default 20;

alter table public.site_configs
  add column if not exists client_commission_pct numeric(5,2) default 80;

alter table public.site_configs
  add column if not exists deriv_referral_code text;

alter table public.site_configs
  add column if not exists deriv_utm_source text;

alter table public.site_configs
  add column if not exists deriv_utm_medium text;

alter table public.site_configs
  add column if not exists deriv_utm_campaign text;

alter table public.site_configs
  add column if not exists payout_model text default 'platform_collects_and_pays_clients';

alter table public.site_configs
  add column if not exists payout_cycle text default 'monthly';

alter table public.site_configs
  add column if not exists payout_minimum numeric(12,2) default 10;

update public.site_configs
set total_commission_pct = coalesce(total_commission_pct, 3),
    platform_commission_pct = coalesce(platform_commission_pct, 20),
    client_commission_pct = coalesce(client_commission_pct, 80)
where total_commission_pct is null or platform_commission_pct is null or client_commission_pct is null;

update public.site_configs
set payout_model = coalesce(payout_model, 'platform_collects_and_pays_clients'),
    payout_cycle = coalesce(payout_cycle, 'monthly'),
    payout_minimum = coalesce(payout_minimum, 10)
where payout_model is null or payout_cycle is null or payout_minimum is null;

update public.site_configs
set enabled_tools = (
  select coalesce(jsonb_agg(tool_id), '[]'::jsonb)
  from jsonb_array_elements_text(coalesce(enabled_tools, '[]'::jsonb)) as tool_id
  where tool_id <> 'commission_center'
)
where coalesce(enabled_tools, '[]'::jsonb) ? 'commission_center';

alter table public.site_configs
  drop constraint if exists site_configs_payout_model_check;

alter table public.site_configs
  add constraint site_configs_payout_model_check
  check (payout_model in ('platform_collects_and_pays_clients', 'deriv_direct_split_if_supported'));

alter table public.site_configs
  drop constraint if exists site_configs_payout_cycle_check;

alter table public.site_configs
  add constraint site_configs_payout_cycle_check
  check (payout_cycle in ('weekly', 'monthly'));

drop trigger if exists handle_site_configs_updated_at on public.site_configs;
create trigger handle_site_configs_updated_at before update on public.site_configs
  for each row execute procedure public.handle_updated_at();

-- 5. Create Audit Logs Table
create table if not exists public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Create Support Tickets Table
create table if not exists public.support_tickets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users not null,
  subject text not null,
  message text not null,
  status text default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

drop trigger if exists handle_support_tickets_updated_at on public.support_tickets;
create trigger handle_support_tickets_updated_at before update on public.support_tickets
  for each row execute procedure public.handle_updated_at();

-- 7. Trading Providers (Global list of supported exchanges/brokers)
create table if not exists public.trading_providers (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  slug text not null unique,
  icon_url text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

drop trigger if exists handle_trading_providers_updated_at on public.trading_providers;
create trigger handle_trading_providers_updated_at before update on public.trading_providers
  for each row execute procedure public.handle_updated_at();

-- 8. Site Trading Settings
create table if not exists public.site_trading_settings (
  id uuid default gen_random_uuid() primary key,
  site_id uuid not null unique references public.sites on delete cascade,
  default_leverage integer default 1,
  allowed_pairs text[] default '{}',
  max_bots_per_user integer default 5,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

drop trigger if exists handle_site_trading_settings_updated_at on public.site_trading_settings;
create trigger handle_site_trading_settings_updated_at before update on public.site_trading_settings
  for each row execute procedure public.handle_updated_at();

-- 9. API Credentials Metadata (No secrets stored here)
create table if not exists public.api_credentials_metadata (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users not null,
  site_id uuid references public.sites on delete cascade,
  provider_id uuid references public.trading_providers not null,
  key_name text not null,
  is_valid boolean default true,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

drop trigger if exists handle_api_credentials_metadata_updated_at on public.api_credentials_metadata;
create trigger handle_api_credentials_metadata_updated_at before update on public.api_credentials_metadata
  for each row execute procedure public.handle_updated_at();

-- 10. Bot Templates
create table if not exists public.bot_templates (
  id uuid default gen_random_uuid() primary key,
  site_id uuid references public.sites on delete cascade,
  name text not null,
  description text,
  strategy_type text not null,
  parameters jsonb default '{}',
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

drop trigger if exists handle_bot_templates_updated_at on public.bot_templates;
create trigger handle_bot_templates_updated_at before update on public.bot_templates
  for each row execute procedure public.handle_updated_at();

-- 11. Commission Rules
create table if not exists public.commission_rules (
  id uuid default gen_random_uuid() primary key,
  site_id uuid references public.sites on delete cascade,
  tier_name text not null,
  maker_fee_pct numeric(5,4) default 0,
  taker_fee_pct numeric(5,4) default 0,
  min_volume numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

drop trigger if exists handle_commission_rules_updated_at on public.commission_rules;
create trigger handle_commission_rules_updated_at before update on public.commission_rules
  for each row execute procedure public.handle_updated_at();

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

alter table public.commission_events
  add column if not exists referral_code text;

alter table public.commission_events
  add column if not exists attribution_id uuid references public.deriv_client_attributions on delete set null;

create unique index if not exists commission_events_site_trade_reference_unique_idx
  on public.commission_events (site_id, trade_reference)
  where trade_reference is not null;

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

-- 16. Enable Row Level Security (RLS)
alter table public.users enable row level security;
alter table public.sites enable row level security;
alter table public.domains enable row level security;
alter table public.domain_purchase_requests enable row level security;
alter table public.site_configs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.support_tickets enable row level security;
alter table public.trading_providers enable row level security;
alter table public.site_trading_settings enable row level security;
alter table public.api_credentials_metadata enable row level security;
alter table public.bot_templates enable row level security;
alter table public.commission_rules enable row level security;
alter table public.commission_events enable row level security;
alter table public.commission_payouts enable row level security;
alter table public.deriv_client_attributions enable row level security;
alter table public.client_payout_destinations enable row level security;

-- 17. Create Policies

-- Users
drop policy if exists "Users can view own profile" on public.users;
create policy "Users can view own profile" on public.users for select using (auth.uid() = id or public.is_admin());
drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile" on public.users for update using (auth.uid() = id or public.is_admin());

-- Sites
drop policy if exists "Users can view own sites or public sites" on public.sites;
create policy "Users can view own sites or public sites" on public.sites for select using (
  public.is_admin()
  OR
  auth.uid() = user_id
  OR is_public = true
);
drop policy if exists "Users can insert own sites" on public.sites;
create policy "Users can insert own sites" on public.sites for insert with check (auth.uid() = user_id or public.is_admin());
drop policy if exists "Users can update own sites" on public.sites;
create policy "Users can update own sites" on public.sites for update using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Users can delete own sites" on public.sites;
create policy "Users can delete own sites" on public.sites for delete using (auth.uid() = user_id or public.is_admin());

-- Domains
drop policy if exists "Users can view own domains or public domains" on public.domains;
create policy "Users can view own domains or public domains" on public.domains for select using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = domains.site_id and (sites.user_id = auth.uid() OR sites.is_public = true))
);
drop policy if exists "Users can insert own domains" on public.domains;
create policy "Users can insert own domains" on public.domains for insert with check (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = domains.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can update own domains" on public.domains;
create policy "Users can update own domains" on public.domains for update using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = domains.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can delete own domains" on public.domains;
create policy "Users can delete own domains" on public.domains for delete using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = domains.site_id and sites.user_id = auth.uid())
);

-- Domain Purchase Requests
drop policy if exists "Users can view own domain purchase requests" on public.domain_purchase_requests;
create policy "Users can view own domain purchase requests" on public.domain_purchase_requests for select using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = domain_purchase_requests.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can insert own domain purchase requests" on public.domain_purchase_requests;
create policy "Users can insert own domain purchase requests" on public.domain_purchase_requests for insert with check (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = domain_purchase_requests.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can update own domain purchase requests" on public.domain_purchase_requests;
create policy "Users can update own domain purchase requests" on public.domain_purchase_requests for update using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = domain_purchase_requests.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can delete own domain purchase requests" on public.domain_purchase_requests;
create policy "Users can delete own domain purchase requests" on public.domain_purchase_requests for delete using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = domain_purchase_requests.site_id and sites.user_id = auth.uid())
);

-- Site Configs
drop policy if exists "Users can view own site configs or public configs" on public.site_configs;
create policy "Users can view own site configs or public configs" on public.site_configs for select using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = site_configs.site_id and (sites.user_id = auth.uid() OR sites.is_public = true))
);
drop policy if exists "Users can insert own site configs" on public.site_configs;
create policy "Users can insert own site configs" on public.site_configs for insert with check (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = site_configs.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can update own site configs" on public.site_configs;
create policy "Users can update own site configs" on public.site_configs for update using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = site_configs.site_id and sites.user_id = auth.uid())
);

-- Audit Logs
drop policy if exists "Users can view own audit logs" on public.audit_logs;
create policy "Users can view own audit logs" on public.audit_logs for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own audit logs" on public.audit_logs;
create policy "Users can insert own audit logs" on public.audit_logs for insert with check (auth.uid() = user_id);

-- Support Tickets
drop policy if exists "Users can view own support tickets" on public.support_tickets;
create policy "Users can view own support tickets" on public.support_tickets for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own support tickets" on public.support_tickets;
create policy "Users can insert own support tickets" on public.support_tickets for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own support tickets" on public.support_tickets;
create policy "Users can update own support tickets" on public.support_tickets for update using (auth.uid() = user_id);

-- Trading Providers (Public read)
drop policy if exists "Anyone can view trading providers" on public.trading_providers;
create policy "Anyone can view trading providers" on public.trading_providers for select using (true);

-- Site Trading Settings
drop policy if exists "Users can view own site trading settings" on public.site_trading_settings;
create policy "Users can view own site trading settings" on public.site_trading_settings for select using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = site_trading_settings.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can insert own site trading settings" on public.site_trading_settings;
create policy "Users can insert own site trading settings" on public.site_trading_settings for insert with check (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = site_trading_settings.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can update own site trading settings" on public.site_trading_settings;
create policy "Users can update own site trading settings" on public.site_trading_settings for update using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = site_trading_settings.site_id and sites.user_id = auth.uid())
);

-- API Credentials Metadata
drop policy if exists "Users can view own api credentials" on public.api_credentials_metadata;
create policy "Users can view own api credentials" on public.api_credentials_metadata for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own api credentials" on public.api_credentials_metadata;
create policy "Users can insert own api credentials" on public.api_credentials_metadata for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own api credentials" on public.api_credentials_metadata;
create policy "Users can update own api credentials" on public.api_credentials_metadata for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own api credentials" on public.api_credentials_metadata;
create policy "Users can delete own api credentials" on public.api_credentials_metadata for delete using (auth.uid() = user_id);

-- Bot Templates
drop policy if exists "Users can view own bot templates" on public.bot_templates;
create policy "Users can view own bot templates" on public.bot_templates for select using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = bot_templates.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can insert own bot templates" on public.bot_templates;
create policy "Users can insert own bot templates" on public.bot_templates for insert with check (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = bot_templates.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can update own bot templates" on public.bot_templates;
create policy "Users can update own bot templates" on public.bot_templates for update using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = bot_templates.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can delete own bot templates" on public.bot_templates;
create policy "Users can delete own bot templates" on public.bot_templates for delete using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = bot_templates.site_id and sites.user_id = auth.uid())
);

-- Commission Rules
drop policy if exists "Users can view own commission rules" on public.commission_rules;
create policy "Users can view own commission rules" on public.commission_rules for select using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = commission_rules.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can insert own commission rules" on public.commission_rules;
create policy "Users can insert own commission rules" on public.commission_rules for insert with check (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = commission_rules.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can update own commission rules" on public.commission_rules;
create policy "Users can update own commission rules" on public.commission_rules for update using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = commission_rules.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can delete own commission rules" on public.commission_rules;
create policy "Users can delete own commission rules" on public.commission_rules for delete using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = commission_rules.site_id and sites.user_id = auth.uid())
);

-- Commission Events
drop policy if exists "Users can view own commission events" on public.commission_events;
create policy "Users can view own commission events" on public.commission_events for select using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = commission_events.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can insert own commission events" on public.commission_events;
create policy "Users can insert own commission events" on public.commission_events for insert with check (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = commission_events.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can update own commission events" on public.commission_events;
create policy "Users can update own commission events" on public.commission_events for update using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = commission_events.site_id and sites.user_id = auth.uid())
);

-- Commission Payouts
drop policy if exists "Users can view own commission payouts" on public.commission_payouts;
create policy "Users can view own commission payouts" on public.commission_payouts for select using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = commission_payouts.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can insert own commission payouts" on public.commission_payouts;
create policy "Users can insert own commission payouts" on public.commission_payouts for insert with check (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = commission_payouts.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can update own commission payouts" on public.commission_payouts;
create policy "Users can update own commission payouts" on public.commission_payouts for update using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = commission_payouts.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can delete own commission payouts" on public.commission_payouts;
create policy "Users can delete own commission payouts" on public.commission_payouts for delete using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = commission_payouts.site_id and sites.user_id = auth.uid())
);

-- Deriv Client Attributions
drop policy if exists "Users can view own deriv attributions" on public.deriv_client_attributions;
create policy "Users can view own deriv attributions" on public.deriv_client_attributions for select using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = deriv_client_attributions.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can insert own deriv attributions" on public.deriv_client_attributions;
create policy "Users can insert own deriv attributions" on public.deriv_client_attributions for insert with check (
  public.is_admin() OR (
    auth.uid() = deriv_client_attributions.user_id
    and exists (select 1 from public.sites where sites.id = deriv_client_attributions.site_id and sites.user_id = auth.uid())
  )
);
drop policy if exists "Users can update own deriv attributions" on public.deriv_client_attributions;
create policy "Users can update own deriv attributions" on public.deriv_client_attributions for update using (
  public.is_admin() OR (
    auth.uid() = deriv_client_attributions.user_id
    and exists (select 1 from public.sites where sites.id = deriv_client_attributions.site_id and sites.user_id = auth.uid())
  )
);
drop policy if exists "Users can delete own deriv attributions" on public.deriv_client_attributions;
create policy "Users can delete own deriv attributions" on public.deriv_client_attributions for delete using (
  public.is_admin() OR (
    auth.uid() = deriv_client_attributions.user_id
    and exists (select 1 from public.sites where sites.id = deriv_client_attributions.site_id and sites.user_id = auth.uid())
  )
);

-- Client Payout Destinations
drop policy if exists "Users can view own payout destinations" on public.client_payout_destinations;
create policy "Users can view own payout destinations" on public.client_payout_destinations for select using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = client_payout_destinations.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can insert own payout destinations" on public.client_payout_destinations;
create policy "Users can insert own payout destinations" on public.client_payout_destinations for insert with check (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = client_payout_destinations.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can update own payout destinations" on public.client_payout_destinations;
create policy "Users can update own payout destinations" on public.client_payout_destinations for update using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = client_payout_destinations.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can delete own payout destinations" on public.client_payout_destinations;
create policy "Users can delete own payout destinations" on public.client_payout_destinations for delete using (
  public.is_admin() OR exists (select 1 from public.sites where sites.id = client_payout_destinations.site_id and sites.user_id = auth.uid())
);

-- 18. Trigger to create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
