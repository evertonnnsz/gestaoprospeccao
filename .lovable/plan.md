
## Problema

Hoje o "faturamento de clientes" é calculado somando o `project_value` de **todos** os contratos, ignorando o `monthly_payment_status`. Quando você marca um cliente como **Pendente** ou **Atrasado** no cadastro, o número de faturamento não muda — o que esconde a realidade do que efetivamente entrou no caixa.

A aba **Clientes** ainda não tem nenhum bloco de faturamento; só os cards individuais. Os cards de faturamento ficam no **Financeiro** ("Receita de Clientes") e na **Central Gamificada** ("Faturamento Mensal Atual").

## Decisão

1. Adicionar um **resumo de faturamento do mês no topo da aba Clientes**, refletindo o status de pagamento.
2. **Atualizar** os cards já existentes no Financeiro e na Central Gamificada para usar a mesma lógica baseada em status — assim o número fica consistente em todo o app.

Critério: um cliente só conta no "Faturamento Recebido" do mês quando está com status **Pago**. Pendente e Atrasado entram em "A Receber".

## Mudanças

### 1. Aba Clientes — novo bloco de resumo (`src/pages/Clients.tsx`)

Adicionar 3 cards compactos acima da busca:

| Card | Cálculo | Cor |
|---|---|---|
| Faturamento Previsto | soma de `project_value` de todos clientes | neutro |
| Recebido no Mês | soma de `project_value` onde `monthly_payment_status = 'paid'` | verde |
| A Receber | soma onde status é `pending` ou `overdue` | amarelo / destaque |

Reutilizar `Card` / `CardContent` do shadcn. Mostrar também a contagem de clientes em cada bucket (ex.: "3 clientes pagos").

### 2. Financeiro — `FinancialSummaryCards` (`src/components/financial/FinancialSummaryCards.tsx` + `src/pages/Financial.tsx`)

- Trocar o card "Receita de Clientes" por **"Recebido (Clientes)"** = soma de `project_value` apenas dos `paid`.
- Atualizar o card "Receita Total" e "Saldo" para usar esse novo valor (recebido), em vez do total bruto. Saldo passa a refletir caixa real.

### 3. Central Gamificada — `GamifiedPanel.tsx`

- "Faturamento Mensal Atual" passa a somar apenas clientes com `monthly_payment_status = 'paid'`.
- "Número de Clientes Ativos" continua contando todos os contratos (para não distorcer ticket médio).
- "Ticket Médio Base" continua sendo `faturamento previsto / clientes` (base do simulador), com tooltip explicando.

### 4. Memória

Atualizar `mem://features/client-management/core-logic` registrando que faturamento agregado considera `monthly_payment_status` (`paid` = recebido, `pending`/`overdue` = a receber).

## Detalhes técnicos

- Helper utilitário em `src/lib/utils/clientRevenue.ts`:
  ```ts
  export function splitClientsRevenue(clients: Client[]) {
    const sum = (list: Client[]) => list.reduce((s, c) => s + (Number(c.project_value) || 0), 0);
    const paid = clients.filter(c => c.monthly_payment_status === 'paid');
    const pending = clients.filter(c => c.monthly_payment_status === 'pending' || c.monthly_payment_status === 'overdue');
    return {
      total: sum(clients),
      received: sum(paid),
      receivable: sum(pending),
      paidCount: paid.length,
      receivableCount: pending.length,
    };
  }
  ```
- Importar e usar em `Clients.tsx`, `Financial.tsx` e `GamifiedPanel.tsx`.
- Não mexer em RLS nem em schema (campo `monthly_payment_status` já existe na tabela `clients`).

## Fora do escopo

- Não estamos criando histórico mensal de pagamento (hoje há um único status por cliente).
- Não vamos criar lançamento automático em `financial_transactions` ao marcar pago — fica como possível próximo passo.
