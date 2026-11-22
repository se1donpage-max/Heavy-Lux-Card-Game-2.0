-- K7 CREW CINEMA 3.1 — run ONCE in the Supabase SQL editor before deployment.
-- Non-destructive: existing posts, users and chat messages are preserved.
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS subtitle text;
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'НОВОСТИ';
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS layout_style text NOT NULL DEFAULT 'editorial';
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS cta_label text;
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS cta_url text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'news_category_max') THEN
    ALTER TABLE public.news ADD CONSTRAINT news_category_max CHECK (char_length(category) <= 35);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'news_subtitle_max') THEN
    ALTER TABLE public.news ADD CONSTRAINT news_subtitle_max CHECK (char_length(coalesce(subtitle, '')) <= 220);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'news_style_enum') THEN
    ALTER TABLE public.news ADD CONSTRAINT news_style_enum CHECK (layout_style IN ('editorial', 'statement', 'spotlight'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'news_cta_label_max') THEN
    ALTER TABLE public.news ADD CONSTRAINT news_cta_label_max CHECK (char_length(coalesce(cta_label, '')) <= 48);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS news_pinned_published_idx ON public.news(is_pinned DESC, published_at DESC);

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
