
# Plano: Ajuste do Parser de Importacao para Modelo Meta Ads

## Problema Identificado

O arquivo CSV do Meta Ads tem uma estrutura especifica que o parser atual nao reconhece:

```text
Colunas do arquivo:
+------------------------+---------------------+-------------------+
| Nome da campanha       | Resultados          | Valor usado (BRL) |
| Impressoes             | Alcance             | Inicio dos        |
|                        |                     | relatorios        |
| Termino dos relatorios | Tipo de resultado   | ...               |
+------------------------+---------------------+-------------------+
```

### Problemas Tecnicos

1. **Parser CSV incorreto**: O atual usa `split(/[,;]/)` que quebra campos com aspas contendo virgulas
2. **Nomes de colunas nao mapeados**: Os headers do Meta Ads nao estao nos arrays de busca
3. **Formato de valores**: "Valor usado (BRL)" usa ponto como decimal (335.33), diferente do esperado

---

## Mapeamento de Colunas (Meta Ads)

| Coluna no CSV | Campo no Banco | Observacao |
|---------------|----------------|------------|
| Nome da campanha | campaign_name | Texto livre |
| Resultados | conversations_started | Quando "Tipo de resultado" = "Conversas por mensagem iniciadas" |
| Valor usado (BRL) | investment | Decimal com ponto (335.33) |
| Impressoes | impressions | Inteiro |
| Alcance | notes | Salvar como observacao |
| Inicio dos relatorios | period_start | Formato YYYY-MM-DD |
| Termino dos relatorios | period_end | Formato YYYY-MM-DD |

---

## Solucao Tecnica

### 1. Corrigir Parser CSV

Implementar parser que respeita campos entre aspas:

```text
Entrada: "Campo com, virgula",123,456
Antes:  ["Campo com", " virgula", "123", "456"]  (ERRADO)
Depois: ["Campo com, virgula", "123", "456"]     (CORRETO)
```

### 2. Atualizar Arrays de Mapeamento

**Antes:**
```typescript
campaign_name: getCol(['campanha', 'campaign', 'nome'])
investment: getCol(['investimento', 'gasto', 'spent', 'custo', 'valor'])
```

**Depois:**
```typescript
campaign_name: getCol(['nome da campanha', 'campanha', 'campaign', 'nome'])
investment: getCol(['valor usado', 'valor usado (brl)', 'investimento', 'gasto', 'spent'])
period_start: getCol(['inicio dos relatorios', 'inicio', 'start', 'data_inicio'])
period_end: getCol(['termino dos relatorios', 'fim', 'end', 'data_fim'])
impressions: getCol(['impressoes', 'impressions'])
conversations_started: getCol(['resultados', 'conversas', 'conversations'])
```

### 3. Adicionar Campo Alcance nas Notas

O campo "Alcance" sera salvo no campo `notes` junto com outras informacoes:

```typescript
notes: `Alcance: ${getCol(['alcance', 'reach'])}`
```

### 4. Ajustar Tratamento de Decimais

O valor vem como `335.33` (ponto decimal), entao a funcao `parseNum` precisa preservar o ponto:

```typescript
const parseNum = (val: string) => {
  // Remove apenas R$ e espacos, mantendo o ponto como decimal
  const cleaned = val.replace(/[R$\s]/g, '');
  // Trata ambos os formatos: 335.33 e 335,33
  return parseFloat(cleaned.replace(',', '.')) || 0;
};
```

---

## Interface de Preview Melhorada

A tabela de pre-visualizacao mostrara os dados "traduzidos":

| Campo | Exibicao Atual | Nova Exibicao |
|-------|----------------|---------------|
| Investimento | 335.33 | R$ 335,33 |
| Periodo | 2026-01-05 a 2026-02-03 | 05/01/2026 a 03/02/2026 |
| Impressoes | 52166 | 52.166 |

---

## Arquivo a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `src/components/customer-success/CampaignImport.tsx` | Parser CSV, mapeamento de colunas, tratamento de decimais, preview melhorada |

---

## Detalhes da Implementacao

### Nova Funcao parseCSVLine

```typescript
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};
```

### Interface ParsedRow Atualizada

Adicionar campo `reach` para armazenar alcance:

```typescript
interface ParsedRow {
  campaign_name?: string;
  period_start: string;
  period_end: string;
  investment: number;
  impressions: number;
  clicks: number;
  conversations_started: number;
  leads_generated: number;
  reach?: number;  // Novo campo
}
```

---

## Resultado Esperado

Ao importar o arquivo de exemplo, o sistema deve mostrar:

```text
+-------------------------+------------------------+--------------+
| Campanha                | Periodo                | Investimento |
+-------------------------+------------------------+--------------+
| [TRAFEGO] [WHATS]       | 05/01/2026 a           | R$ 335,33    |
| [NOV25]                 | 03/02/2026             |              |
+-------------------------+------------------------+--------------+
| Impressoes: 52.166      | Conversas: 543         | Alcance:     |
|                         |                        | 26.668       |
+-------------------------+------------------------+--------------+
```
