-- V6.1: safe to rerun; no data deletion. Run in Supabase SQL Editor.
BEGIN;
CREATE TABLE IF NOT EXISTS public.community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id bigint NOT NULL REFERENCES public.profiles(telegram_id) ON DELETE CASCADE,
  subject text NOT NULL CHECK (char_length(trim(subject)) BETWEEN 1 AND 80),
  message text NOT NULL CHECK (char_length(trim(message)) BETWEEN 1 AND 100),
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'IN_PROGRESS', 'RESOLVED')),
  admin_reply text CHECK (char_length(coalesce(admin_reply, '')) <= 500),
  handled_by bigint REFERENCES public.profiles(telegram_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_reports_created_idx ON public.community_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS community_reports_author_idx ON public.community_reports(author_id, created_at DESC);
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;
-- No anonymous policies: access exclusively through the session-verified server API.
DROP TRIGGER IF EXISTS community_reports_updated_at ON public.community_reports;
CREATE TRIGGER community_reports_updated_at
BEFORE UPDATE ON public.community_reports
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_reports TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
