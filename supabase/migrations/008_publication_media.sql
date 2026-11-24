-- K7 V7.0: legacy news stay in the news section; no deletion.
begin;
alter table public.news add column if not exists section text not null default 'news';
alter table public.news add column if not exists media_urls text[] not null default '{}';
do $$ begin
  if not exists (select 1 from pg_constraint where conname='k7_news_section_check' and conrelid='public.news'::regclass) then
    alter table public.news add constraint k7_news_section_check check (section in ('news','chat','events','roster','stats') and cardinality(media_urls)<=6);
  end if;
end $$;
create index if not exists k7_news_section_date on public.news(section,is_pinned desc,published_at desc);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('k7-publications','k7-publications',false,2097152,array['image/jpeg'])
on conflict (id) do nothing;
-- No anonymous storage policy. All uploads/downloads go through authenticated server routes.
commit;
