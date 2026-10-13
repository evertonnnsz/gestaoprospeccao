# Aplicar migrations pendentes do GitHub

## O que fazer

Aplicar, sem alteração de conteúdo, as duas migrations que chegaram do GitHub:

1. `supabase/migrations/20261012120000_daily_tasks.sql`
   - Cria `public.daily_tasks` (tarefas do painel de Atividades do Dia: manuais + checks de itens automáticos), com índices, RLS (4 policies por `auth.uid()`), trigger de `updated_at`.
2. `supabase/migrations/20261012130000_client_comments.sql`
   - Cria `public.client_comments` (comentários por cliente), com índice, RLS (3 policies por `auth.uid()`).

Ambas usam `create table if not exists`, então são seguras mesmo se algo já existir.

## Passos

1. Aplicar `20261012120000_daily_tasks.sql` via migration (SQL verbatim).
2. Aplicar `20261012130000_client_comments.sql` via migration (SQL verbatim).
3. Verificar no banco que as duas tabelas existem com RLS ativo e policies criadas.
4. Complemento de permissão: as migrations não incluem `GRANT`s para a Data API (padrão do projeto: `authenticated` para CRUD, `service_role` para tudo). Será adicionado um `GRANT` separado (sem mexer no conteúdo dos arquivos) para que o app consiga ler/escrever as tabelas — sem isso as queries do front retornam erro de permissão.

## Detalhe técnico

- RLS mantém o isolamento por usuário já usado em todo o projeto (cada usuário só vê os próprios dados).
- `daily_tasks` referencia `public.leads` e `public.clients` por `user_id` do próprio usuário; `client_comments` referencia `public.clients` com cascade.
- Nenhum código do front precisa mudar nesta etapa (a página já consulta essas tabelas via `supabase`).
