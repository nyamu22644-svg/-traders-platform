-- Enable dual providers: Namecheap affiliate + Porkbun.

alter table public.domains
  drop constraint if exists domains_provider_check;

alter table public.domains
  add constraint domains_provider_check
  check (provider in ('manual', 'namecheap', 'namecheap_affiliate', 'porkbun', 'platform_subdomain'));

alter table public.domain_purchase_requests
  drop constraint if exists domain_purchase_requests_provider_check;

alter table public.domain_purchase_requests
  add constraint domain_purchase_requests_provider_check
  check (provider in ('namecheap', 'namecheap_affiliate', 'porkbun'));
