
## Reformulação da aba Financeiro — Central Gamificada

A imagem mostra um painel gamificado que combina **financeiro + prospecção + funil**. Vou reformular a aba "Financeiro" para esse formato, mantendo intactas as transações (lançamentos manuais) embaixo e adicionando todo o painel gamificado em cima.

### 1. Cabeçalho

Trocar o título atual por:
- **CENTRAL DE PROSPECÇÃO GAMIFICADA** (com ícone de joystick) à esquerda
- Nome da empresa do usuário (vindo de `profiles.company_name`) à direita, em destaque laranja

### 2. Faixa superior — 4 KPIs gamificados

Cards grandes com ícone, número grande e legenda:

| Card | Ícone | Valor | Cálculo |
|---|---|---|---|
| **OFENSIVA** | 🔥 | Dias seguidos de prospecção | Sequência de dias consecutivos com pelo menos 1 lead criado (`leads.created_at`) até hoje |
| **META DIÁRIA** | 🎯 | `feito / planejado` | feito = leads criados hoje; planejado = "Ação Diária" do simulador (ver seção 3) |
| **ACUMULADO** | 🚀 | Total de disparos frios | Total de leads do usuário (todos os tempos) |
| **CONVERSÃO DE VENDAS** | 🏆 | % | clientes fechados ÷ total de leads × 100 |

### 3. Bloco "SUA OPERAÇÃO ATUAL" (coluna 1)

Lê dados reais do CRM:
- **Faturamento Mensal Atual**: soma de `clients.project_value` dos contratos ativos (destaque azul-escuro)
- **Número de Clientes Ativos**: count de `clients` (destaque azul-escuro)
- **Ticket Médio Base (Autom.)**: faturamento ÷ clientes (calculado, fundo claro)

### 4. Bloco "SIMULADOR (FUTURO)" (coluna 2) — interativo

Inputs editáveis (persistidos em nova tabela `prospecting_goals` por usuário):
- **Novo Faturamento Desejado** (input R$, destaque)
- **Ticket Lançamento Prospecção** (input R$, destaque)
- **Prazo a Bater (Meses)** (input número, destaque)

Calculados automaticamente (fundo claro):
- **Total Clientes p/ Bater Meta** = Faturamento Desejado ÷ Ticket
- **Faltam X Novos Clientes** = Total − Clientes Ativos
- **Taxa Conversão Planejada** (input %, destaque) — usuário define
- **Disparos por Mês** = Faltam Clientes ÷ Taxa ÷ Prazo
- **Disparos por Semana** = Mês ÷ 4
- **AÇÃO DIÁRIA** = Semana ÷ 5 (dias úteis), em destaque laranja grande

### 5. Bloco "SEU FUNIL REAL" (coluna 3)

Lê do CRM (mesma lógica cumulativa do Funil):
- **Prospecções Frias Totais**: total de leads
- **Respostas Totais (Sim)**: leads com `responded = true`
- **Reuniões Totais (Sim)**: leads em `reuniao_realizada` ou posteriores
- **CONTRATOS FECHADOS (Sim)**: leads em `fechado` (destaque verde)

Taxas calculadas:
- **Taxa Resposta (Warm-up)** = Respostas ÷ Prospecções
- **Taxa Agendamento (Quente)** = Reuniões ÷ Respostas
- **Taxa Fechamento (Deal Won)** = Fechados ÷ Reuniões

### 6. Bloco "FEEDBACK DO SISTEMA" (coluna 4)

Card de alerta dinâmico:
- Se conversão real < taxa planejada → **MODO DE ALERTA** (fundo amarelo claro): "Sua conversão global está em X% e a sua grande meta exige Y%. Verifique em qual etapa do funil o prospect esfriou e ajuste sua abordagem."
- Se conversão real ≥ planejada → **MODO META** (fundo verde): mensagem de parabéns
- Se sem dados → mensagem instrucional

### 7. Manter abaixo (sem mudança)

- Transações financeiras (tabela + form)
- Gráficos Receita vs Despesas e Despesas por Categoria
- Filtro de período e exportar

### Detalhes técnicos

**Nova tabela** `prospecting_goals`:
- `id`, `user_id` (FK auth.users, unique), `desired_revenue numeric`, `launch_ticket numeric`, `deadline_months int`, `planned_conversion_rate numeric`, `created_at`, `updated_at`
- RLS: usuário só lê/escreve o próprio registro
- Upsert ao editar inputs do simulador (debounce 800ms)

**Novos componentes** em `src/components/financial/gamified/`:
- `GamifiedHeader.tsx`
- `KpiStrip.tsx` (4 cards do topo)
- `OperationCard.tsx`
- `SimulatorCard.tsx` (com inputs e cálculos)
- `RealFunnelCard.tsx`
- `SystemFeedbackCard.tsx`

**Arquivos modificados**:
- `src/pages/Financial.tsx`: monta o painel gamificado acima do conteúdo atual; busca `leads`, `clients`, `prospecting_goals` e `profiles.company_name`
- Migration SQL para criar `prospecting_goals` + RLS + trigger `updated_at`

**Cálculo da Ofensiva**: query distinta de `date(created_at)` em `leads`, ordenada desc, conta dias consecutivos a partir de hoje (ou ontem) sem gaps.

**Paleta**: manter design system atual (azul primário, laranja como `--warning` ou accent novo). Cards com fundo claro padrão e os "valores destaque" da imagem usam fundo `bg-primary text-primary-foreground` (azul-escuro) ou `bg-warning` (laranja para Ação Diária).

### Fora do escopo

- Não alterar o Dashboard nem o Funil
- Não mexer em transações financeiras existentes
- Não adicionar gráficos novos ao painel gamificado (só números, como na imagem)
