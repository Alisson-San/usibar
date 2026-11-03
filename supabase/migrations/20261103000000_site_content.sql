-- Usibar site content: one JSON document (company, products, sectors, process)
-- plus a rolling history of the last 100 saves, and a public bucket for photos.
-- Only the Next.js server talks to these tables, using the service role key.

create table if not exists public.site_content (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.site_content_history (
  revision bigint generated always as identity primary key,
  content_id text not null references public.site_content (id) on delete cascade,
  data jsonb not null,
  saved_at timestamptz not null default now()
);
create index if not exists site_content_history_content_idx
  on public.site_content_history (content_id, revision desc);

-- RLS on and no policies: anon/authenticated clients get nothing; the service role bypasses RLS.
alter table public.site_content enable row level security;
alter table public.site_content_history enable row level security;
revoke all on public.site_content, public.site_content_history from anon, authenticated;

create or replace function public.keep_site_content_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.site_content_history (content_id, data) values (new.id, new.data);
  delete from public.site_content_history h
  where h.content_id = new.id
    and h.revision < (
      select min(revision) from (
        select revision from public.site_content_history
        where content_id = new.id
        order by revision desc
        limit 100
      ) recent
    );
  return new;
end;
$$;
revoke execute on function public.keep_site_content_history() from public, anon, authenticated;

drop trigger if exists site_content_history on public.site_content;
create trigger site_content_history
  after insert or update on public.site_content
  for each row execute function public.keep_site_content_history();

-- Product photos: already converted to WebP by the server, so only WebP up to 2 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog', 'catalog', true, 2097152, array['image/webp'])
on conflict (id) do nothing;
