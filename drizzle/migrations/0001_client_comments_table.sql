-- Comentários por cliente (aba "Atividade" do cliente, no estilo do painel de atividade do ClickUp).
create table if not exists public.client_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists client_comments_client_idx on public.client_comments (client_id, created_at desc);

alter table public.client_comments enable row level security;

create policy "Users can read their client comments"
  on public.client_comments for select
  using (auth.uid() = user_id);

create policy "Users can create their client comments"
  on public.client_comments for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their client comments"
  on public.client_comments for delete
  using (auth.uid() = user_id);