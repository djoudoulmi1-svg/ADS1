-- Algo Arena progress and optional email visibility on the progress board.
-- Safe to run more than once.

-- 1. Students choose whether other signed-in students can see their email.
alter table public.profiles
  add column if not exists show_email boolean not null default false;

-- 2. One row per student and arena level (ids look like trace-1, exam-2, clab-3).
create table if not exists public.arena_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  level_id text not null check (level_id ~ '^[a-z]+-[1-9]$'),
  best_score integer not null default 0 check (best_score between 0 and 100),
  completed boolean not null default false,
  points integer not null default 0 check (points between 0 and 1000),
  updated_at timestamptz not null default now(),
  primary key (user_id, level_id)
);

alter table public.arena_progress enable row level security;

drop policy if exists "Students can read their own arena progress" on public.arena_progress;
create policy "Students can read their own arena progress"
  on public.arena_progress for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Students can create their own arena progress" on public.arena_progress;
create policy "Students can create their own arena progress"
  on public.arena_progress for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Students can update their own arena progress" on public.arena_progress;
create policy "Students can update their own arena progress"
  on public.arena_progress for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.arena_progress to authenticated;

-- 3. A new board function that also returns arena points and, only for students
--    who opted in, their email address. The original get_progress_board() is left
--    untouched so nothing that already uses it breaks.
create or replace function public.get_progress_board_v2()
returns table (display_name text, progress_percent integer, email text, arena_points integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.display_name,
    p.progress_percent,
    case when p.show_email then u.email::text else null end,
    coalesce((
      select sum(a.points)::integer
      from public.arena_progress as a
      where a.user_id = p.user_id and a.completed
    ), 0)
  from public.profiles as p
  join auth.users as u on u.id = p.user_id
  order by p.progress_percent desc, 4 desc, p.display_name asc
  limit 100;
$$;

revoke all on function public.get_progress_board_v2() from public;
-- Supabase grants EXECUTE to anon by default; opted-in emails must never be readable signed out.
revoke execute on function public.get_progress_board_v2() from anon;
grant execute on function public.get_progress_board_v2() to authenticated;
