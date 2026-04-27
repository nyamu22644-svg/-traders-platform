create table if not exists public.site_deployments (
  id uuid default gen_random_uuid() primary key,
  site_id uuid not null references public.sites on delete cascade unique,
  user_id uuid not null references public.users on delete cascade,
  deployment_slug text not null unique,
  deployment_url text not null,
  status text not null default 'active' check (status in ('draft', 'building', 'active', 'failed')),
  provider text not null default 'vercel',
  environment text not null default 'production',
  last_deployed_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_error text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists site_deployments_user_id_idx
  on public.site_deployments(user_id);

create index if not exists site_deployments_status_idx
  on public.site_deployments(status);

drop trigger if exists handle_site_deployments_updated_at on public.site_deployments;
create trigger handle_site_deployments_updated_at before update on public.site_deployments
  for each row execute procedure public.handle_updated_at();

alter table public.site_deployments enable row level security;

drop policy if exists "Users can view own site deployments" on public.site_deployments;
create policy "Users can view own site deployments" on public.site_deployments for select using (
  public.is_admin() or user_id = auth.uid() or exists (
    select 1
    from public.sites
    where sites.id = site_deployments.site_id
      and sites.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own site deployments" on public.site_deployments;
create policy "Users can insert own site deployments" on public.site_deployments for insert with check (
  public.is_admin() or (
    user_id = auth.uid() and exists (
      select 1
      from public.sites
      where sites.id = site_deployments.site_id
        and sites.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can update own site deployments" on public.site_deployments;
create policy "Users can update own site deployments" on public.site_deployments for update using (
  public.is_admin() or (
    user_id = auth.uid() and exists (
      select 1
      from public.sites
      where sites.id = site_deployments.site_id
        and sites.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can delete own site deployments" on public.site_deployments;
create policy "Users can delete own site deployments" on public.site_deployments for delete using (
  public.is_admin() or (
    user_id = auth.uid() and exists (
      select 1
      from public.sites
      where sites.id = site_deployments.site_id
        and sites.user_id = auth.uid()
    )
  )
);

insert into public.site_deployments (
  site_id,
  user_id,
  deployment_slug,
  deployment_url,
  status,
  provider,
  environment,
  metadata
)
select
  s.id,
  s.user_id,
  (
    case
      when trim(regexp_replace(lower(s.name), '[^a-z0-9]+', '-', 'g')) = '' then 'site'
      else trim(both '-' from regexp_replace(lower(s.name), '[^a-z0-9]+', '-', 'g'))
    end
  ) || '-' || left(replace(s.id::text, '-', ''), 8) as deployment_slug,
  'https://' || (
    (
      case
        when trim(regexp_replace(lower(s.name), '[^a-z0-9]+', '-', 'g')) = '' then 'site'
        else trim(both '-' from regexp_replace(lower(s.name), '[^a-z0-9]+', '-', 'g'))
      end
    ) || '-' || left(replace(s.id::text, '-', ''), 8)
  ) || '.dgait.vercel.app' as deployment_url,
  case when s.status = 'active' then 'active' else 'draft' end,
  'vercel',
  'production',
  jsonb_build_object('seeded_by_migration', true)
from public.sites s
on conflict (site_id) do nothing;
