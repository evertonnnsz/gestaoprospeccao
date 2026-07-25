create table if not exists public.agenda_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('lead', 'client')),
  lead_id uuid references public.leads(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  event_type text not null check (
    event_type in ('commercial_meeting','proposal_meeting','onboarding','results_meeting','operational_task','other')
  ),
  title text not null,
  scheduled_date date not null,
  scheduled_time time not null,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  notes text,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  google_event_id text,
  google_event_link text,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (source_type = 'lead' and lead_id is not null and client_id is null)
    or (source_type = 'client' and client_id is not null)
  )
);

grant select, insert, update, delete on public.agenda_events to authenticated;
grant all on public.agenda_events to service_role;

alter table public.agenda_events enable row level security;

create policy "Users can read their agenda events" on public.agenda_events for select using (auth.uid() = user_id);
create policy "Users can create their agenda events" on public.agenda_events for insert with check (auth.uid() = user_id);
create policy "Users can update their agenda events" on public.agenda_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their agenda events" on public.agenda_events for delete using (auth.uid() = user_id);

create index if not exists agenda_events_user_date_idx on public.agenda_events(user_id, scheduled_date, scheduled_time);
create index if not exists agenda_events_lead_id_idx on public.agenda_events(lead_id);
create index if not exists agenda_events_client_id_idx on public.agenda_events(client_id);

drop trigger if exists update_agenda_events_updated_at on public.agenda_events;
create trigger update_agenda_events_updated_at
  before update on public.agenda_events
  for each row execute function public.update_updated_at_column();