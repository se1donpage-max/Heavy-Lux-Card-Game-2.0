
-- Enable scheduled database jobs
create extension if not exists pg_cron;

-- Delete expired chat messages
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

-- Restrict access to the cleanup function
revoke all on function public.delete_expired_chat_messages()
from public, anon, authenticated;

-- Schedule cleanup every minute
select cron.schedule(
  'k7-chat-expiry-cleanup',
  '* * * * *',
  $$select public.delete_expired_chat_messages();$$
);
