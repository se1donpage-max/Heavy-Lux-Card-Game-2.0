-- K7 V7.0: additive, safe to rerun. Telegram identity and existing data unchanged.
begin;
alter table public.profiles
  add column if not exists game_id text,
  add column if not exists game_nickname text,
  add column if not exists display_name text,
  add column if not exists age_years smallint,
  add column if not exists show_name boolean not null default false,
  add column if not exists show_age boolean not null default false;
-- Database-level guard, in addition to API validation.
do $$ begin
  if not exists (select 1 from pg_constraint where conname='k7_profile_values_check' and conrelid='public.profiles'::regclass) then
    alter table public.profiles add constraint k7_profile_values_check check (
      (game_id is null or game_id ~ '^[0-9]{1,32}$') and
      (game_nickname is null or char_length(game_nickname) between 1 and 40) and
      (display_name is null or char_length(display_name) between 1 and 60) and
      (age_years is null or age_years between 1 and 120));
  end if;
end $$;
commit;
