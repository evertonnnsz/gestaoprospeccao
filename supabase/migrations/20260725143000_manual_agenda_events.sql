alter table public.agenda_events
  drop constraint if exists agenda_events_source_type_check;

alter table public.agenda_events
  drop constraint if exists agenda_events_event_type_check;

alter table public.agenda_events
  drop constraint if exists agenda_events_check;

alter table public.agenda_events
  add constraint agenda_events_source_type_check
  check (source_type in ('lead', 'client', 'manual'));

alter table public.agenda_events
  add constraint agenda_events_event_type_check
  check (
    event_type in (
      'commercial_meeting',
      'proposal_meeting',
      'onboarding',
      'results_meeting',
      'operational_task',
      'mentoring',
      'personal',
      'standalone_meeting',
      'other'
    )
  );

alter table public.agenda_events
  add constraint agenda_events_check
  check (
    (source_type = 'lead' and lead_id is not null and client_id is null)
    or
    (source_type = 'client' and client_id is not null)
    or
    (source_type = 'manual' and lead_id is null and client_id is null)
  );
