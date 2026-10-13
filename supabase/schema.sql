create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  chapter_id text not null check (char_length(chapter_id) between 1 and 40),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);

create table if not exists public.removed_chapters (
  chapter_id text primary key check (chapter_id in ('1', '2')),
  removed_by uuid not null references auth.users (id),
  removed_at timestamptz not null default now()
);

alter table public.removed_chapters enable row level security;
drop policy if exists "Anyone can see removed bundled chapters" on public.removed_chapters;
create policy "Anyone can see removed bundled chapters"
  on public.removed_chapters for select to anon, authenticated
  using (true);
grant select on public.removed_chapters to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.lesson_progress enable row level security;

drop policy if exists "Students can read their own profile" on public.profiles;
create policy "Students can read their own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Students can create their own profile" on public.profiles;
create policy "Students can create their own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Students can update their own profile" on public.profiles;
create policy "Students can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Students can read their own lesson progress" on public.lesson_progress;
create policy "Students can read their own lesson progress"
  on public.lesson_progress for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Students can create their own lesson progress" on public.lesson_progress;
create policy "Students can create their own lesson progress"
  on public.lesson_progress for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Students can update their own lesson progress" on public.lesson_progress;
create policy "Students can update their own lesson progress"
  on public.lesson_progress for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Students can delete their own lesson progress" on public.lesson_progress;
create policy "Students can delete their own lesson progress"
  on public.lesson_progress for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.lesson_progress to authenticated;

create or replace function public.get_progress_board()
returns table (display_name text, progress_percent integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.display_name, p.progress_percent
  from public.profiles as p
  order by p.progress_percent desc, p.display_name asc
  limit 100;
$$;

revoke all on function public.get_progress_board() from public;
grant execute on function public.get_progress_board() to authenticated;

