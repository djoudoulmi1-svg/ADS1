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

revoke all on public.removed_chapters from public;
grant select on public.removed_chapters to anon, authenticated;

