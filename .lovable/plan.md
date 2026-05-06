## Problema

Hoje o Funil (`src/pages/Funnel.tsx`) usa `cumulativeCount` baseado **apenas no status atual** do lead. Quando um lead avança de "Reunião Realizada" → "Proposta Enviada", a lógica cumulativa só funciona para etapas anteriores (proposta enviada conta para reunião realizada). Mas se o lead pula etapas, vai para `sem_interesse`, ou se a contagem precisa refletir todos que **já passaram** por cada estágio, o histórico se perde.

A boa notícia: o banco já registra cada mudança via a tabela `lead_status_history` (alimentada pelo trigger `log_lead_status_change`). Basta passar a usar esse histórico.

## Solução

Refatorar o cálculo do funil para que cada etapa conte **leads distintos que já passaram por aquele status alguma vez**, usando `lead_status_history`.

### Mudanças

**1. `src/pages/Funnel.tsx`**
- Carregar também `lead_status_history` (filtrado pelo usuário via RLS) junto com os leads.
- Construir um `Map<lead_id, Set<LeadStatus>>` com todos os status pelos quais cada lead passou.
- Substituir `cumulativeCount` por uma função que conta leads cujo histórico contém o status da etapa (ou que satisfazem a condição "responderam" pelo flag `responded`).
- Filtro de período continua aplicado sobre os leads (por `created_at`); o histórico é cruzado apenas para os leads visíveis.
- KPIs ("Engajados", "Reuniões", "Fechados") passam automaticamente a refletir o histórico.
- Painel "Desqualificados" (Visualizou / Sem Interesse / Lead Perdido) também passa a contar pelo histórico, mantendo a presença mesmo se o lead foi posteriormente movido.

**2. Garantir histórico retroativo (migration)**
O trigger só registra a partir de agora. Para que o funil já mostre dados consistentes desde já, rodar uma migration única que insere em `lead_status_history` o status atual de todos os leads que ainda não têm registro. Isso garante que cada lead existente apareça pelo menos no estágio em que está hoje.

```sql
INSERT INTO public.lead_status_history (lead_id, user_id, status, changed_at)
SELECT l.id, l.user_id, l.status, COALESCE(l.updated_at, l.created_at, now())
FROM public.leads l
WHERE l.status IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.lead_status_history h WHERE h.lead_id = l.id
  );
```

(Não toca em leads que já têm histórico; idempotente.)

### O que NÃO muda
- Status atual continua sendo o que aparece no card do lead, na aba Leads, no Dashboard, etc.
- Trigger `log_lead_status_change` já existente continua sendo a única fonte de novos registros.
- RLS do `lead_status_history` já garante isolamento por usuário.
- Lógica de "Conversão Topo → Fechado", larguras das barras e cores permanecem iguais.

### Resultado esperado
Mover um lead de "Reunião Realizada" para "Proposta Enviada" mantém o "+1" em Reunião Realizada no funil — porque o lead aparece no histórico de ambos os estágios. O mesmo vale para qualquer transição futura.
