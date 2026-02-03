

# Plano: Otimização da Prospecção Inteligente

## Resumo

Vamos aprimorar o módulo de prospecção para retornar mais resultados através de buscas otimizadas, interface melhorada com campos específicos para Estado (dropdown) e Cidade, além de paginação para carregar mais resultados.

---

## Análise das Limitações Atuais

A API do Firecrawl tem um limite de resultados por busca (máximo ~100 por requisição). A busca atual está limitada a 15 resultados. Para maximizar os resultados, precisamos:

1. Aumentar o limite de resultados por busca
2. Usar queries mais otimizadas focadas em Google Meu Negócio
3. Implementar múltiplas buscas com variações para cobrir mais resultados
4. Adicionar funcionalidade de "Carregar Mais"

---

## Etapas de Implementação

### 1. Atualizar Interface de Busca

**Arquivo**: `src/components/prospecting/ProspectSearchForm.tsx`

Novos campos:
- **Nicho/Palavra-chave**: Campo de texto (mantido)
- **Estado**: Dropdown (Select) com todos os 27 estados brasileiros
- **Cidade**: Campo de texto para o nome da cidade
- **Quantidade de Resultados**: Slider ou select para definir limite (25, 50, 100)

Layout atualizado para 4 colunas no desktop:
```text
| Nicho/Palavra-chave | Estado (dropdown) | Cidade | Qtd. Resultados |
|                        [Buscar Leads]                               |
```

### 2. Otimizar Edge Function

**Arquivo**: `supabase/functions/firecrawl-search/index.ts`

Melhorias:
- Aumentar limite padrão de 15 para 50 resultados
- Otimizar query para focar em Google Meu Negócio: 
  - `"{nicho}" "{cidade}" "{estado}" site:google.com/maps OR "Google Meu Negócio"`
- Melhorar extração de dados com regex mais abrangente
- Adicionar suporte para múltiplas queries em sequência
- Retornar informações de paginação (`hasMore`, `nextOffset`)

### 3. Atualizar Cliente API

**Arquivo**: `src/lib/api/firecrawl.ts`

Novas funcionalidades:
- Interface `SearchParams` com campos separados (niche, state, city, limit)
- Método para carregar mais resultados com offset

### 4. Atualizar Página de Prospecção

**Arquivo**: `src/pages/Prospecting.tsx`

Melhorias:
- Contador de "Total de Leads Encontrados" em destaque
- Botão "Carregar Mais" quando houver mais resultados
- Gerenciamento de estado para acumular resultados de múltiplas buscas
- Loading skeleton durante carregamento

### 5. Criar Lista de Estados Brasileiros

**Arquivo**: `src/lib/constants/brazilianStates.ts`

Lista completa dos 27 estados com siglas e nomes completos para o dropdown.

---

## Detalhes Técnicos

### Query Otimizada para Google Meu Negócio

```text
Formato: "{nicho}" + "{cidade}" + "{sigla_estado}" + "telefone" + "contato"
Exemplo: "dentistas" "Recife" "PE" telefone contato whatsapp
```

### Estrutura de Resposta com Paginação

```typescript
interface SearchResponse {
  success: boolean;
  data: ProspectResult[];
  total: number;
  hasMore: boolean;
  searchId: string; // Para rastrear buscas subsequentes
}
```

### Estados Brasileiros (Dropdown)

```typescript
const BRAZILIAN_STATES = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  // ... todos os 27 estados
  { value: 'TO', label: 'Tocantins' },
];
```

---

## Fluxo de "Carregar Mais"

1. Usuário faz busca inicial
2. Sistema retorna primeiros 50 resultados
3. Se `hasMore: true`, exibe botão "Carregar Mais"
4. Ao clicar, executa nova busca com query variada
5. Novos resultados são adicionados aos existentes
6. Verifica duplicatas antes de adicionar

---

## Melhoria na Extração de Dados

Priorizar campos do Google Meu Negócio:
- Nome da Empresa (título do listing)
- Telefone principal (formatação brasileira)
- Website oficial
- Endereço completo
- Categoria/Segmento
- Avaliação média (quando disponível)

---

## Arquivos que Serão Modificados

| Arquivo | Ação |
|---------|------|
| `src/components/prospecting/ProspectSearchForm.tsx` | Modificar - Adicionar dropdown de estados e novos campos |
| `src/lib/api/firecrawl.ts` | Modificar - Atualizar interface e adicionar paginação |
| `src/pages/Prospecting.tsx` | Modificar - Adicionar contador e botão "Carregar Mais" |
| `supabase/functions/firecrawl-search/index.ts` | Modificar - Otimizar queries e aumentar limite |
| `src/lib/constants/brazilianStates.ts` | Criar - Lista de estados brasileiros |

---

## Considerações Importantes

1. **Limitações da API**: O Firecrawl Search retorna resultados de busca web, não dados diretos do Google Maps API. Os resultados dependem do que está indexado na web.

2. **Qualidade vs Quantidade**: Aumentar o limite pode trazer mais resultados, mas alguns podem ter menos dados extraídos (sem telefone, sem website).

3. **Custo de API**: Cada busca consome créditos do Firecrawl. Limites maiores consomem mais créditos por busca.

4. **Integridade Mantida**: Todas as funcionalidades existentes (verificação de duplicatas, integração com Dashboard/Funil/Métricas) continuarão funcionando normalmente.

---

## Resultado Esperado

Após as melhorias:
- Interface mais intuitiva com campos específicos
- Buscas retornando 50+ resultados por vez
- Possibilidade de carregar mais resultados progressivamente
- Melhor precisão nas buscas por região específica
- Contador visual do total de leads encontrados

