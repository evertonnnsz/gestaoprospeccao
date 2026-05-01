
# Reorganização do Funil de Prospecção

A aba atual mostra os status como uma grade de cards iguais, sem a sensação visual de "afunilamento". Vamos substituir por um funil real, desenhado, com métricas de conversão entre etapas e leads desqualificados separados ao lado.

## Nova estrutura da página

```text
┌──────────────────────────────────────────────────────────────────┐
│  Funil de Prospecção                       [Período] [Resposta]  │
│  555 leads no período selecionado                                │
├──────────────────────────────────────────────────────────────────┤
│  [Topo do Funil 555] [Engajados 235] [Reuniões 87] [Fechados 8]  │  ← KPIs resumo
├───────────────────────────────────────────────┬──────────────────┤
│                                               │  Desqualificados │
│        ████████████████████████████           │                  │
│         Lead Coletado          555            │  Sem Interesse   │
│                ↓ 42,2%                        │       176        │
│        ████████████████████                   │                  │
│         Contato Iniciado       234            │  Visualizou e    │
│                ↓ 33,8%                        │  Não Respondeu   │
│         ███████████████                       │       38         │
│         Interesse Demonstrado  79             │                  │
│                ↓ 59,5%                        │  Lead Perdido    │
│           ██████████                          │       8          │
│           Agendou Reunião      47             │                  │
│                ↓ 85,1%                        │  ─────────────   │
│            █████████                          │  Total           │
│            Reunião Realizada   40             │  Desqualificado  │
│                ↓ 82,5%                        │       222        │
│             ███████                           │                  │
│             Proposta Enviada   33             │                  │
│                ↓ 48,5%                        │                  │
│              █████                            │                  │
│              Em Negociação     16             │                  │
│                ↓ 50,0%                        │                  │
│               ██                              │                  │
│               Fechado          8              │                  │
│                                               │                  │
│  Conversão total Topo → Fechado: 1,4%         │                  │
└───────────────────────────────────────────────┴──────────────────┘
```

## O que muda visualmente

1. **Cards-resumo no topo (4 KPIs):**
   - Topo do Funil (Lead Coletado)
   - Engajados (Interesse Demonstrado, cumulativo)
   - Reuniões (Reunião Realizada, cumulativo)
   - Fechados

2. **Funil desenhado (coluna principal, ~70% da largura):**
   - Cada etapa é uma **barra horizontal centralizada** cuja largura é proporcional à quantidade de leads naquela etapa (mantendo a lógica cumulativa atual: cada etapa inclui as posteriores).
   - Cor de cada barra segue o badge da etapa (mesma paleta hoje em uso).
   - À direita da barra: número absoluto + % sobre o topo do funil.
   - Entre cada etapa, uma seta `↓` com a **taxa de conversão da etapa anterior** (ex: `↓ 42,2%`), destacada em verde se ≥ média e em cinza/laranja se baixa.
   - Linha final com a **conversão total Topo → Fechado**.

3. **Painel lateral "Desqualificados" (~30% da largura):**
   - Cards menores empilhados para `Sem Interesse`, `Visualizou e Não Respondeu` e `Lead Perdido` (estes saem do funil principal porque não representam avanço).
   - Total de desqualificados no rodapé.

4. **Card "Leads que Responderam"** continua existindo, mas movido para junto dos KPIs do topo (mais compacto, sem ocupar uma linha inteira).

5. **Filtros (Período + Respondeu)** permanecem no header, mantendo o comportamento atual.

## Detalhes técnicos

- **Arquivo único alterado:** `src/pages/Funnel.tsx` (reescrita do JSX, mantendo o fetch e a lógica `getLeadsByStatus` cumulativa que já existe).
- **Etapas do funil principal (em ordem):** `lead_coletado`, `contato_iniciado`, `interesse_demonstrado`, `agendou_reuniao`, `reuniao_realizada`, `proposta_enviada`, `em_negociacao`, `fechado`.
- **Etapas no painel lateral (não cumulativas):** `visualizou_nao_respondeu`, `sem_interesse`, `lead_perdido` — contagem direta de `l.status === X`.
- **Cálculo das barras:**
  ```ts
  const topo = getLeadsByStatus('lead_coletado').length;
  const widthPct = topo > 0 ? (count / topo) * 100 : 0;
  ```
  Largura mínima visual de ~8% para etapas com count > 0 (para a barra continuar legível).
- **Taxa de conversão entre etapas:**
  ```ts
  const conv = previousCount > 0 ? (currentCount / previousCount) * 100 : 0;
  ```
- **Cores das barras:** reutilizar tokens do design system já mapeados em `LeadStatusBadge` (`bg-primary`, `bg-success`, `bg-warning`, `bg-chart-4`, etc.) — sem cores hardcoded.
- **Responsividade:** em telas `< lg`, o painel "Desqualificados" desce para baixo do funil (grid `lg:grid-cols-[1fr_320px]` → empilhado no mobile).
- **Sem novas dependências.** Sem alterações no schema ou em outras páginas.

## Comportamento preservado

- Filtros `PeriodFilter` e `respondedFilter` continuam funcionando exatamente como hoje.
- Lógica cumulativa do funil (um lead "Fechado" também conta nas etapas anteriores) é mantida.
- Card "Leads que Responderam" continua presente.
