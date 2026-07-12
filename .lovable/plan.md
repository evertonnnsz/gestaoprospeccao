# Plano: Adicionar campos de reunião à tabela leads

## Objetivo
Garantir que o banco de dados aceite e persista os campos `meeting_date`, `meeting_time` e `meeting_notes` já utilizados no formulário de leads, e atualizar o schema cache do Supabase para que o app consiga salvá-los.

## O que será feito

1. **Migration no banco de dados**
   - Adicionar três colunas novas à tabela `public.leads`:
     - `meeting_date` do tipo `DATE`, nullable
     - `meeting_time` do tipo `TIME`, nullable
     - `meeting_notes` do tipo `TEXT`, nullable
   - Usar `ADD COLUMN IF NOT EXISTS` para evitar erro caso as colunas já existam.
   - Nenhuma tabela existente será recriada ou apagada.

2. **Atualização do schema cache**
   - Após a migration ser aprovada e executada, regenerar os tipos do Supabase (`src/integrations/supabase/types.ts`) para refletir as novas colunas.
   - Isso permite que o client do Supabase envie e receba os campos sem erros de schema.

3. **Verificação**
   - Validar que o build do projeto continua passando após a atualização dos tipos.

## Notas técnicas

- Os campos já estão presentes na interface `Lead` (`src/types/crm.ts`) e no `LeadForm` (`src/components/leads/LeadForm.tsx`), então nenhuma mudança de frontend é necessária além da regeneração dos tipos.
- A tabela `leads` já possui RLS ativa; adicionar colunas não afeta as políticas existentes.
- A migration usará apenas `ALTER TABLE`; nenhum dado existente será modificado.

## SQL da migration

```sql
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS meeting_date DATE,
  ADD COLUMN IF NOT EXISTS meeting_time TIME,
  ADD COLUMN IF NOT EXISTS meeting_notes TEXT;
```
