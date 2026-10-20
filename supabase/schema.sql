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
revoke execute on function public.get_progress_board() from anon;
grant execute on function public.get_progress_board() to authenticated;


-- Private per-student lesson notes
-- Private student notes. Re-runnable; each student can access only their own rows.
create table if not exists public.student_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  chapter_id text not null check (char_length(chapter_id) between 1 and 40),
  note_type text not null check (note_type in ('summary', 'question')),
  title text not null check (char_length(title) between 1 and 120),
  content text not null check (char_length(content) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_notes enable row level security;

drop policy if exists "Students can read their own notes" on public.student_notes;
create policy "Students can read their own notes"
  on public.student_notes for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Students can create their own notes" on public.student_notes;
create policy "Students can create their own notes"
  on public.student_notes for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Students can update their own notes" on public.student_notes;
create policy "Students can update their own notes"
  on public.student_notes for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Students can delete their own notes" on public.student_notes;
create policy "Students can delete their own notes"
  on public.student_notes for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.student_notes to authenticated;


-- Quiz answer keys are private. Only Edge Functions use the service role to read or write them.
create table if not exists public.chapter_quizzes (
  id uuid primary key default gen_random_uuid(),
  chapter_id text not null check (char_length(chapter_id) between 1 and 40),
  question text not null check (char_length(question) between 5 and 500),
  options jsonb not null check (
    jsonb_typeof(options) = 'array'
    and jsonb_array_length(options) between 2 and 6
  ),
  correct_index integer not null check (correct_index between 0 and 5),
  explanation text not null default '' check (char_length(explanation) <= 1000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.chapter_quizzes enable row level security;
revoke all on public.chapter_quizzes from anon, authenticated;
grant all on public.chapter_quizzes to service_role;


-- Each student owns a personal, editable study plan.
create table if not exists public.student_plan_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  detail text not null default '' check (char_length(detail) <= 1000),
  chapter_id text check (chapter_id is null or char_length(chapter_id) between 1 and 40),
  target_date date,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.student_plan_tasks enable row level security;
drop policy if exists "Students can read their own plan tasks" on public.student_plan_tasks;
create policy "Students can read their own plan tasks"
  on public.student_plan_tasks for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Students can create their own plan tasks" on public.student_plan_tasks;
create policy "Students can create their own plan tasks"
  on public.student_plan_tasks for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Students can update their own plan tasks" on public.student_plan_tasks;
create policy "Students can update their own plan tasks"
  on public.student_plan_tasks for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Students can delete their own plan tasks" on public.student_plan_tasks;
create policy "Students can delete their own plan tasks"
  on public.student_plan_tasks for delete to authenticated using (auth.uid() = user_id);
grant select, insert, update, delete on public.student_plan_tasks to authenticated;
