-- Backfill domain_pricing_rules for environments where initial migration
-- was applied before this table existed.

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

-- Ensure table shape is complete even if partially created.
alter table public.domain_pricing_rules
  add column if not exists currency text not null default 'USD';

alter table public.domain_pricing_rules
  add column if not exists base_price numeric(12,2);

alter table public.domain_pricing_rules
  add column if not exists markup_type text not null default 'flat';

alter table public.domain_pricing_rules
  add column if not exists markup_value numeric(12,2) not null default 0;

alter table public.domain_pricing_rules
  add column if not exists service_fee numeric(12,2) not null default 0;

alter table public.domain_pricing_rules
  add column if not exists final_price_override numeric(12,2);

alter table public.domain_pricing_rules
  add column if not exists is_active boolean not null default true;

alter table public.domain_pricing_rules
  add column if not exists notes text;

alter table public.domain_pricing_rules
  add column if not exists created_at timestamp with time zone default timezone('utc'::text, now()) not null;

alter table public.domain_pricing_rules
  add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now()) not null;

alter table public.domain_pricing_rules
  drop constraint if exists domain_pricing_rules_markup_type_check;

alter table public.domain_pricing_rules
  add constraint domain_pricing_rules_markup_type_check
  check (markup_type in ('flat', 'percent'));

create unique index if not exists domain_pricing_rules_tld_unique_idx
  on public.domain_pricing_rules(tld);

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

-- Refresh PostgREST schema cache so table is visible immediately to API clients.
notify pgrst, 'reload schema';
