## Plano

### 1. Migration `agenda_events`
Rodar o SQL de `supabase/migrations/20260725120000_agenda_events.sql` no Lovable Cloud, com dois ajustes obrigatórios (o arquivo original não os inclui e sem eles a Data API bloqueia a tabela e um trigger fica faltando):

- Adicionar `GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_events TO authenticated;` e `GRANT ALL ON public.agenda_events TO service_role;` logo após o `CREATE TABLE`.
- Criar trigger `BEFORE UPDATE` usando a função existente `public.update_updated_at_column()` para manter `updated_at`.

Estrutura preservada do arquivo: colunas, checks (`source_type`, `event_type`, `status`, vínculo lead/client), índices e as 4 políticas RLS por `auth.uid() = user_id`.

### 2. Republicar edge function
Redeploy de `google-calendar-events` (já atualizada no repo para ler `agenda_events` via `agendaEventId` e gravar `google_event_id` / `google_event_link` de volta na linha do compromisso).

### 3. Confirmação
- Verificar via `read_query` que `public.agenda_events` existe e tem RLS ativa.
- Confirmar no retorno do deploy que `google-calendar-events` subiu sem erro.
