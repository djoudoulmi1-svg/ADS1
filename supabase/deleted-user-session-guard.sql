create table if not exists public.deleted_user_ids (
  user_id uuid primary key,
  deleted_at timestamptz not null default now(),
  deleted_by uuid
);
alter table public.deleted_user_ids enable row level security;
revoke all on table public.deleted_user_ids from public, anon, authenticated;
grant all on table public.deleted_user_ids to service_role;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and not exists (
      select 1 from public.disabled_users as d
      where d.user_id = auth.uid()
    )
    and not exists (
      select 1 from public.deleted_user_ids as x
      where x.user_id = auth.uid()
    );
$$;
