

# Plano: Migração de Firecrawl para SerpApi (Google Maps)

## Visão Geral

Substituiremos a integração com Firecrawl pela SerpApi, utilizando o endpoint `google_maps` para buscar empresas locais diretamente do Google Maps. Esta mudança trará resultados mais precisos e volumosos para prospecção.

---

## O Que Será Feito

### 1. Solicitar sua Chave da SerpApi
Antes de implementar, vou pedir para você inserir sua chave da SerpApi de forma segura. A chave será armazenada como um segredo do backend e nunca ficará exposta no código.

### 2. Criar Nova Edge Function para SerpApi
Criarei uma nova função `serpapi-search` que:
- Conecta diretamente ao Google Maps via SerpApi
- Busca empresas locais usando a query: `[Nicho] em [Cidade], [Estado]`
- Implementa paginação automática (20 resultados por página)
- Extrai: nome, telefone, website, endereço, avaliação e categoria

### 3. Implementar Paginação Automática ("Deep Search")
O sistema fará múltiplas chamadas à API automaticamente:
- Se você solicitar 50 resultados, fará 3 chamadas (páginas 0, 20, 40)
- Se solicitar 100 resultados, fará 5 chamadas
- O botão "Carregar Mais" buscará as próximas páginas

### 4. Atualizar o Frontend
- Atualizar o arquivo de API para usar a nova edge function
- Manter toda a lógica de verificação de duplicatas
- Manter a integração com Dashboard, Funil e Métricas

### 5. Melhorar Mensagens de Erro
- "Nenhum resultado encontrado para esta região. Tente ampliar o nicho."
- "Erro na Chave de API. Verifique suas configurações."
- "Limite de requisições atingido. Tente novamente mais tarde."

---

## Dados que Serão Extraídos

| Campo | Origem no Google Maps |
|-------|----------------------|
| Nome da Empresa | `title` |
| Telefone/WhatsApp | `phone` |
| Website | `website` |
| Endereço | `address` |
| Avaliação | `rating` + `reviews` |
| Categoria/Segmento | `type` |

---

## Arquivos que Serão Modificados

1. **Nova Edge Function**: `supabase/functions/serpapi-search/index.ts`
2. **Atualizar Config**: `supabase/config.toml` 
3. **Nova API Client**: `src/lib/api/serpapi.ts`
4. **Atualizar Página**: `src/pages/Prospecting.tsx`
5. **Atualizar Card** (opcional): `src/components/prospecting/ProspectCard.tsx`

---

## Detalhes Técnicos

### Estrutura da Edge Function SerpApi

```text
serpapi-search/index.ts
├── Validação de parâmetros (niche, state, city, limit)
├── Verificação da SERPAPI_KEY
├── Construção da query: "[niche] em [city], [state], Brasil"
├── Loop de paginação (start: 0, 20, 40...)
├── Extração de dados de local_results
├── Deduplicação por nome/telefone
└── Retorno formatado (ProspectResult[])
```

### Chamada à API SerpApi

```text
GET https://serpapi.com/search.json
  ?engine=google_maps
  &q=dentistas+em+Recife,+Pernambuco,+Brasil
  &hl=pt-br
  &start=0
  &api_key=YOUR_KEY
```

### Resposta Esperada (local_results)

```text
{
  "local_results": [
    {
      "title": "Clínica Dental Sorrir",
      "phone": "(81) 99999-9999",
      "website": "https://clinicasorrir.com.br",
      "address": "Rua das Flores, 123 - Boa Viagem",
      "rating": 4.8,
      "reviews": 156,
      "type": "Dentista"
    },
    ...
  ],
  "serpapi_pagination": {
    "next": "https://serpapi.com/search?start=20&..."
  }
}
```

### Fluxo de Paginação

```text
Usuário solicita 50 resultados
         │
         ▼
┌─────────────────────┐
│  Chamada 1: start=0 │ → 20 resultados
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ Chamada 2: start=20 │ → 20 resultados
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ Chamada 3: start=40 │ → 10 resultados
└─────────────────────┘
         │
         ▼
   Total: 50 resultados
```

---

## Próximos Passos

Após sua aprovação:

1. Solicitarei sua chave da SerpApi
2. Criarei a nova edge function
3. Atualizarei o frontend
4. Testaremos a busca de "Dentista" em "Recife"

---

## Onde Obter sua Chave SerpApi

1. Acesse [serpapi.com](https://serpapi.com/)
2. Crie uma conta gratuita (100 buscas/mês grátis)
3. Vá em **Dashboard → API Key**
4. Copie sua chave

