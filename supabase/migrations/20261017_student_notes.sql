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
