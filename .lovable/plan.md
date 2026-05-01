## Plano: Trocar "Taxa de Fechamento" por "Taxa de Proposta Enviada"

### Decisão
Substituir a métrica **Taxa de Fechamento** (status `fechado`) pela **Taxa de Proposta Enviada** (status `proposta_enviada`) no Dashboard. A métrica aparece em dois lugares: no `StatsCard` superior e na seção de taxas de conversão (`RateRow`).

### Alterações em `src/pages/Dashboard.tsx`

1. **Cálculo (linhas ~140 e ~150)**
   - `closedLeads` → `proposalsSent`: filtrar por `status === 'proposta_enviada'`.
   - `closeRate` → `proposalRate`: `(proposalsSent / totalLeads) * 100`.

2. **StatsCard (linha ~259)**
   - Título: `"Taxa de Fechamento"` → `"Taxa de Proposta Enviada"`.
   - Valor passa a usar `proposalRate`.

3. **RateRow (linhas ~335-343)**
   - `label`: `"Taxa de Fechamento"` → `"Taxa de Proposta Enviada"`.
   - `rate={proposalRate}` e `count={proposalsSent}`.

### Observação
A "Taxa de Reuniões" continua agregando `proposta_enviada` como sucesso (regra existente da memória de métricas), portanto não há conflito — ela mede o funil até reunião/proposta, enquanto a nova taxa isola apenas quem chegou na fase de proposta enviada.