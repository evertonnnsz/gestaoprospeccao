-- Painel de Atividades do Dia: tarefas manuais e o "check" das atividades
-- geradas automaticamente (follow-ups, vencimentos, onboarding).
create table if not exists public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_date date not null,
  title text not null,
  notes text,
  priority text not null default 'normal' check (priority in ('urgente', 'alta', 'normal', 'baixa')),
  status text not null default 'a_fazer' check (status in ('a_fazer', 'em_andamento', 'concluida')),
  -- 'manual' para tarefas criadas no painel; demais tipos guardam o check de itens automáticos
  source_type text not null default 'manual' check (
    source_type in ('manual', 'recorrente', 'follow_up', 'follow_up_atrasado', 'contrato', 'pagamento', 'onboarding')
  ),
  -- Tarefa manual que se repete: a linha original é o modelo (task_date = início) e cada
  -- ocorrência concluída vira uma linha 'recorrente' com source_ref = id do modelo.
  recurrence text not null default 'nenhuma' check (recurrence in ('nenhuma', 'diaria', 'dias_uteis', 'semanal', 'mensal')),
  -- Identifica o item automático (ex.: id do lead ou do cliente). Tarefas manuais recebem um valor único.
  source_ref text not null default gen_random_uuid()::text,
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists daily_tasks_auto_item_unique
  on public.daily_tasks (user_id, source_type, source_ref, task_date);

create index if not exists daily_tasks_user_date_idx on public.daily_tasks (user_id, task_date);

alter table public.daily_tasks enable row level security;

create policy "Users can read their daily tasks"
  on public.daily_tasks for select
  using (auth.uid() = user_id);

create policy "Users can create their daily tasks"
  on public.daily_tasks for insert
  with check (auth.uid() = user_id);

create policy "Users can update their daily tasks"
  on public.daily_tasks for update
  using (auth.uid() = user_id);

create policy "Users can delete their daily tasks"
  on public.daily_tasks for delete
  using (auth.uid() = user_id);

create trigger update_daily_tasks_updated_at
  before update on public.daily_tasks
  for each row execute function public.update_updated_at_column();
