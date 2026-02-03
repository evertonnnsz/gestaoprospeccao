
# Plano: Módulo "Prospecção Inteligente"

## Resumo

Vamos criar um novo módulo completo de prospecção de leads que permite buscar empresas na web, verificar duplicatas e salvar leads diretamente no sistema existente. Os leads capturados serão integrados automaticamente com Dashboard, Funil, Métricas e lista de Leads.

---

## Arquitetura da Solução

```text
+-------------------+      +--------------------+      +-------------+
|  Página React     | ---> |  Edge Function     | ---> |  Firecrawl  |
| (Prospecção)      |      | (firecrawl-search) |      |   API       |
+-------------------+      +--------------------+      +-------------+
         |
         v
+-------------------+      +--------------------+
|  Verificação de   | ---> |  Tabela leads      |
|  Duplicatas       |      |  (Supabase)        |
+-------------------+      +--------------------+
         |
         v
+-------------------+
|  Modal LeadForm   |
|  (pré-preenchido) |
+-------------------+
```

---

## Etapas de Implementação

### 1. Configurar Conector Firecrawl

- Conectar o **Firecrawl** como serviço de busca web
- O Firecrawl permite fazer buscas na web e extrair dados estruturados
- A API Key será configurada automaticamente via conector

### 2. Criar Edge Function de Busca

**Arquivo**: `supabase/functions/firecrawl-search/index.ts`

Funcionalidades:
- Receber parâmetros de busca (nicho + cidade/estado)
- Montar query otimizada para encontrar empresas
- Chamar API do Firecrawl com busca estruturada
- Extrair e retornar dados formatados

### 3. Criar Página "Prospecção Inteligente"

**Arquivo**: `src/pages/Prospecting.tsx`

Componentes da interface:
- Formulário de busca com campos "Nicho/Palavra-chave" e "Cidade/Estado"
- Botão "Buscar Leads"
- Grid de cards com resultados
- Indicadores visuais para leads já cadastrados
- Botão "Salvar Lead" em cada card

### 4. Criar Componentes de Suporte

**Arquivos novos**:
- `src/components/prospecting/ProspectSearchForm.tsx` - Formulário de busca
- `src/components/prospecting/ProspectCard.tsx` - Card de resultado
- `src/lib/api/firecrawl.ts` - Cliente API para Edge Function

### 5. Adicionar ao Menu Lateral

**Arquivo**: `src/components/layout/AppSidebar.tsx`

- Adicionar item "Prospecção" com ícone de busca
- Posicionar após "Leads" na navegação

### 6. Configurar Roteamento

**Arquivo**: `src/App.tsx`

- Adicionar rota `/prospecting` para a nova página

---

## Fluxo de Funcionamento

1. Usuário acessa "Prospecção Inteligente"
2. Preenche nicho (ex: "restaurantes") e localização (ex: "São Paulo, SP")
3. Clica em "Buscar Leads"
4. Sistema busca via Firecrawl e retorna lista de empresas
5. Para cada resultado, sistema verifica se já existe na base (por nome ou telefone)
6. Cards exibem badge "Já Cadastrado" quando aplicável
7. Ao clicar "Salvar", abre o modal de LeadForm existente com dados pré-preenchidos:
   - **Status**: "Lead Coletado"
   - **Origem do Lead**: "Prospecção Inteligente"
   - **Data do Cadastro**: Data atual
8. Ao confirmar, lead é inserido normalmente na tabela `leads`
9. Lead aparece automaticamente em Dashboard, Funil e Métricas

---

## Integração com Sistema Existente

A integração será automática porque:

1. **Mesmo fluxo de salvamento**: Usamos o componente `LeadForm` existente
2. **Mesma tabela**: Dados vão para tabela `leads` do Supabase
3. **RLS mantida**: Políticas de segurança continuam funcionando
4. **Métricas atualizadas**: Dashboard, Funil e Métricas buscam da mesma tabela

Os leads salvos aparecerão em:
- Dashboard (contador "Total de Leads")
- Funil (etapa "Lead Coletado")
- Métricas (gráficos de origem e segmento)
- Lista de Leads (com todos os filtros)

---

## Detalhes Técnicos

### Edge Function - Busca

```text
Endpoint: POST /functions/v1/firecrawl-search
Body: { query: "restaurantes São Paulo SP", options: { limit: 20 } }
Response: { success: true, data: [...] }
```

### Verificação de Duplicatas

Antes de exibir resultados, consultamos a tabela `leads`:
- Busca por nome da empresa (case insensitive)
- Busca por telefone/WhatsApp (normalizado)
- Marca cards encontrados como "Já Cadastrado"

### Dados Extraídos da Busca

Para cada empresa encontrada:
- Nome da Empresa
- Telefone/WhatsApp (quando disponível)
- Website (quando disponível)
- Instagram (quando disponível)
- Descrição/Segmento

---

## Orientações para Ativação

Após a implementação:

1. **Conectar Firecrawl**: Você será solicitado a conectar sua conta Firecrawl
2. **API Key**: A chave será configurada automaticamente no sistema
3. **Testar**: Faça uma busca de teste para validar a integração

---

## Arquivos que Serão Criados/Modificados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/firecrawl-search/index.ts` | Criar |
| `supabase/config.toml` | Modificar |
| `src/pages/Prospecting.tsx` | Criar |
| `src/components/prospecting/ProspectSearchForm.tsx` | Criar |
| `src/components/prospecting/ProspectCard.tsx` | Criar |
| `src/lib/api/firecrawl.ts` | Criar |
| `src/components/layout/AppSidebar.tsx` | Modificar |
| `src/App.tsx` | Modificar |

---

## Resultado Final

Uma página completa de prospecção onde você pode:
- Buscar empresas por nicho e localização
- Visualizar resultados em cards organizados
- Identificar leads já cadastrados
- Salvar novos leads com um clique
- Ter integração total com o restante do CRM
