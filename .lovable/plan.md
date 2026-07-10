# Migration: WhatsApp Follow-up Automation

Vou aplicar a migration em `supabase/migrations/20260705120000_whatsapp_followup_automation.sql` no banco, com um ajuste obrigatório: adicionar `GRANT`s nas duas novas tabelas do schema `public` (sem isso o PostgREST bloqueia acesso, mesmo com RLS correta).

## O que será criado

- **Enums**
  - `public.whatsapp_message_status`: `draft`, `sent`, `failed`
  - `public.whatsapp_follow_up_step`: `initial`, `follow_up_1`, `follow_up_2`, `follow_up_3`, `custom`
- **Tabela `public.whatsapp_message_templates`** — modelos de mensagem por usuário (nome, etapa, corpo, ativo)
- **Tabela `public.whatsapp_message_logs`** — histórico de envios, ligada a `public.leads(id)` e opcionalmente a um template
- **RLS**: cada usuário só vê/edita seus próprios templates e logs (`auth.uid() = user_id`)
- **Trigger** `update_updated_at_column` em templates
- **Índices** por `(user_id, follow_up_step, is_active)`, `(user_id, lead_id, created_at)` e `(user_id, status, created_at)`

## Ajuste técnico (obrigatório)

Adicionar após cada `CREATE TABLE`:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_message_templates TO authenticated;
GRANT ALL ON public.whatsapp_message_templates TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_message_logs TO authenticated;
GRANT ALL ON public.whatsapp_message_logs TO service_role;
```

Sem `anon` — todo acesso é escopado por `auth.uid()`.

## Observações

- Nenhuma tabela existente é alterada; `public.leads` é apenas referenciada por FK.
- A migration é aplicada via ferramenta de migration do Lovable Cloud (aparece para sua aprovação antes de rodar).
- Nenhum código de frontend será tocado neste passo — só o banco.
