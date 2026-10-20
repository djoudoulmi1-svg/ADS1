create table if not exists public.site_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.site_owners (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.disabled_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  disabled_at timestamptz not null default now(),
  disabled_by uuid references auth.users (id) on delete set null
);

-- Keep an auth-independent tombstone so a deleted user's still-valid JWT cannot regain access before expiry.
create table if not exists public.deleted_user_ids (
  user_id uuid primary key,
  deleted_at timestamptz not null default now(),
  deleted_by uuid
);

create table if not exists public.chapter_catalog (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  number text not null check (char_length(number) between 1 and 12),
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  file_path text not null unique check (file_path ~ '^[a-z0-9][a-z0-9/_-]*\.html$'),
  section_count text not null default 'Lesson',
  available boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.site_admins enable row level security;
alter table public.site_owners enable row level security;
alter table public.disabled_users enable row level security;
alter table public.deleted_user_ids enable row level security;
alter table public.chapter_catalog enable row level security;

revoke all on table public.site_admins from anon, authenticated;
revoke all on table public.site_owners from anon, authenticated;
revoke all on table public.disabled_users from public, anon, authenticated;
revoke all on table public.deleted_user_ids from public, anon, authenticated;
grant all on table public.site_admins to service_role;
grant all on table public.site_owners to service_role;
grant all on table public.disabled_users to service_role;
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

create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user() and (
    exists (select 1 from public.site_owners as o where o.user_id = auth.uid())
    or exists (
      select 1 from public.site_admins as a
      where a.user_id = auth.uid()
    )
  );
$$;

create or replace function public.is_site_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user()
    and exists (select 1 from public.site_owners as o where o.user_id = auth.uid());
$$;

revoke all on function public.is_active_user() from public, anon;
revoke all on function public.is_site_admin() from public, anon;
revoke all on function public.is_site_owner() from public, anon;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_site_admin() to authenticated;
grant execute on function public.is_site_owner() to authenticated;

drop policy if exists "Students can read their own profile" on public.profiles;
drop policy if exists "Active students can read their own profile" on public.profiles;
create policy "Active students can read their own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = user_id and public.is_active_user());

drop policy if exists "Students can create their own profile" on public.profiles;
drop policy if exists "Active students can create their own profile" on public.profiles;
create policy "Active students can create their own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = user_id and public.is_active_user());

drop policy if exists "Students can update their own profile" on public.profiles;
drop policy if exists "Active students can update their own profile" on public.profiles;
create policy "Active students can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = user_id and public.is_active_user())
  with check (auth.uid() = user_id and public.is_active_user());

drop policy if exists "Students can read their own lesson progress" on public.lesson_progress;
drop policy if exists "Active students can read their own lesson progress" on public.lesson_progress;
create policy "Active students can read their own lesson progress"
  on public.lesson_progress for select to authenticated
  using (auth.uid() = user_id and public.is_active_user());

drop policy if exists "Students can create their own lesson progress" on public.lesson_progress;
drop policy if exists "Active students can create their own lesson progress" on public.lesson_progress;
create policy "Active students can create their own lesson progress"
  on public.lesson_progress for insert to authenticated
  with check (auth.uid() = user_id and public.is_active_user());

drop policy if exists "Students can update their own lesson progress" on public.lesson_progress;
drop policy if exists "Active students can update their own lesson progress" on public.lesson_progress;
create policy "Active students can update their own lesson progress"
  on public.lesson_progress for update to authenticated
  using (auth.uid() = user_id and public.is_active_user())
  with check (auth.uid() = user_id and public.is_active_user());

drop policy if exists "Students can delete their own lesson progress" on public.lesson_progress;
drop policy if exists "Active students can delete their own lesson progress" on public.lesson_progress;
create policy "Active students can delete their own lesson progress"
  on public.lesson_progress for delete to authenticated
  using (auth.uid() = user_id and public.is_active_user());

grant select, insert, update, delete on public.chapter_catalog to authenticated;
grant select on public.chapter_catalog to anon;

drop policy if exists "Everyone can read available chapters" on public.chapter_catalog;
create policy "Everyone can read available chapters"
  on public.chapter_catalog for select to anon, authenticated
  using (available = true);

drop policy if exists "Admins can read all chapters" on public.chapter_catalog;
create policy "Admins can read all chapters"
  on public.chapter_catalog for select to authenticated
  using (public.is_site_admin());

drop policy if exists "Admins can manage chapter catalog" on public.chapter_catalog;
create policy "Admins can manage chapter catalog"
  on public.chapter_catalog for all to authenticated
  using (public.is_site_admin())
  with check (public.is_site_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-chapters', 'course-chapters', true, 5242880, array['text/html'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can read chapter uploads" on storage.objects;
create policy "Admins can read chapter uploads"
  on storage.objects for select to authenticated
  using (bucket_id = 'course-chapters' and public.is_site_admin());

drop policy if exists "Admins can upload chapters" on storage.objects;
create policy "Admins can upload chapters"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'course-chapters' and public.is_site_admin());

create or replace function public.get_progress_board()
returns table (display_name text, progress_percent integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.display_name, p.progress_percent
  from public.profiles as p
  where not exists (
    select 1 from public.disabled_users as d
    where d.user_id = p.user_id
  )
  order by p.progress_percent desc, p.display_name asc
  limit 100;
$$;

revoke all on function public.get_progress_board() from public;
revoke execute on function public.get_progress_board() from anon;
grant execute on function public.get_progress_board() to authenticated;

