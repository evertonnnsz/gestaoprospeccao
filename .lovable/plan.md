## Problema

Hoje o Funil conta cada lead pelo **status atual**. Quando um lead passa de "Reunião Realizada" → "Proposta Enviada", ele some da contagem de "Reunião Realizada", distorcendo o histórico real (você viu 42 reuniões caírem ao avançar leads).

A lógica cumulativa atual já tenta resolver isso assumindo que estágios posteriores "passaram pelos anteriores", mas isso só funciona no caminho linear. Se um lead pula etapas, volta atrás, ou é marcado como "Sem Interesse" / "Lead Perdido" depois de uma reunião, o histórico se perde.

## Solução

Registrar **todo histórico de status** de cada lead numa tabela separada e usar esse histórico (não o status atual) para alimentar o Funil.

## Mudanças

### 1. Banco — nova tabela `lead_status_history`

```
id          uuid pk
lead_id     uuid (referência lógica a leads.id)
user_id     uuid (para RLS)
status      lead_status
changed_at  timestamptz default now()
```

- RLS: usuário só vê/insere as próprias linhas (`auth.uid() = user_id`).
- Índice em `(lead_id, status)` e `(user_id, changed_at)`.

### 2. Trigger no Supabase

- **AFTER INSERT em `leads`**: grava 1 linha com o status inicial.
- **AFTER UPDATE em `leads`** (quando `OLD.status IS DISTINCT FROM NEW.status`): grava nova linha.

Assim qualquer mudança de status — pelo card, pelo form, em massa — é registrada automaticamente, sem alterar código de UI.

### 3. Backfill (uma vez)

Migration popula `lead_status_history` com o status atual de todos os leads existentes (usando `created_at`), garantindo que o funil já mostre o passado.

### 4. `Funnel.tsx` — passar a usar o histórico

- Buscar `lead_status_history` (com filtro de período aplicado em `changed_at`) além de `leads`.
- Para cada estágio do funil, contar **leads distintos que JÁ passaram por aquele status** (`COUNT(DISTINCT lead_id) WHERE status = X`).
- A regra "cumulativa" simplifica: não precisa mais inferir que "quem está em proposta_enviada também passou por reunião_realizada", pois cada um terá sua própria linha no histórico.
- Estágios especiais:
  - `lead_coletado`: total de leads no período (continua igual).
  - `responderam`: continua usando `leads.responded = true` (não é estágio).
  - `fechado` / `lead_perdido` / `sem_interesse` / `visualizou_nao_respondeu`: contar via histórico.

Resultado: marcar um lead como "Proposta Enviada" não remove a reunião realizada anterior do funil.

### 5. Filtro de período no Funil

- Continua aplicando ao lead (data de abordagem) para o universo, mas a contagem por estágio passa a olhar `changed_at` do histórico dentro do mesmo período. Mantém comportamento esperado: "no mês X, quantas reuniões aconteceram".

### 6. Sem impacto em outras telas

- `Dashboard`, `Clients`, métricas e financeiro continuam baseados no status atual — nada muda lá.
- `LeadCard`/`LeadForm` não precisam mudar; o trigger cuida do registro.

## Fora do escopo

- UI mostrando o histórico completo de um lead (timeline). Pode ser feito depois — a base de dados já vai existir.
- Edição/remoção manual de eventos do histórico.
