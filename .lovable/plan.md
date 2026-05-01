## Problema

O número de "Propostas Enviadas" diverge entre as abas:

- **Dashboard**: conta apenas leads com `status === 'proposta_enviada'` (status atual). Se um lead recebeu proposta e avançou para "Em Negociação", "Fechado" ou "Lead Perdido", ele deixa de ser contado.
- **Funil**: conta de forma **cumulativa** — todo lead que passou pela etapa de proposta é incluído (proposta_enviada + em_negociacao + fechado + lead_perdido).

Resultado: Dashboard mostra um número menor que o Funil, mesmo medindo a "mesma coisa".

## Decisão

Alinhar o **Dashboard à lógica cumulativa do Funil**. "Propostas Enviadas" é uma métrica de volume comercial — deve refletir todas as propostas já enviadas, independentemente do desfecho posterior. Essa é a interpretação correta para acompanhamento de produtividade e mantém consistência com a lógica cumulativa já estabelecida no projeto.

## Mudança

**Arquivo**: `src/pages/Dashboard.tsx`

Substituir o cálculo atual:
```ts
const proposalsSent = filteredLeads.filter((l) => l.status === 'proposta_enviada').length;
```

Por uma versão cumulativa que inclua todos os status que vêm depois da etapa de proposta:
```ts
const PROPOSAL_OR_BEYOND: LeadStatus[] = [
  'proposta_enviada',
  'em_negociacao',
  'fechado',
  'lead_perdido',
];
const proposalsSent = filteredLeads.filter((l) =>
  PROPOSAL_OR_BEYOND.includes(l.status as LeadStatus)
).length;
```

Observações:
- "Reuniões Realizadas" no Dashboard já usa lógica cumulativa parecida (`MEETING_STATUSES` inclui status posteriores), então essa correção segue o padrão já existente do próprio arquivo.
- O `onClick` do card que navega para `/leads?status=reuniao_realizada` continua funcionando — o card de Propostas Enviadas navega para `/leads?status=proposta_enviada`, o que ainda faz sentido como "ver leads atualmente nessa etapa". Sem mudança aí.
- Após a correção, o número de "Propostas Enviadas" no Dashboard passa a bater com a etapa "Proposta Enviada" do funil.

## Memória

Atualizar `mem://features/metrics/core-logic` para registrar que "Propostas Enviadas" no Dashboard usa contagem cumulativa (proposta_enviada + em_negociacao + fechado + lead_perdido), garantindo paridade com o Funil.