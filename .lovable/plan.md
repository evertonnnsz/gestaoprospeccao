

## Plano: Corrigir cadência dos Follow-ups (dinâmica em vez de fixa)

### Problema

Atualmente, ao criar um lead (manual, prospecção ou sala de espera), o sistema agenda os 3 follow-ups de uma vez (D+1, D+2, D+3). A regra aprovada diz que **apenas o Follow-up 1** deve ser agendado na criação. Os demais devem ser calculados dinamicamente quando cada follow-up anterior for concluído.

### Regra correta

- **Criação do lead**: Apenas `follow_up_1 = D+1`. `follow_up_2` e `follow_up_3` ficam `null`.
- **Ao concluir FU1**: `follow_up_2 = +2 dias úteis a partir de hoje` (já implementado).
- **Ao concluir FU2**: `follow_up_3 = +3 dias úteis a partir de hoje` (já implementado).
- **Renovar Follow-ups**: Também deve seguir a mesma lógica — agendar apenas FU1 para D+1, deixando FU2 e FU3 nulos.

### Alterações técnicas

**1. `src/lib/utils/followUpDates.ts`**
- Alterar `generateFollowUpDates` para retornar apenas `follow_up_1` preenchido. `follow_up_2` e `follow_up_3` retornam `null`.

**2. `src/components/leads/LeadForm.tsx`**
- Nenhuma mudança necessária (já usa `generateFollowUpDates`).

**3. `src/components/prospecting/StagingArea.tsx`**
- Nenhuma mudança necessária (já usa `generateFollowUpDates`).

**4. `src/components/leads/LeadCard.tsx`**
- `renewFollowUp`: já usa `generateFollowUpDates`, então herdará a mudança automaticamente — agendará apenas FU1.

Todas as 4 referências a `generateFollowUpDates` serão corrigidas pela mudança única na função utilitária.

