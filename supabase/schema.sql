-- Cyber Entertainment — Supabase setup.
-- Supabase dashboard → SQL Editor → New query → paste this whole file → Run. Safe to run more than once.

-- All collections (djs, events, news, gear, shirts, mixtapes, bookings, subscribers) live in one table.
create table if not exists public.cy_items (
  collection text   not null,
  id         text   not null,
  sort       bigint not null default 0,
  data       jsonb  not null,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);
create index if not exists cy_items_collection_sort on public.cy_items (collection, sort);

-- Single values: site settings, page content overrides, FAQ, gallery, admin password hash, flags.
create table if not exists public.cy_kv (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz not null default now()
);

-- Lock the tables: only the server (service_role key) can read or write. The public/anon key gets nothing.
alter table public.cy_items enable row level security;
alter table public.cy_kv    enable row level security;
revoke all on public.cy_items from anon, authenticated;
revoke all on public.cy_kv    from anon, authenticated;

-- Storage buckets: "media" is public (images/audio/video shown on the site), "backups" is private.
insert into storage.buckets (id, name, public) values ('media', 'media', true)
  on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public) values ('backups', 'backups', false)
  on conflict (id) do nothing;
