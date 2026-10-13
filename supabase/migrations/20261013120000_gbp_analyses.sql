-- Diagnósticos de Google Meu Negócio (dados públicos do Google Maps via SerpAPI).
-- Cada análise fica salva para não gastar créditos de novo e para montar a evolução da nota.
create table if not exists public.gbp_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  place_id text,
  data_id text,
  business_name text not null,
  address text,
  score integer not null check (score between 0 and 100),
  reviews_analyzed integer not null default 0,
  -- Dados do perfil, checklist, concorrentes, estatísticas de avaliações e categorias.
  profile jsonb not null default '{}'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  competitors jsonb not null default '[]'::jsonb,
  reviews jsonb not null default '{}'::jsonb,
  categories jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists gbp_analyses_user_created_idx on public.gbp_analyses (user_id, created_at desc);
create index if not exists gbp_analyses_place_idx on public.gbp_analyses (user_id, data_id, created_at desc);
create index if not exists gbp_analyses_lead_idx on public.gbp_analyses (lead_id);
create index if not exists gbp_analyses_client_idx on public.gbp_analyses (client_id);

alter table public.gbp_analyses enable row level security;

create policy "Users can read their gbp analyses"
  on public.gbp_analyses for select
  using (auth.uid() = user_id);

create policy "Users can create their gbp analyses"
  on public.gbp_analyses for insert
  with check (auth.uid() = user_id);

create policy "Users can update their gbp analyses"
  on public.gbp_analyses for update
  using (auth.uid() = user_id);

create policy "Users can delete their gbp analyses"
  on public.gbp_analyses for delete
  using (auth.uid() = user_id);
