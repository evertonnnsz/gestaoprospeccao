

## Plano: Alterar cadência dos Follow-ups

### O que muda

A lógica atual agenda os 3 follow-ups em dias úteis consecutivos (D+1, D+2, D+3 a partir da data base). A nova regra será:

- **Follow-up 1**: 1 dia útil após o primeiro contato (D+1) -- sem mudança
- **Follow-up 2**: 2 dias úteis após o último contato (D+2) -- sem mudança numérica mas a semântica muda
- **Follow-up 3**: 3 dias úteis após o último contato (D+3) -- sem mudança numérica

Na prática, como todos partem da mesma data base (data de criação ou data atual na renovação), os valores D+1, D+2, D+3 em dias úteis permanecem iguais ao que já está implementado. A diferença real seria se o follow-up 2 e 3 devessem ser recalculados com base na data do último contato efetivo (quando o usuário conclui o follow-up anterior).

**Interpretação provável**: Ao concluir o Follow-up 1, o sistema deve recalcular Follow-up 2 para D+2 a partir daquele momento. Ao concluir o Follow-up 2, recalcular Follow-up 3 para D+3 a partir daquele momento. Isso cria uma cadência dinâmica em vez de fixa.

### Alterações técnicas

**1. `src/lib/utils/followUpDates.ts`**
- Manter `generateFollowUpDates` para criação inicial (D+1, D+2, D+3 a partir da data base)
- Adicionar nova função `generateNextFollowUpFromContact(contactDate: Date, followUpNumber: 2 | 3)` que calcula o próximo follow-up com base na data do último contato:
  - Follow-up 2: +2 dias úteis a partir do contato
  - Follow-up 3: +3 dias úteis a partir do contato

**2. `src/components/leads/LeadCard.tsx`** — função `completeFollowUp`
- Ao concluir Follow-up 1: além de limpar `follow_up_1`, recalcular `follow_up_2` para +2 dias úteis a partir de hoje
- Ao concluir Follow-up 2: além de limpar `follow_up_2`, recalcular `follow_up_3` para +3 dias úteis a partir de hoje
- Ao concluir Follow-up 3: apenas limpa `follow_up_3` (comportamento atual)

Isso garante que a cadência se adapta ao momento real do contato, não à data de criação do lead.

