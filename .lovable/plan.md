## Plano: Reclassificar "Outros" como "WhatsApp" no Dashboard

### Contexto
Hoje o gráfico **Origem dos Leads** mostra uma barra grande em "Outros" (~530 leads). Esses leads são registros antigos cujo `lead_source` está vazio ou não corresponde a nenhuma das 5 origens padronizadas (Tráfego, WhatsApp, Instagram, PaP, Cold Call). Como o usuário confirma que essa origem foi de fato **WhatsApp**, vamos consolidá-los nessa categoria.

### Decisão
Tratar todo lead com `lead_source` vazio/nulo OU fora da lista padronizada como **WhatsApp** em todo o Dashboard (gráfico, filtros e métricas de conversão).

### Alterações em `src/pages/Dashboard.tsx`

1. **Cálculo do gráfico "Origem dos Leads"** (~linha 154-165)
   - Remover a contagem separada de `othersCount` e a barra "Outros".
   - Para cada lead: se `lead_source` não estiver entre os 5 padrões, somar em `WhatsApp`.
   - Resultado: gráfico exibe apenas as 5 barras padronizadas.

2. **Filtro de Origem** (~linha 94-99 e 194-203)
   - Remover a opção `"Outros"` do `<Select>`.
   - Quando o filtro for `"WhatsApp"`, incluir também leads sem origem ou com origem não padronizada (mesma regra do gráfico).

3. **Mapa de cores** (~linha 37)
   - Remover entrada `'Outros'` do objeto de cores (não será mais usada).

### Resultado esperado
- A barra "Outros" desaparece do gráfico.
- A barra "WhatsApp" passa a refletir o volume real (~530+ leads anteriormente em "Outros").
- Filtrar por "WhatsApp" também exibirá esses leads na base das taxas de conversão.

### Observação
Esta mudança é apenas de **exibição/agrupamento** — o campo `lead_source` no banco de dados permanece intacto. Novos leads continuarão sendo cadastrados com a origem escolhida no formulário.