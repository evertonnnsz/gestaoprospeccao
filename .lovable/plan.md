## Problema

Dashboard e Funil divergem porque usam fontes diferentes:

- **Funil** (atualizado recentemente): conta via `lead_status_history` — qualquer lead que JÁ passou pela etapa entra na contagem, mesmo se o status atual avançou.
- **Dashboard**: ainda conta pelo `status` **atual** do lead:
  - "Reuniões Realizadas" = leads cujo status atual está em `reuniao_realizada` ou posterior
  - "Propostas Enviadas" = leads cujo status atual está em `proposta_enviada` ou posterior
  - "Taxa de Fechamento" = leads cujo status atual é `fechado`

Resultado: assim que um lead avança (ex.: `reuniao_realizada` → `proposta_enviada`), o Dashboard tira ele da reunião realizada — exatamente o problema que motivou a criação do histórico no Funil. Os números deixam de bater.

## Solução

Migrar o Dashboard para a mesma fonte de verdade do Funil: `lead_status_history`. Assim, contagens de etapas viram **eventos históricos** e batem 1:1 com o Funil para o mesmo período/filtros.

## Mudanças em `src/pages/Dashboard.tsx`

1. **Buscar histórico** junto com `leads` e `clients`:
   - `supabase.from('lead_status_history').select('lead_id, status, changed_at')`
   - Guardar em estado `history`.

2. **Restringir histórico aos leads filtrados** (mesmo padrão do Funil):
   - `filteredHistory` = entradas cujo `lead_id` está em `filteredLeads`.

3. **Recalcular KPIs de etapa via histórico** (helper `countByHistory` igual ao do Funil — contar `lead_id` distinto por status):
   - `meetingsHeld` = `countByHistory(filteredHistory, 'reuniao_realizada')`
   - `proposalsSent` = `countByHistory(filteredHistory, 'proposta_enviada')`
   - `closedLeads` = `countByHistory(filteredHistory, 'fechado')`
   - Remover `MEETING_STATUSES` e `PROPOSAL_OR_BEYOND` (não são mais necessários).

4. **Manter inalterados**:
   - `totalLeads` (universo do período).
   - `respondedLeads` / `responseRate` (baseado no flag `responded`).
   - `todayFollowUps` (baseado em datas do lead).
   - Churn (baseado em `clients`).
   - Gráfico "Origem dos Leads" (baseado nos leads filtrados).

5. **Taxas de conversão** continuam dividindo pelo `totalLeads`, agora consistente com o Funil:
   - `meetingRate = meetingsHeld / totalLeads`
   - `closeRate = closedLeads / totalLeads`

## Resultado esperado

- Cards "Reuniões Realizadas", "Propostas Enviadas" e a "Taxa de Fechamento" no Dashboard passarão a refletir os mesmos números das respectivas etapas no Funil, para o mesmo período.
- Avançar um lead de etapa não diminuirá mais nenhuma contagem anterior no Dashboard.

## Fora do escopo

- Mudanças no Funil, Clients, Financeiro ou Customer Success.
- Novos filtros ou UI — apenas troca da fonte de dados das métricas afetadas.
