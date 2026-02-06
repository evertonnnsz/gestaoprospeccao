

# Plano: Campos Empresariais B2B para Leads

## Visao Geral

Adicionar campos de dados empresariais (CNPJ, Razao Social, Nome Fantasia, Endereco Completo) nas tabelas `leads` e `staging_leads`, e atualizar todos os componentes relacionados: formulario de lead, importacao, sala de espera e card de lead.

---

## 1. Migracao do Banco de Dados

Adicionar 4 novas colunas em ambas as tabelas:

### Tabela `leads`

| Coluna | Tipo | Nullable | Default |
|--------|------|----------|---------|
| cnpj | text | Sim | null |
| razao_social | text | Sim | null |
| nome_fantasia | text | Sim | null |
| endereco_completo | text | Sim | null |

### Tabela `staging_leads`

| Coluna | Tipo | Nullable | Default |
|--------|------|----------|---------|
| cnpj | text | Sim | null |
| razao_social | text | Sim | null |
| nome_fantasia | text | Sim | null |
| endereco_completo | text | Sim | null |

As politicas RLS existentes continuam validas, pois filtram por `user_id`.

---

## 2. Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/types/crm.ts` | Adicionar campos ao tipo `Lead` e `StagingLead` |
| `src/components/leads/LeadForm.tsx` | Adicionar campos CNPJ, Razao Social, Nome Fantasia, Endereco |
| `src/components/leads/LeadCard.tsx` | Exibir Razao Social e CNPJ quando disponivel |
| `src/components/prospecting/LeadImportModal.tsx` | Adicionar mapeamento para novos campos no SYSTEM_FIELDS e ColumnMapping |
| `src/components/prospecting/StagingArea.tsx` | Transferir novos campos ao aprovar lead |
| `src/components/prospecting/StagingLeadEditModal.tsx` | Exibir e editar novos campos no modal de revisao |

---

## 3. Detalhes por Componente

### 3.1 LeadImportModal

Adicionar ao `SYSTEM_FIELDS`:
- CNPJ
- Razao Social
- Nome Fantasia
- Endereco Completo

Adicionar auto-deteccao de colunas para termos como "cnpj", "razao social", "fantasia", "endereco", "logradouro", "cep".

Atualizar `ColumnMapping` e `ImportedLead` com os 4 novos campos.

### 3.2 LeadForm (Formulario de Lead)

Adicionar secao "Dados Empresariais" com campos:
- CNPJ (com icone)
- Razao Social
- Nome Fantasia
- Endereco Completo (textarea para logradouro, numero, bairro, cidade, CEP)

Incluir novos campos no payload de criacao/atualizacao.

### 3.3 StagingLeadEditModal

Adicionar os 4 campos ao formulario de revisao, permitindo edicao e conferencia antes da aprovacao.

### 3.4 StagingArea

Atualizar `handleApproveOne` e `handleBulkApprove` para transferir `cnpj`, `razao_social`, `nome_fantasia` e `endereco_completo` ao inserir na tabela `leads`.

Atualizar `handleEditSave` para persistir os novos campos na `staging_leads`.

### 3.5 LeadCard

Exibir CNPJ e Razao Social abaixo do nome da empresa quando disponivel, de forma compacta.

### 3.6 Tipos (crm.ts)

Adicionar os 4 campos em `Lead` e `StagingLead`:

```text
cnpj: string | null
razao_social: string | null
nome_fantasia: string | null
endereco_completo: string | null
```

---

## 4. Ordem de Implementacao

1. Migracao do banco (adicionar colunas)
2. Atualizar tipos em `crm.ts`
3. Atualizar `LeadImportModal` (mapeamento)
4. Atualizar `StagingLeadEditModal` (revisao)
5. Atualizar `StagingArea` (aprovacao)
6. Atualizar `LeadForm` (formulario)
7. Atualizar `LeadCard` (exibicao)

