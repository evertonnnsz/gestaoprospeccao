## Plano: Reformular Dashboard e remover aba Métricas

### Objetivo
Centralizar toda a análise no Dashboard, substituir o gráfico "Distribuição por Status" por **Origem dos Leads** (categorias fixas), substituir "Leads Recentes" por cards de **taxas de conversão**, adicionar **filtros inteligentes** e **remover a aba Métricas** do app.

---

### 1. Padronizar Origens dos Leads (lead_source)

Hoje o campo `lead_source` é texto livre (`"Ex: LinkedIn, Indicação, Site"`) e a Prospecção grava `"Prospecção Inteligente"` / `"Importação de Lista"`. Para metrificar de forma consistente, vamos padronizar 5 categorias:

- **Tráfego**
- **WhatsApp**
- **Instagram**
- **PaP** (Porta a Porta)
- **Cold Call**

**Mudanças:**
- `src/components/leads/LeadForm.tsx`: trocar o Input de "Origem do Lead" por um `Select` com as 5 opções acima.
- Criar uma constante `LEAD_SOURCES` em `src/types/crm.ts` para reutilizar.
- Leads antigos com origem em texto livre continuarão exibindo, mas serão agrupados em "Outros" no gráfico.
- Prospecção/Staging continuarão gravando seus valores atuais (caem em "Outros" — não impacta a operação).

---

### 2. Reformular Dashboard (`src/pages/Dashboard.tsx`)

**Substituições visuais:**

`Distribuição por Status` (PieChart) → **Origem dos Leads** (BarChart)
- Eixo X: as 5 categorias fixas (+ "Outros" se houver)
- Eixo Y: contagem de leads no período filtrado
- Cores diferentes por barra

`Leads Recentes` (lista) → **Taxas de Conversão** (3 cards grandes)
- **Taxa de Resposta**: `% de leads com responded = true`
- **Taxa de Reuniões**: `% de leads em status reuniao_realizada/proposta_enviada/em_negociacao/fechado/lead_perdido`
- **Taxa de Fechamento**: `% de leads em status fechado`
- Cada card mostra a porcentagem + a contagem absoluta (ex: `45.2% — 23 de 51 leads`)

**Stats cards do topo (mantidos):** Total de Leads, Reuniões Realizadas, Taxa de Fechamento, Follow-ups do Dia.

---

### 3. Filtros Inteligentes

Acima dos gráficos, adicionar uma barra de filtros que se aplica a TODOS os blocos do Dashboard:

1. **Período** (já existe — `PeriodFilter`): hoje, 7 dias, 30 dias, mês, ano, personalizado.
2. **Origem do Lead** (novo): multi-select com as 5 categorias + "Todas".
3. **Status** (novo): multi-select com os status do CRM + "Todos".
4. **Segmento** (novo): select dinâmico com os segmentos existentes nos leads + "Todos".
5. **Respondeu?** (novo): Todos / Sim / Não.

Botão **"Limpar filtros"** para resetar tudo.

Todos os KPIs, o gráfico de Origens e os cards de Taxas recalculam reativamente conforme os filtros.

---

### 4. Remover a aba Métricas

- `src/components/layout/AppSidebar.tsx`: remover o item `{ title: 'Métricas', url: '/metrics', icon: BarChart3 }`.
- `src/App.tsx`: remover a rota `/metrics` e o import de `Metrics`.
- `src/pages/Metrics.tsx`: excluir o arquivo.
- Qualquer referência remanescente a `/metrics` será verificada e removida.

---

### Detalhes técnicos

**Arquivos alterados:**
- `src/types/crm.ts` — adicionar `LEAD_SOURCES` e tipo `LeadSource`.
- `src/components/leads/LeadForm.tsx` — Input de origem vira Select.
- `src/pages/Dashboard.tsx` — novo gráfico de origens, cards de taxas, filtros adicionais.
- `src/components/layout/AppSidebar.tsx` — remover item Métricas.
- `src/App.tsx` — remover rota e import.
- `src/pages/Metrics.tsx` — deletar arquivo.

**Cálculo das taxas (sobre `filteredLeads`):**
```text
respostas   = leads com responded === true
reunioes    = leads em [reuniao_realizada, proposta_enviada, em_negociacao, fechado, lead_perdido]
fechamentos = leads em [fechado]
taxa = (count / total) * 100
```

**Agrupamento de origens:**
```text
para cada lead:
  se lead_source ∈ LEAD_SOURCES → conta na categoria
  senão → conta em "Outros"
```

Nenhuma migração de banco é necessária — `lead_source` continua como `text`.
