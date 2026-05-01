## Problema

O filtro de período da aba **Financeiro** só está afetando a tabela de transações e os totais de receita/despesa de lançamentos manuais. Tudo o mais ignora o filtro:

- **Receita de Clientes / A Receber** (cards de resumo) somam todos os clientes, independente do período.
- **Central de Prospecção Gamificada** (leads, clientes, KPIs do topo, funil) usa sempre os dados completos.
- **Gráfico Receitas vs Despesas** mostra fixo os últimos 6 meses, ignorando o filtro.
- **Gráfico Despesas por Categoria** está OK (já usa `filteredTransactions`).

Resultado: ao escolher "Hoje", "Esta Semana" etc., grande parte dos números não muda.

## Solução

Aplicar o mesmo período/intervalo escolhido no `PeriodFilter` em **todas** as fontes de dados da página Financeiro.

### 1. Helper único de intervalo de datas
Criar `src/lib/utils/periodRange.ts` com `getPeriodRange(period, dateRange)` retornando `{ start: Date | null, end: Date | null }` (null = sem limite, caso `all`). Centraliza a regra hoje duplicada dentro de `filterByPeriod`.

### 2. Filtragem genérica por data arbitrária
Adicionar em `PeriodFilter.tsx` um helper `filterByPeriodGeneric<T>(items, period, dateRange, getDate)` que recebe um extrator de data, para reutilizar nas três entidades (transações, clientes, leads) sem depender do campo `approach_date`.

### 3. Aplicar o filtro em `Financial.tsx`

- **Transações**: continuam usando `transaction_date` (já funciona).
- **Clientes**: filtrar por `project_start_date` (data de início do contrato) — campo já existente no schema.
  - `splitClientsRevenue(filteredClients)` passa a alimentar `FinancialSummaryCards` e `GamifiedPanel`.
- **Leads**: filtrar por `approach_date` (com fallback em `created_at`) antes de passar para `GamifiedPanel`.
- O `GamifiedPanel` recebe leads/clients já filtrados — sem mudanças internas.

### 4. Gráfico Receitas vs Despesas respeitando o período

Em `Financial.tsx`, derivar `monthlyData` do intervalo selecionado:

- Se `period = today/week/month`: agrupar por dia dentro do intervalo.
- Se `period = year`: 12 meses do ano corrente.
- Se `period = all`: comportamento atual (últimos 6 meses).
- Se `period = custom`: usa `dateRange.from`/`to`, agrupando por dia se ≤ 60 dias, senão por mês.

Incluir também a "Receita de Clientes pagos" do período no income do mês/dia correspondente (usando `project_start_date` ou `payment_due_date` — usar `project_start_date` para manter consistência com a filtragem). Assim o gráfico passa a refletir o mesmo conceito dos cards.

### 5. Pequenos ajustes visuais

- Atualizar legendas dos cards (`FinancialSummaryCards`) para indicar "Período selecionado" também em "Recebido (Clientes)".
- Manter o `GamifiedPanel` mostrando o escopo do período (ex.: "Faturamento Mensal (Recebido)" continua, mas agora reflete o filtro — adicionar pequena legenda "no período selecionado").

## Arquivos afetados

- **Criar**: `src/lib/utils/periodRange.ts`
- **Editar**: `src/components/filters/PeriodFilter.tsx` (export do helper genérico)
- **Editar**: `src/pages/Financial.tsx` (filtragem de clients/leads + monthlyData dinâmico)
- **Editar**: `src/components/financial/FinancialSummaryCards.tsx` (legenda)
- **Editar**: `src/components/financial/gamified/GamifiedPanel.tsx` (legenda do bloco "Operação Atual")

## Observação

Não é necessário tocar no banco de dados — `project_start_date`, `approach_date`, `created_at` e `transaction_date` já existem nas tabelas correspondentes.