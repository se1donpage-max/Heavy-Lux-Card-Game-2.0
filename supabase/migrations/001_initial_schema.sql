
-- =========================================
-- K7 CREW | INITIAL DATABASE SCHEMA
-- =========================================

create extension if not exists pgcrypto;

-- 1. ENUM TYPES

create type public.access_role as enum (
  'OWNER',
  'ADMIN',
  'IGL',
  'MEMBER'
);

create type public.game_role as enum (
  'FLEX',
  'IGL',
  'SUPPORT',
  'FRAGGER',
  'SNIPER'
);

create type public.roster_slot as enum (
  'MAIN_1',
  'MAIN_2',
  'MAIN_3',
  'MAIN_4',
  'SUB_1',
  'SUB_2',
  'SUB_3'
);

create type public.event_status as enum (
  'UPCOMING',
  'COMPLETED',
  'CANCELLED'
);

-- 2. USER PROFILES

create table public.profiles (
  telegram_id bigint primary key,
  first_name text not null,
  last_name text,
  username text,
  photo_url text,
  access_role public.access_role not null default 'MEMBER',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index one_owner_only
on public.profiles (access_role)
where access_role = 'OWNER';

-- 3. TEAM ROSTER

create table public.roster (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique
    references public.profiles(telegram_id) on delete cascade,
  slot public.roster_slot not null unique,
  game_role public.game_role not null,
  in_game_id text,
  is_captain boolean not null default false,
  joined_at timestamptz not null default now()
);

create unique index one_team_captain
on public.roster (is_captain)
where is_captain = true;

-- 4. MATCHES

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  played_at timestamptz not null,
  placement integer not null check (placement between 1 and 100),
  created_by bigint references public.profiles(telegram_id),
  created_at timestamptz not null default now()
);

-- 5. INDIVIDUAL MATCH STATISTICS
-- Only actual participants receive statistics.

create table public.player_match_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null
    references public.matches(id) on delete cascade,
  telegram_id bigint not null
    references public.profiles(telegram_id) on delete cascade,
  kills integer not null default 0 check (kills >= 0),
  created_at timestamptz not null default now(),
  unique (match_id, telegram_id)
);

create index player_stats_user_idx
on public.player_match_stats (telegram_id);

create index player_stats_match_idx
on public.player_match_stats (match_id);

-- 6. EVENTS

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date timestamptz not null,
  organizer_id bigint references public.profiles(telegram_id),
  event_format text,
  poster_url text,
  status public.event_status not null default 'UPCOMING',
  result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. NEWS

create table public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  cover_url text,
  author_id bigint references public.profiles(telegram_id),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8. CHAT MESSAGES

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null
    references public.profiles(telegram_id) on delete cascade,
  content text not null
    check (char_length(trim(content)) between 1 and 1000),
  reply_to uuid references public.chat_messages(id) on delete set null,
  mentioned_user_ids bigint[] not null default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

create index chat_expiry_idx
on public.chat_messages (expires_at);

create index chat_created_idx
on public.chat_messages (created_at desc);

-- 9. CHAT REACTIONS

create table public.chat_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null
    references public.chat_messages(id) on delete cascade,
  telegram_id bigint not null
    references public.profiles(telegram_id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, telegram_id, emoji)
);

-- 10. AUTOMATIC UPDATED_AT

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create trigger news_updated_at
before update on public.news
for each row execute function public.set_updated_at();

-- 11. ROW LEVEL SECURITY

alter table public.profiles enable row level security;
alter table public.roster enable row level security;
alter table public.matches enable row level security;
alter table public.player_match_stats enable row level security;
alter table public.events enable row level security;
alter table public.news enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reactions enable row level security;

-- Access will be handled through authenticated server APIs.
-- No public or anonymous policies are created.
-- The server uses the protected Supabase service-role key.
