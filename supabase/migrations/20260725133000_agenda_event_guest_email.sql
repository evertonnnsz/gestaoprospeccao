alter table public.agenda_events
  add column if not exists guest_email text;
