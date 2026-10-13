# Aplicar migration pendente do GitHub: gbp_analyses

## Estado atual

- `20261012120000_daily_tasks.sql` — já aplicada na sessão anterior. **Pular.**
- `20261012130000_client_comments.sql` — já aplicada na sessão anterior. **Pular.**
- `20261013120000_gbp_analyses.sql` — **pendente**, é a única a aplicar.

## O que fazer

Aplicar `supabase/migrations/20261013120000_gbp_analyses.sql` sem alteração de conteúdo. Ela cria:

- Tabela `public.gbp_analyses` — guarda os diagnósticos de Google Meu Negócio (perfil, checklist, concorrentes, avaliações, nota de 0 a 100), vinculados opcionalmente a um lead ou cliente.
- 4 índices (por usuário/data, por perfil, por lead, por cliente).
- RLS com 4 policies por `auth.uid()` — cada usuário só vê as próprias análises.

Usa `create table if not exists`, então é segura mesmo se algo já existir.

## Passos

1. Aplicar o SQL verbatim via migration.
2. Adicionar os `GRANT`s da Data API (padrão do projeto: `authenticated` para CRUD, `service_role` para tudo) — o arquivo do GitHub não os inclui e sem eles o app recebe erro de permissão.
3. Verificar no banco que a tabela existe com RLS ativo e policies criadas.

## Detalhe técnico

- A edge function `gbp-analyze` já faz insert nessa tabela; após a migration, os diagnósticos da página Google Meu Negócio passam a ser salvos.
- Nenhum código do front precisa mudar nesta etapa.
