## Plano

Adicionar a coluna `guest_email` (text, nullable) na tabela `public.agenda_events` via migration, corrigindo o erro de schema cache ao salvar compromissos com convidado.

### SQL

```sql
ALTER TABLE public.agenda_events
ADD COLUMN IF NOT EXISTS guest_email text;
```

O schema cache do PostgREST é recarregado automaticamente após a migration, então o app volta a reconhecer o campo sem republicação manual.