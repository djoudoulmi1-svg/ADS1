-- Keep profile completion percentages derived from saved lesson and Arena rows.
-- Run after schema.sql, admin-schema.sql, and 20261014_arena_and_email_privacy.sql.
-- Safe to run more than once.

create or replace function public.calculate_progress_percent(p_user_id uuid)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  with available_chapters as (
    select '1'::text as chapter_id
    where not exists (
      select 1 from public.removed_chapters r where r.chapter_id = '1'
    )
    union all
    select '2'::text
    where not exists (
      select 1 from public.removed_chapters r where r.chapter_id = '2'
    )
    union all
    select c.id::text
    from public.chapter_catalog c
    where c.available = true
  ),
  lesson_totals as (
    select
      count(*)::numeric as total,
      count(*) filter (where lp.completed)::numeric as completed
    from available_chapters c
    left join public.lesson_progress lp
      on lp.chapter_id = c.chapter_id and lp.user_id = p_user_id
  ),
  arena_totals as (
    select count(*) filter (where a.completed)::numeric as completed
    from public.arena_progress a
    where a.user_id = p_user_id
  )
  select least(100, greatest(0, round(
    70.0 * coalesce((select completed / nullif(total, 0) from lesson_totals), 0)
    + 30.0 * coalesce((select completed / 9.0 from arena_totals), 0)
  )))::integer;
$$;

revoke all on function public.calculate_progress_percent(uuid) from public, anon, authenticated;

create or replace function public.keep_profile_progress_derived()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.progress_percent := public.calculate_progress_percent(new.user_id);
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.keep_profile_progress_derived() from public, anon, authenticated;

drop trigger if exists profiles_progress_is_derived on public.profiles;
create trigger profiles_progress_is_derived
before insert or update on public.profiles
for each row execute function public.keep_profile_progress_derived();

create or replace function public.refresh_one_profile_progress(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles p
  set progress_percent = public.calculate_progress_percent(p.user_id),
      updated_at = now()
  where p.user_id = p_user_id
    and p.progress_percent is distinct from public.calculate_progress_percent(p.user_id);
$$;

revoke all on function public.refresh_one_profile_progress(uuid) from public, anon, authenticated;

create or replace function public.refresh_progress_after_user_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_one_profile_progress(old.user_id);
  else
    perform public.refresh_one_profile_progress(new.user_id);
  end if;
  return null;
end;
$$;

revoke all on function public.refresh_progress_after_user_record() from public, anon, authenticated;

drop trigger if exists lesson_progress_refresh_profile on public.lesson_progress;
create trigger lesson_progress_refresh_profile
after insert or update or delete on public.lesson_progress
for each row execute function public.refresh_progress_after_user_record();

drop trigger if exists arena_progress_refresh_profile on public.arena_progress;
create trigger arena_progress_refresh_profile
after insert or update or delete on public.arena_progress
for each row execute function public.refresh_progress_after_user_record();

create or replace function public.refresh_all_profile_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles p
  set progress_percent = public.calculate_progress_percent(p.user_id),
      updated_at = now()
  where p.progress_percent is distinct from public.calculate_progress_percent(p.user_id);
  return null;
end;
$$;

revoke all on function public.refresh_all_profile_progress() from public, anon, authenticated;

drop trigger if exists chapter_catalog_refresh_profiles on public.chapter_catalog;
create trigger chapter_catalog_refresh_profiles
after insert or update or delete on public.chapter_catalog
for each statement execute function public.refresh_all_profile_progress();

drop trigger if exists removed_chapters_refresh_profiles on public.removed_chapters;
create trigger removed_chapters_refresh_profiles
after insert or update or delete on public.removed_chapters
for each statement execute function public.refresh_all_profile_progress();

-- A student's profile row remains writable, but completion percentage is not.
revoke insert, update on table public.profiles from authenticated;
grant insert (user_id, display_name, show_email) on table public.profiles to authenticated;
grant update (user_id, display_name, show_email) on table public.profiles to authenticated;

-- Bring existing values in line with their saved lesson and Arena records.
update public.profiles p
set progress_percent = public.calculate_progress_percent(p.user_id),
    updated_at = now()
where p.progress_percent is distinct from public.calculate_progress_percent(p.user_id);

-- Both leaderboard RPCs now read a value maintained by the database triggers.
