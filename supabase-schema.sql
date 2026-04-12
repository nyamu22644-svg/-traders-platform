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
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

drop trigger if exists handle_users_updated_at on public.users;
create trigger handle_users_updated_at before update on public.users
  for each row execute procedure public.handle_updated_at();

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

drop trigger if exists handle_domains_updated_at on public.domains;
create trigger handle_domains_updated_at before update on public.domains
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
  enabled_tools jsonb default '["dashboard", "bot_builder", "fast_trader"]',
  layout_style text default 'default',
  navigation_items jsonb default '[]',
  hero_content jsonb default '{}',
  cta_content jsonb default '{}',
  support_social_links jsonb default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

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

-- 12. Enable Row Level Security (RLS)
alter table public.users enable row level security;
alter table public.sites enable row level security;
alter table public.domains enable row level security;
alter table public.site_configs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.support_tickets enable row level security;
alter table public.trading_providers enable row level security;
alter table public.site_trading_settings enable row level security;
alter table public.api_credentials_metadata enable row level security;
alter table public.bot_templates enable row level security;
alter table public.commission_rules enable row level security;

-- 13. Create Policies

-- Users
drop policy if exists "Users can view own profile" on public.users;
create policy "Users can view own profile" on public.users for select using (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile" on public.users for update using (auth.uid() = id);

-- Sites
drop policy if exists "Users can view own sites or public sites" on public.sites;
create policy "Users can view own sites or public sites" on public.sites for select using (auth.uid() = user_id OR is_public = true);
drop policy if exists "Users can insert own sites" on public.sites;
create policy "Users can insert own sites" on public.sites for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own sites" on public.sites;
create policy "Users can update own sites" on public.sites for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own sites" on public.sites;
create policy "Users can delete own sites" on public.sites for delete using (auth.uid() = user_id);

-- Domains
drop policy if exists "Users can view own domains or public domains" on public.domains;
create policy "Users can view own domains or public domains" on public.domains for select using (
  exists (select 1 from public.sites where sites.id = domains.site_id and (sites.user_id = auth.uid() OR sites.is_public = true))
);
drop policy if exists "Users can insert own domains" on public.domains;
create policy "Users can insert own domains" on public.domains for insert with check (
  exists (select 1 from public.sites where sites.id = domains.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can update own domains" on public.domains;
create policy "Users can update own domains" on public.domains for update using (
  exists (select 1 from public.sites where sites.id = domains.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can delete own domains" on public.domains;
create policy "Users can delete own domains" on public.domains for delete using (
  exists (select 1 from public.sites where sites.id = domains.site_id and sites.user_id = auth.uid())
);

-- Site Configs
drop policy if exists "Users can view own site configs or public configs" on public.site_configs;
create policy "Users can view own site configs or public configs" on public.site_configs for select using (
  exists (select 1 from public.sites where sites.id = site_configs.site_id and (sites.user_id = auth.uid() OR sites.is_public = true))
);
drop policy if exists "Users can insert own site configs" on public.site_configs;
create policy "Users can insert own site configs" on public.site_configs for insert with check (
  exists (select 1 from public.sites where sites.id = site_configs.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can update own site configs" on public.site_configs;
create policy "Users can update own site configs" on public.site_configs for update using (
  exists (select 1 from public.sites where sites.id = site_configs.site_id and sites.user_id = auth.uid())
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
  exists (select 1 from public.sites where sites.id = site_trading_settings.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can insert own site trading settings" on public.site_trading_settings;
create policy "Users can insert own site trading settings" on public.site_trading_settings for insert with check (
  exists (select 1 from public.sites where sites.id = site_trading_settings.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can update own site trading settings" on public.site_trading_settings;
create policy "Users can update own site trading settings" on public.site_trading_settings for update using (
  exists (select 1 from public.sites where sites.id = site_trading_settings.site_id and sites.user_id = auth.uid())
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
  exists (select 1 from public.sites where sites.id = bot_templates.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can insert own bot templates" on public.bot_templates;
create policy "Users can insert own bot templates" on public.bot_templates for insert with check (
  exists (select 1 from public.sites where sites.id = bot_templates.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can update own bot templates" on public.bot_templates;
create policy "Users can update own bot templates" on public.bot_templates for update using (
  exists (select 1 from public.sites where sites.id = bot_templates.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can delete own bot templates" on public.bot_templates;
create policy "Users can delete own bot templates" on public.bot_templates for delete using (
  exists (select 1 from public.sites where sites.id = bot_templates.site_id and sites.user_id = auth.uid())
);

-- Commission Rules
drop policy if exists "Users can view own commission rules" on public.commission_rules;
create policy "Users can view own commission rules" on public.commission_rules for select using (
  exists (select 1 from public.sites where sites.id = commission_rules.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can insert own commission rules" on public.commission_rules;
create policy "Users can insert own commission rules" on public.commission_rules for insert with check (
  exists (select 1 from public.sites where sites.id = commission_rules.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can update own commission rules" on public.commission_rules;
create policy "Users can update own commission rules" on public.commission_rules for update using (
  exists (select 1 from public.sites where sites.id = commission_rules.site_id and sites.user_id = auth.uid())
);
drop policy if exists "Users can delete own commission rules" on public.commission_rules;
create policy "Users can delete own commission rules" on public.commission_rules for delete using (
  exists (select 1 from public.sites where sites.id = commission_rules.site_id and sites.user_id = auth.uid())
);

-- 14. Trigger to create user profile on signup
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
