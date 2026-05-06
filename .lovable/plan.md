## Entendimento

Você está certo: na última mudança, eu **substituí** a lógica cumulativa original do funil por uma contagem baseada apenas em histórico. Isso alterou o comportamento do funil (leads que pulam etapas deixaram de aparecer em estágios intermediários, e a lógica original de cumulatividade foi perdida).

O que você pediu era apenas **somar** ao funil atual a permanência de status anteriores — não trocar a lógica.

## Correção

Restaurar a lógica cumulativa original e usar o histórico apenas como **complemento aditivo** (união, OR lógico).

### Regra única

Um lead conta numa etapa se **qualquer uma** destas for verdadeira:
1. A lógica cumulativa original já o incluía (status atual = etapa, ou está em etapa posterior dentro do fluxo principal); **OU**
2. O `lead_status_history` registra que ele já passou por aquela etapa em algum momento.

Assim:
- Comportamento atual do funil (cumulativo) fica **intacto**.
- Quando você move um lead de "Reunião Realizada" → "Proposta Enviada" → "Em Negociação", ele continua contando em todas as etapas (já contava pela cumulatividade).
- Quando você move um lead **para trás** (ex: "Proposta Enviada" → "Sem Interesse"), o "+1" em "Proposta Enviada" **persiste** via histórico — que é exatamente o ganho que você pediu.
- Idem se um lead for movido para `sem_interesse` / `lead_perdido` depois de ter passado por reuniões: o histórico mantém a presença dele nessas etapas.

### Mudanças técnicas

**`src/pages/Funnel.tsx`**
- Restaurar a função `cumulativeCount` original (do funil antigo).
- Manter o carregamento de `lead_status_history` e o `historyByLead` Map.
- Criar `countStage(stage)` que faz: `cumulativo OR histórico` — contando leads distintos (sem duplicar).
- KPIs ("Engajados", "Reuniões", "Fechados") e painel "Desqualificados" voltam a usar a mesma regra combinada.
- Conversões entre etapas, larguras de barra, cores, filtros — **nada disso muda**.

### O que não muda
- Nenhuma migration nova. O backfill de histórico já feito permanece.
- Trigger `log_lead_status_change` continua igual.
- Status atual no card, Leads, Dashboard — sem alteração.
- Visual do funil — idêntico ao original.

### Resultado
Funil volta a se comportar exatamente como antes, com o único acréscimo de **nunca perder** a passagem de um lead por uma etapa, mesmo que ele seja movido para fora do fluxo principal depois.