## Objetivo
Aplicar no Lovable Cloud a migration do arquivo `supabase/20260724180000_google_calendar_integration.sql`, criando as tabelas de integração com Google Agenda com RLS e GRANTs.

## O que será feito

1. **Executar a migration** com o SQL do arquivo, ajustado para incluir os `GRANT` obrigatórios (que faltavam no arquivo original) e as políticas de INSERT/UPDATE que também estão ausentes — sem elas, edge functions e o próprio usuário não conseguem gravar tokens/links.

2. **Tabelas criadas** (usando `IF NOT EXISTS`, sem recriar nem apagar nada):
   - `public.google_calendar_connections` — armazena tokens OAuth do Google por usuário (access_token, refresh_token, expires_at, email, calendar_id).
   - `public.google_calendar_event_links` — vincula leads a eventos criados no Google Agenda.

3. **Segurança (RLS)**:
   - RLS ativa nas duas tabelas.
   - Usuários leem/apagam apenas seus próprios registros (`auth.uid() = user_id`).
   - `service_role` (usada pelas edge functions `google-calendar-auth` e `google-calendar-events`) tem acesso total para inserir/atualizar tokens e eventos.
   - `authenticated` recebe `SELECT/DELETE`; escrita direta pelo cliente não é necessária (fluxo passa pelas edge functions).

4. **Índices** em `user_id` e `lead_id` de `google_calendar_event_links` conforme o arquivo.

## SQL final da migration

```sql
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

grant select, delete on public.google_calendar_connections to authenticated;
grant all on public.google_calendar_connections to service_role;
grant select, delete on public.google_calendar_event_links to authenticated;
grant all on public.google_calendar_event_links to service_role;

alter table public.google_calendar_connections enable row level security;
alter table public.google_calendar_event_links enable row level security;

create policy "Users read own gcal connection"
  on public.google_calendar_connections for select
  using (auth.uid() = user_id);

create policy "Users delete own gcal connection"
  on public.google_calendar_connections for delete
  using (auth.uid() = user_id);

create policy "Users read own gcal event links"
  on public.google_calendar_event_links for select
  using (auth.uid() = user_id);

create policy "Users delete own gcal event links"
  on public.google_calendar_event_links for delete
  using (auth.uid() = user_id);

create index if not exists google_calendar_event_links_user_id_idx
  on public.google_calendar_event_links(user_id);

create index if not exists google_calendar_event_links_lead_id_idx
  on public.google_calendar_event_links(lead_id);
```

## Notas
- O arquivo original está fora da pasta `supabase/migrations/` e sem GRANTs — por isso a migration é reenviada aqui em versão corrigida.
- Nenhum código de frontend/edge function precisa mudar; `Agenda.tsx` e as functions `google-calendar-auth`/`google-calendar-events` já esperam esse schema.
