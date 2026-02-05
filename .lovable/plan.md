
# Plano: Sala de Espera para Leads Importados

## Visao Geral

Implementar uma area de conferencia persistente (Staging Area) na aba de Prospeccao, onde leads importados via Excel/CSV ficam armazenados no banco de dados ate serem revisados e aprovados manualmente antes de entrarem na tabela oficial de leads.

---

## Arquitetura da Solucao

```text
+------------------+     +--------------------+     +--------------------+     +------------------+
|  Upload Excel/   | --> |  Tabela temporaria | --> |  Sala de Espera    | --> |  Tabela leads    |
|  CSV             |     |  staging_leads     |     |  (UI Persistente)  |     |  (Oficial)       |
+------------------+     +--------------------+     +--------------------+     +------------------+
                                                           |
                                                           v
                                                    +--------------------+
                                                    |  Modal de Edicao   |
                                                    |  e Validacao       |
                                                    +--------------------+
```

---

## 1. Nova Tabela: staging_leads

Criar uma tabela no banco de dados para persistir os leads importados que ainda nao foram aprovados.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | Identificador unico |
| user_id | uuid | Usuario dono do registro |
| company_name | text | Nome da empresa (obrigatorio) |
| contact_name | text | Nome do contato |
| whatsapp | text | Numero do WhatsApp |
| instagram | text | @ do Instagram |
| segment | text | Segmento/Nicho |
| observations | text | Observacoes |
| is_reviewed | boolean | Se o usuario ja revisou |
| has_validation_errors | boolean | Se possui erros de validacao |
| is_duplicate | boolean | Se e duplicata da tabela leads |
| duplicate_lead_id | uuid | ID do lead duplicado (se houver) |
| created_at | timestamp | Data de importacao |
| updated_at | timestamp | Ultima atualizacao |

### Politicas RLS
- Usuarios podem ver, criar, editar e excluir apenas seus proprios registros

---

## 2. Fluxo de Importacao Modificado

### Antes (Atual)
1. Upload do arquivo
2. Mapeamento de colunas
3. Preview temporario em memoria
4. Salvamento direto na tabela `leads`

### Depois (Novo)
1. Upload do arquivo
2. Mapeamento de colunas
3. Salvamento na tabela `staging_leads`
4. Exibicao na Sala de Espera
5. Revisao/Edicao individual
6. Aprovacao para tabela `leads`

---

## 3. Componentes a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `staging_leads` | Criar (DB) | Nova tabela no banco de dados |
| `src/components/prospecting/StagingArea.tsx` | Criar | Componente principal da Sala de Espera |
| `src/components/prospecting/StagingLeadEditModal.tsx` | Criar | Modal de edicao/revisao individual |
| `src/components/prospecting/LeadImportModal.tsx` | Modificar | Salvar na staging_leads ao inves de passar para preview |
| `src/components/prospecting/LeadImportPreview.tsx` | Remover | Substituido pela StagingArea |
| `src/pages/Prospecting.tsx` | Modificar | Integrar StagingArea como secao persistente |
| `src/types/crm.ts` | Modificar | Adicionar tipo StagingLead |

---

## 4. Interface da Sala de Espera (StagingArea)

### Layout na Pagina de Prospeccao

```text
+------------------------------------------------------------------+
| Prospeccao Inteligente                    [Importar Lista Externa]|
+------------------------------------------------------------------+
|                                                                   |
| [Card: Sala de Espera - X leads aguardando revisao]               |
|                                                                   |
| +---------------------------------------------------------------+ |
| | [x] Selecionar todos    | Aguardando: 15 | Revisados: 8       | |
| +---------------------------------------------------------------+ |
| | [ ] | Empresa    | WhatsApp       | Status       | Acoes      | |
| +---------------------------------------------------------------+ |
| | [x] | ABC Ltda   | (81) 9999-... | [!] Revisar  | [Editar]   | |
| | [x] | XYZ Tech   | (11) 8888-... | [v] OK       | [Aprovar]  | |
| | [ ] | Loja 123   | 123           | [!] Telefone | [Editar]   | | <- Erro destacado
| | [ ] | Duplicada  | (21) 7777-... | [Duplicado]  | [Ver Lead] | | <- Duplicata
| +---------------------------------------------------------------+ |
|                                                                   |
|        [Excluir Selecionados]    [Enviar Selecionados para Leads] |
+------------------------------------------------------------------+
```

---

## 5. Validacao Automatica de Campos

### Regras de Validacao

| Campo | Validacao | Indicador Visual |
|-------|-----------|------------------|
| WhatsApp | Minimo 10 digitos | Texto vermelho + icone de alerta |
| Empresa | Nao pode estar vazio | Linha em vermelho |
| Instagram | Comecar com @ (opcional) | Aviso leve |

### Logica de Validacao

```typescript
const validateStagingLead = (lead: StagingLead): ValidationResult => {
  const errors: string[] = [];
  
  // Validar telefone
  if (lead.whatsapp) {
    const digits = lead.whatsapp.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 11) {
      errors.push('Telefone com formato invalido');
    }
  }
  
  // Validar empresa
  if (!lead.company_name?.trim()) {
    errors.push('Nome da empresa obrigatorio');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};
```

---

## 6. Modal de Edicao (StagingLeadEditModal)

### Funcionalidades

1. Exibir todos os campos do lead
2. Destacar campos com erro em vermelho
3. Permitir edicao inline
4. Mostrar alerta se for duplicata
5. Botao "Salvar Alteracoes" para atualizar staging_leads
6. Botao "Aprovar e Enviar" para mover para leads

### Interface

```text
+----------------------------------------------------------+
| Revisar Lead: ABC Comercio                            [X] |
+----------------------------------------------------------+
|                                                          |
| [!] Atencao: Este lead pode ser uma duplicata            |
| [Ver Lead Existente]                                     |
|                                                          |
| Empresa *:         [ABC Comercio                    ]    |
| Nome do Contato:   [Joao Silva                      ]    |
| WhatsApp:          [123              ] <- VERMELHO       |
|                    ^ Telefone invalido (poucos digitos)  |
| Instagram:         [@abccomercio                    ]    |
| Segmento:          [Varejo                          ]    |
| Observacoes:       [                                ]    |
|                                                          |
|  [Cancelar]   [Salvar Alteracoes]   [Aprovar e Enviar]   |
+----------------------------------------------------------+
```

---

## 7. Verificacao de Duplicatas Persistente

### Na Importacao
- Ao salvar na staging_leads, verificar duplicatas na tabela leads
- Marcar `is_duplicate = true` e `duplicate_lead_id = uuid` se encontrar

### Na Exibicao
- Leads duplicados aparecem com badge "Duplicado"
- Botao "Ver Lead Existente" ao inves de "Aprovar"
- Opcao futura: "Mesclar Dados" para combinar informacoes

---

## 8. Aprovacao em Massa

### Fluxo

1. Usuario seleciona varios leads via checkbox
2. Clica em "Enviar Selecionados para Leads"
3. Sistema exibe AlertDialog de confirmacao:
   - "Voce conferiu todos os dados dos X leads selecionados?"
   - "Leads com erros de validacao serao ignorados"
4. Ao confirmar:
   - Move leads validos da staging_leads para leads
   - Remove da staging_leads
   - Atualiza contadores

### Regras
- Leads com `is_duplicate = true` nao podem ser aprovados em massa
- Leads com erros de validacao mostram aviso antes de aprovar

---

## 9. Persistencia entre Sessoes

### Garantias

1. Todos os leads importados sao salvos na tabela `staging_leads`
2. A Sala de Espera carrega dados do banco ao abrir a pagina
3. Realtime (opcional): atualizar automaticamente se houver mudancas

### Query de Carregamento

```typescript
const { data: stagingLeads } = await supabase
  .from('staging_leads')
  .select('*')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false });
```

---

## 10. Migracao de Dados

### Campos ao Aprovar Lead

| Campo Staging | Campo Leads | Valor |
|---------------|-------------|-------|
| company_name | company_name | Valor do staging |
| contact_name | contact_name | Valor do staging |
| whatsapp | whatsapp | Valor do staging |
| instagram | instagram | Valor do staging |
| segment | segment | Valor do staging |
| observations | observations | Valor do staging |
| - | status | 'lead_coletado' |
| - | lead_source | 'Importacao de Lista' |
| - | approach_date | Data atual |
| - | user_id | ID do usuario |

---

## Arquivos a Criar/Modificar

### Banco de Dados
1. **Migracao**: Criar tabela `staging_leads` com RLS

### Novos Componentes
2. **src/components/prospecting/StagingArea.tsx** - Tabela persistente de conferencia
3. **src/components/prospecting/StagingLeadEditModal.tsx** - Modal de edicao/validacao

### Modificacoes
4. **src/types/crm.ts** - Adicionar tipo StagingLead
5. **src/components/prospecting/LeadImportModal.tsx** - Salvar em staging_leads
6. **src/pages/Prospecting.tsx** - Integrar StagingArea, remover preview modal
7. **Remover**: src/components/prospecting/LeadImportPreview.tsx (substituido)

---

## Fluxo Completo do Usuario

1. Usuario clica em "Importar Lista Externa"
2. Faz upload do arquivo Excel/CSV
3. Mapeia as colunas
4. Sistema salva na tabela `staging_leads` e fecha o modal
5. Leads aparecem na "Sala de Espera" na pagina de Prospeccao
6. Usuario pode fechar a pagina e voltar depois (dados persistem)
7. Usuario clica em "Editar" para revisar um lead
8. Modal abre com campos editaveis e validacoes visuais
9. Usuario corrige erros e clica em "Aprovar e Enviar"
10. Lead e movido para a tabela `leads` e removido da staging
11. Para aprovacao em massa: selecionar varios, clicar "Enviar Selecionados"
12. AlertDialog pergunta "Voce conferiu todos os dados?"
13. Ao confirmar, leads validos sao movidos para a tabela oficial

---

## Beneficios

- **Qualidade de Dados**: 100% dos leads sao revisados antes de entrar no CRM
- **Persistencia**: Trabalho de conferencia nao e perdido ao fechar a pagina
- **Validacao Automatica**: Sistema destaca erros para correcao
- **Prevencao de Duplicatas**: Alerta claro quando lead ja existe
- **Flexibilidade**: Aprovar individualmente ou em massa
