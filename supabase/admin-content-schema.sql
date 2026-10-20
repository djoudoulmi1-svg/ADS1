create table if not exists public.glossary_entries (
  id uuid primary key default gen_random_uuid(),
  term text not null check (char_length(btrim(term)) between 2 and 80),
  definition text not null check (char_length(btrim(definition)) between 5 and 800),
  chapter_id text not null check (char_length(btrim(chapter_id)) between 1 and 40),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists glossary_entries_term_ci_idx
  on public.glossary_entries (lower(term));
alter table public.glossary_entries enable row level security;
revoke all on table public.glossary_entries from anon, authenticated;
grant select on table public.glossary_entries to anon, authenticated;
grant insert, update, delete on table public.glossary_entries to authenticated;
grant all on table public.glossary_entries to service_role;
drop policy if exists "Everyone can read glossary entries" on public.glossary_entries;
create policy "Everyone can read glossary entries"
  on public.glossary_entries for select to anon, authenticated using (true);
drop policy if exists "Admins can add glossary entries" on public.glossary_entries;
create policy "Admins can add glossary entries"
  on public.glossary_entries for insert to authenticated
  with check (public.is_site_admin());
drop policy if exists "Admins can update glossary entries" on public.glossary_entries;
create policy "Admins can update glossary entries"
  on public.glossary_entries for update to authenticated
  using (public.is_site_admin()) with check (public.is_site_admin());
drop policy if exists "Admins can delete glossary entries" on public.glossary_entries;
create policy "Admins can delete glossary entries"
  on public.glossary_entries for delete to authenticated
  using (public.is_site_admin());

create table if not exists public.site_social_links (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(btrim(label)) between 2 and 40),
  url text not null check (char_length(url) between 12 and 500 and url ~ '^https://[^[:space:]]+$'),
  sort_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.site_social_links enable row level security;
revoke all on table public.site_social_links from anon, authenticated;
grant select on table public.site_social_links to anon, authenticated;
grant insert, update, delete on table public.site_social_links to authenticated;
grant all on table public.site_social_links to service_role;
drop policy if exists "Everyone can read site social links" on public.site_social_links;
create policy "Everyone can read site social links"
  on public.site_social_links for select to anon, authenticated using (true);
drop policy if exists "Admins can add site social links" on public.site_social_links;
create policy "Admins can add site social links"
  on public.site_social_links for insert to authenticated
  with check (public.is_site_admin());
drop policy if exists "Admins can update site social links" on public.site_social_links;
create policy "Admins can update site social links"
  on public.site_social_links for update to authenticated
  using (public.is_site_admin()) with check (public.is_site_admin());
drop policy if exists "Admins can delete site social links" on public.site_social_links;
create policy "Admins can delete site social links"
  on public.site_social_links for delete to authenticated
  using (public.is_site_admin());
