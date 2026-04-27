-- Backfill domain_purchase_requests advanced columns for environments where
-- earlier migration was applied before these columns were added.

alter table public.domain_purchase_requests
  add column if not exists payment_provider text;

alter table public.domain_purchase_requests
  add column if not exists payment_reference text;

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

-- Keep data consistent for legacy rows.
update public.domain_purchase_requests
set payment_status = coalesce(payment_status, 'pending'),
    order_status = coalesce(order_status, 'pending_payment'),
    currency = coalesce(currency, 'USD'),
    vercel_domain_verified = coalesce(vercel_domain_verified, false),
    invoices = coalesce(invoices, '[]'::jsonb),
    metadata = coalesce(metadata, '{}'::jsonb)
where payment_status is null
   or order_status is null
   or currency is null
   or vercel_domain_verified is null
   or invoices is null
   or metadata is null;

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

create index if not exists domain_purchase_requests_payment_reference_idx
  on public.domain_purchase_requests(payment_reference);
