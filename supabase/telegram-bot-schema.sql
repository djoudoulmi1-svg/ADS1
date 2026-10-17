-- Minimal anti-abuse quota for the public Telegram course tutor.
-- Only Telegram numeric user IDs and rolling counters are stored; message text is never saved.
create table if not exists public.telegram_bot_rate_limits (
  telegram_user_id bigint primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists telegram_bot_rate_limits_updated_at_idx
  on public.telegram_bot_rate_limits (updated_at);

alter table public.telegram_bot_rate_limits enable row level security;
revoke all on table public.telegram_bot_rate_limits from public, anon, authenticated;
grant all on table public.telegram_bot_rate_limits to service_role;

create or replace function public.consume_telegram_bot_quota(
  p_telegram_user_id bigint,
  p_limit integer default 10,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  within_limit boolean;
begin
  if p_telegram_user_id is null or p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;

  delete from public.telegram_bot_rate_limits
  where updated_at < now() - interval '5 minutes';

  insert into public.telegram_bot_rate_limits (
    telegram_user_id, window_started_at, request_count, updated_at
  ) values (
    p_telegram_user_id, now(), 1, now()
  )
  on conflict (telegram_user_id) do update
  set window_started_at = case
        when now() >= public.telegram_bot_rate_limits.window_started_at
          + make_interval(secs => p_window_seconds)
        then now()
        else public.telegram_bot_rate_limits.window_started_at
      end,
      request_count = case
        when now() >= public.telegram_bot_rate_limits.window_started_at
          + make_interval(secs => p_window_seconds)
        then 1
        else public.telegram_bot_rate_limits.request_count + 1
      end,
      updated_at = now()
  returning request_count <= p_limit into within_limit;

  return within_limit;
end;
$$;

revoke all on function public.consume_telegram_bot_quota(bigint, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_telegram_bot_quota(bigint, integer, integer) to service_role;
