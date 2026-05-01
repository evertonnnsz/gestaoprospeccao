## Objetivo

Permitir mudar o status do cliente entre **Ativo / Pausado / Churn** na aba Clientes e exibir a **Taxa de Churn** dentro do card "Taxas de Conversão" no Dashboard.

## Decisões

- **Status do cliente** (novo campo, separado de `monthly_payment_status`):
  - `active` — em operação normal
  - `paused` — temporariamente pausado (não conta como churn, mas sai dos KPIs ativos)
  - `churn` — saída definitiva
- **Onde alterar**: botão/Select de status no `ClientCard` (mudança rápida) e também no `ClientForm` (edição completa, com data e motivo).
- **Cálculo da taxa de churn**: `churn / (active + paused + churn)` — total de clientes que existiram vs. os que saíram. Mostrado como nova linha no card "Taxas de Conversão" do Dashboard, no mesmo padrão visual das outras taxas (ícone, %, contagem, barra).
- **Impacto financeiro**: clientes em `paused` ou `churn` saem dos cálculos de Faturamento Previsto / Recebido / A Receber (Clientes, Financeiro e Central Gamificada). Continuam no banco para histórico.

## Mudanças

### 1. Banco de dados (migration)

Adicionar à tabela `clients`:
- `status text not null default 'active'` — valores aceitos: `'active'` | `'paused'` | `'churn'`
- `churn_date date null`
- `churn_reason text null`

### 2. Tipos (`src/types/crm.ts`)

```ts
export type ClientStatus = 'active' | 'paused' | 'churn';

export interface Client {
  // ...campos atuais
  status: ClientStatus;
  churn_date: string | null;
  churn_reason: string | null;
}

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  churn: 'Churn',
};
```

### 3. `ClientCard.tsx`

- Badge colorido com o status atual (Ativo = verde, Pausado = âmbar, Churn = vermelho).
- Botão dropdown "Mudar Status" no header do card com as 3 opções; ao escolher Churn, abre confirmação rápida (preenche `churn_date = hoje` e pede `churn_reason` opcional).
- Card com opacidade reduzida quando `status !== 'active'`.

### 4. `ClientForm.tsx`

- Novo Select **Status do Cliente** (Ativo / Pausado / Churn).
- Quando "Churn" selecionado: campos opcionais **Data do Churn** (default hoje) e **Motivo**.
- Salvar no insert/update.

### 5. `src/pages/Clients.tsx`

- Toggle/abas: **Ativos | Pausados | Churn | Todos** (default Ativos).
- Atualizar `splitClientsRevenue` para considerar somente `active` no cálculo de Faturamento (Previsto/Recebido/A Receber).
- Mini-contador exibindo: "X ativos • Y pausados • Z churn".

### 6. `src/lib/utils/clientRevenue.ts`

- Filtrar internamente `status === 'active'` antes das somas.
- Adicionar:

```ts
export function calculateChurnRate(clients: Client[]) {
  const total = clients.length;
  const churned = clients.filter(c => c.status === 'churn').length;
  return {
    rate: total > 0 ? (churned / total) * 100 : 0,
    churned,
    total,
  };
}
```

### 7. `src/pages/Dashboard.tsx`

- Buscar `clients` no `useEffect` (além de `leads`).
- Calcular `calculateChurnRate(clients)`.
- Adicionar nova `RateRow` ao final do card **Taxas de Conversão**:
  - Ícone: `UserMinus` (lucide)
  - Label: "Taxa de Churn"
  - Cor: `text-destructive` / `bg-destructive`
  - Subtexto: `{churned} de {total} clientes`

### 8. Consistência em outras telas

- `GamifiedPanel.tsx` e `FinancialSummaryCards.tsx`: passam a refletir só clientes `active` automaticamente via `splitClientsRevenue`.
- `Funnel.tsx` e demais telas de leads: não impactados.

### 9. Memória

Atualizar `mem://features/client-management/core-logic` com o novo campo `status` (active/paused/churn) e a regra de exclusão de pausados/churn dos cálculos financeiros. Adicionar nota em `mem://features/metrics/core-logic` sobre a nova taxa de churn no Dashboard.

## Fora do escopo

- Histórico mensal de churn (cohort/evolução mês a mês).
- Lançamento automático em `financial_transactions` ao marcar churn.
- Reativação automatizada de cliente pausado (basta voltar o status manualmente).
