create table if not exists public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  google_email text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  token_type text default 'Bearer',
  calendar_id text not null default 'primary',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.google_calendar_event_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  google_event_id text not null,
  google_event_link text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'created',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, lead_id, google_event_id)
);

alter table public.google_calendar_connections enable row level security;
alter table public.google_calendar_event_links enable row level security;

create policy "Users can read their Google Calendar connection"
  on public.google_calendar_connections
  for select
  using (auth.uid() = user_id);

create policy "Users can delete their Google Calendar connection"
  on public.google_calendar_connections
  for delete
  using (auth.uid() = user_id);

create policy "Users can read their Google Calendar event links"
  on public.google_calendar_event_links
  for select
  using (auth.uid() = user_id);

create policy "Users can delete their Google Calendar event links"
  on public.google_calendar_event_links
  for delete
  using (auth.uid() = user_id);

create index if not exists google_calendar_event_links_user_id_idx
  on public.google_calendar_event_links(user_id);

create index if not exists google_calendar_event_links_lead_id_idx
  on public.google_calendar_event_links(lead_id);
