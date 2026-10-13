-- Catálogo de serviços da agência e orçamentos enviados para leads/clientes.
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text,
  price numeric(12, 2) not null default 0 check (price >= 0),
  billing text not null default 'mensal' check (billing in ('mensal', 'unico')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists services_user_idx on public.services (user_id, active);

alter table public.services enable row level security;

create policy "Users can read their services" on public.services for select using (auth.uid() = user_id);
create policy "Users can create their services" on public.services for insert with check (auth.uid() = user_id);
create policy "Users can update their services" on public.services for update using (auth.uid() = user_id);
create policy "Users can delete their services" on public.services for delete using (auth.uid() = user_id);

create trigger update_services_updated_at
  before update on public.services
  for each row execute function public.update_updated_at_column();

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null check (length(trim(client_name)) > 0),
  -- [{ service_id, title, description, price, quantity, billing }] — cópia dos serviços no momento do orçamento
  items jsonb not null default '[]'::jsonb,
  discount_type text not null default 'percent' check (discount_type in ('percent', 'value')),
  discount_value numeric(12, 2) not null default 0 check (discount_value >= 0),
  installments integer check (installments is null or installments between 2 and 24),
  valid_until date,
  notes text,
  status text not null default 'rascunho' check (status in ('rascunho', 'enviado', 'aprovado', 'recusado')),
  total_monthly numeric(12, 2) not null default 0,
  total_one_time numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quotes_user_created_idx on public.quotes (user_id, created_at desc);
create index if not exists quotes_lead_idx on public.quotes (lead_id);

alter table public.quotes enable row level security;

create policy "Users can read their quotes" on public.quotes for select using (auth.uid() = user_id);
create policy "Users can create their quotes" on public.quotes for insert with check (auth.uid() = user_id);
create policy "Users can update their quotes" on public.quotes for update using (auth.uid() = user_id);
create policy "Users can delete their quotes" on public.quotes for delete using (auth.uid() = user_id);

create trigger update_quotes_updated_at
  before update on public.quotes
  for each row execute function public.update_updated_at_column();
