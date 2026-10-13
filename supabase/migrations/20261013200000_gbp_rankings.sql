-- Verificações de posição do perfil no Google Maps por palavra-chave (ponto central ou mapa em grade).
-- results: [{ term, center_position, best, average, found, total, top3_share, points: [{ row, col, lat, lng, position }] }]
create table if not exists public.gbp_rankings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text,
  data_id text,
  business_name text not null,
  address text,
  lat double precision not null,
  lng double precision not null,
  grid_size integer not null default 1 check (grid_size in (1, 3, 5)),
  spacing_km numeric(5, 2) not null default 1,
  depth integer not null default 20,
  results jsonb not null default '[]'::jsonb,
  credits_used integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists gbp_rankings_user_place_idx on public.gbp_rankings (user_id, place_id, created_at desc);

alter table public.gbp_rankings enable row level security;

create policy "Users can read their gbp rankings" on public.gbp_rankings for select using (auth.uid() = user_id);
create policy "Users can create their gbp rankings" on public.gbp_rankings for insert with check (auth.uid() = user_id);
create policy "Users can delete their gbp rankings" on public.gbp_rankings for delete using (auth.uid() = user_id);
