## Plano: Substituir card "Taxa de Fechamento" por "Propostas Enviadas"

### Contexto
No Dashboard há dois lugares mostrando "Taxa de Fechamento":
1. **Card KPI no topo** (grid de 4 cards) — este será substituído
2. **Bloco "Taxas de Conversão"** (com barra de progresso) — este NÃO será alterado

### Alteração

**Arquivo único: `src/pages/Dashboard.tsx`**

No grid de StatsCards (4 cards do topo), substituir o card atual:

```tsx
<StatsCard title="Taxa de Fechamento" value={`${closeRate.toFixed(1)}%`} icon={TrendingUp} variant="default" />
```

Por um novo card que conta leads com status `proposta_enviada`:

```tsx
<StatsCard title="Propostas Enviadas" value={proposalsSent} icon={FileText} variant="default" />
```

### Nova métrica
Adicionar o cálculo junto aos outros KPIs:
```tsx
const proposalsSent = filteredLeads.filter((l) => l.status === 'proposta_enviada').length;
```

### Ícone
Trocar `TrendingUp` por `FileText` (já presente no `lucide-react`) — mais semântico para "proposta".

### O que permanece intacto
- Bloco "Taxas de Conversão" com as 3 barras (Taxa de Resposta, Taxa de Reuniões, Taxa de Fechamento)
- Demais filtros e gráfico "Origem dos Leads"
- Os 3 outros cards KPI: Total de Leads, Reuniões Realizadas, Follow-ups do Dia

O card responde a todos os filtros já existentes (período, origem, status, segmento, respondeu).
