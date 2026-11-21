
create or replace function public.set_team_captain(
  target_telegram_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.roster
    where telegram_id = target_telegram_id
  ) then
    raise exception 'Player not found in roster';
  end if;

  perform pg_advisory_xact_lock(742019);

  update public.roster
  set is_captain = false
  where is_captain = true;

  update public.roster
  set is_captain = true
  where telegram_id = target_telegram_id;
end;
$$;

revoke all on function public.set_team_captain(bigint) from public;
revoke all on function public.set_team_captain(bigint) from anon;
revoke all on function public.set_team_captain(bigint) from authenticated;

grant execute on function public.set_team_captain(bigint) to service_role;
