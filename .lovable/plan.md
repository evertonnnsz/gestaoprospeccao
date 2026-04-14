

## Plano: Espaçar Follow-ups (48h e 72h entre cada um)

### Situação atual
Os 3 follow-ups são agendados em dias úteis consecutivos: D+1, D+2, D+3. Resultado: datas muito próximas (ex: 15/04, 16/04, 17/04).

### Nova regra
- **Follow-up 1**: 1 dia útil após a criação (D+1)
- **Follow-up 2**: 2 dias úteis **após o Follow-up 1** (48h de intervalo) → D+3
- **Follow-up 3**: 3 dias úteis **após o Follow-up 2** (72h de intervalo) → D+6

Exemplo com base em 14/04 (segunda):
- FU1: 15/04 (terça)
- FU2: 17/04 (quinta) — 2 dias úteis depois do FU1
- FU3: 22/04 (quarta) — 3 dias úteis depois do FU2

### Alteração técnica

**Arquivo único: `src/lib/utils/followUpDates.ts`**

Alterar `generateFollowUpDates` para calcular as datas de forma escalonada:
```
follow_up_1 = base + 1 dia útil
follow_up_2 = follow_up_1 + 2 dias úteis
follow_up_3 = follow_up_2 + 3 dias úteis
```

Isso afeta automaticamente todos os pontos que usam essa função: criação de lead, importação da sala de espera e renovação de follow-ups.

