-- Domains lifecycle fields for secure connect/verify and managed purchases.
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

-- Domain purchase requests for internal resale workflow.
create table if not exists public.domain_purchase_requests (
  id uuid default gen_random_uuid() primary key,
  site_id uuid not null references public.sites on delete cascade,
  domain_name text not null,
  provider text not null default 'namecheap_affiliate' check (provider in ('namecheap', 'namecheap_affiliate', 'porkbun')),
  years integer not null default 1 check (years >= 1 and years <= 10),
  registrant_email text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  availability_snapshot jsonb default '{}'::jsonb,
  last_error text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.domain_purchase_requests
  add column if not exists payment_provider text;

alter table public.domain_purchase_requests
  add column if not exists payment_reference text unique;

alter table public.domain_purchase_requests
  add column if not exists payment_status text default 'pending';

alter table public.domain_purchase_requests
  add column if not exists order_status text default 'pending_payment';

alter table public.domain_purchase_requests
  add column if not exists currency text default 'USD';

alter table public.domain_purchase_requests
  add column if not exists payment_amount numeric(12,2);

alter table public.domain_purchase_requests
  add column if not exists base_cost numeric(12,2);

alter table public.domain_purchase_requests
  add column if not exists sell_price numeric(12,2);

alter table public.domain_purchase_requests
  add column if not exists platform_margin numeric(12,2);

alter table public.domain_purchase_requests
  add column if not exists domain_id uuid references public.domains on delete set null;

alter table public.domain_purchase_requests
  add column if not exists namecheap_order_id text;

alter table public.domain_purchase_requests
  add column if not exists vercel_domain_verified boolean default false;

alter table public.domain_purchase_requests
  add column if not exists processed_at timestamp with time zone;

alter table public.domain_purchase_requests
  add column if not exists invoices jsonb default '[]'::jsonb;

alter table public.domain_purchase_requests
  add column if not exists metadata jsonb default '{}'::jsonb;

alter table public.domain_purchase_requests
  drop constraint if exists domain_purchase_requests_payment_provider_check;

alter table public.domain_purchase_requests
  add constraint domain_purchase_requests_payment_provider_check
  check (payment_provider in ('mpesa', 'paystack', 'flutterwave', 'manual') or payment_provider is null);

alter table public.domain_purchase_requests
  drop constraint if exists domain_purchase_requests_payment_status_check;

alter table public.domain_purchase_requests
  add constraint domain_purchase_requests_payment_status_check
  check (payment_status in ('pending', 'paid', 'failed', 'refunded'));

alter table public.domain_purchase_requests
  drop constraint if exists domain_purchase_requests_order_status_check;

alter table public.domain_purchase_requests
  add constraint domain_purchase_requests_order_status_check
  check (order_status in ('pending_payment', 'payment_confirmed', 'registering', 'dns_configuring', 'vercel_linking', 'verifying', 'completed', 'failed', 'refunded'));

alter table public.domain_purchase_requests
  drop constraint if exists domain_purchase_requests_provider_check;

alter table public.domain_purchase_requests
  add constraint domain_purchase_requests_provider_check
  check (provider in ('namecheap', 'namecheap_affiliate', 'porkbun'));

create index if not exists domain_purchase_requests_site_id_idx
  on public.domain_purchase_requests(site_id);

create index if not exists domain_purchase_requests_status_idx
  on public.domain_purchase_requests(status);

create index if not exists domain_purchase_requests_payment_reference_idx
  on public.domain_purchase_requests(payment_reference);

drop trigger if exists handle_domain_purchase_requests_updated_at on public.domain_purchase_requests;
create trigger handle_domain_purchase_requests_updated_at before update on public.domain_purchase_requests
  for each row execute procedure public.handle_updated_at();

alter table public.domain_purchase_requests enable row level security;

drop policy if exists "Users can view own domain purchase requests" on public.domain_purchase_requests;
create policy "Users can view own domain purchase requests" on public.domain_purchase_requests for select using (
  public.is_admin() OR exists (
    select 1
    from public.sites
    where sites.id = domain_purchase_requests.site_id
      and sites.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own domain purchase requests" on public.domain_purchase_requests;
create policy "Users can insert own domain purchase requests" on public.domain_purchase_requests for insert with check (
  public.is_admin() OR exists (
    select 1
    from public.sites
    where sites.id = domain_purchase_requests.site_id
      and sites.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own domain purchase requests" on public.domain_purchase_requests;
create policy "Users can update own domain purchase requests" on public.domain_purchase_requests for update using (
  public.is_admin() OR exists (
    select 1
    from public.sites
    where sites.id = domain_purchase_requests.site_id
      and sites.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own domain purchase requests" on public.domain_purchase_requests;
create policy "Users can delete own domain purchase requests" on public.domain_purchase_requests for delete using (
  public.is_admin() OR exists (
    select 1
    from public.sites
    where sites.id = domain_purchase_requests.site_id
      and sites.user_id = auth.uid()
  )
);

-- Domain pricing rules (owner-managed, used to compute final sell price).
create table if not exists public.domain_pricing_rules (
  id uuid default gen_random_uuid() primary key,
  tld text not null unique,
  currency text not null default 'USD',
  base_price numeric(12,2),
  markup_type text not null default 'flat' check (markup_type in ('flat', 'percent')),
  markup_value numeric(12,2) not null default 0,
  service_fee numeric(12,2) not null default 0,
  final_price_override numeric(12,2),
  is_active boolean not null default true,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

drop trigger if exists handle_domain_pricing_rules_updated_at on public.domain_pricing_rules;
create trigger handle_domain_pricing_rules_updated_at before update on public.domain_pricing_rules
  for each row execute procedure public.handle_updated_at();

alter table public.domain_pricing_rules enable row level security;

drop policy if exists "Admins can view domain pricing rules" on public.domain_pricing_rules;
create policy "Admins can view domain pricing rules" on public.domain_pricing_rules for select using (public.is_admin());

drop policy if exists "Admins can insert domain pricing rules" on public.domain_pricing_rules;
create policy "Admins can insert domain pricing rules" on public.domain_pricing_rules for insert with check (public.is_admin());

drop policy if exists "Admins can update domain pricing rules" on public.domain_pricing_rules;
create policy "Admins can update domain pricing rules" on public.domain_pricing_rules for update using (public.is_admin());

drop policy if exists "Admins can delete domain pricing rules" on public.domain_pricing_rules;
create policy "Admins can delete domain pricing rules" on public.domain_pricing_rules for delete using (public.is_admin());
