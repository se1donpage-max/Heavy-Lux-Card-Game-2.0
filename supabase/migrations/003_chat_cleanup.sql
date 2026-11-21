
-- Enable Supabase Cron
create extension if not exists pg_cron
with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Function for deleting expired chat messages
create or replace function public.delete_expired_chat_messages()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count bigint;
begin
  delete from public.chat_messages
  where expires_at <= now();

  get diagnostics deleted_count = row_count;

  return deleted_count;
end;
$$;

-- Restrict direct access to the cleanup function
revoke all on function public.delete_expired_chat_messages()
from public, anon, authenticated;

grant execute on function public.delete_expired_chat_messages()
to service_role;

-- Run cleanup every minute
select cron.schedule(
  'k7-chat-expiry-cleanup',
  '* * * * *',
  $$select public.delete_expired_chat_messages();$$
);
