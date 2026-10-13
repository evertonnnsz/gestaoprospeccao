-- Checklist manual de otimização do Perfil da Empresa no Google (um por perfil).
-- items: { "<id do item>": { "done_at": "2026-10-13T12:00:00Z", "note": "..." } }
create table if not exists public.gbp_checklists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  place_id text,
  business_name text not null check (length(trim(business_name)) > 0),
  items jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists gbp_checklists_user_place_idx
  on public.gbp_checklists (user_id, place_id)
  where place_id is not null;

create index if not exists gbp_checklists_user_idx on public.gbp_checklists (user_id, updated_at desc);

alter table public.gbp_checklists enable row level security;

create policy "Users can read their gbp checklists" on public.gbp_checklists for select using (auth.uid() = user_id);
create policy "Users can create their gbp checklists" on public.gbp_checklists for insert with check (auth.uid() = user_id);
create policy "Users can update their gbp checklists" on public.gbp_checklists for update using (auth.uid() = user_id);
create policy "Users can delete their gbp checklists" on public.gbp_checklists for delete using (auth.uid() = user_id);

create trigger update_gbp_checklists_updated_at
  before update on public.gbp_checklists
  for each row execute function public.update_updated_at_column();

-- Grants da Data API (padrao do projeto)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gbp_checklists TO authenticated;
GRANT ALL ON public.gbp_checklists TO service_role;