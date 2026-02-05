
# Plano: Importacao de Leads via Excel/CSV na Prospeccao

## Visao Geral

Implementar um sistema completo de importacao de leads externos na aba de Prospeccao, permitindo upload de arquivos Excel (.xlsx, .xls) e CSV, mapeamento de colunas, visualizacao em tabela de triagem com verificacao de duplicatas, e salvamento seletivo de leads.

---

## Arquitetura da Solucao

```text
+-------------------+     +---------------------+     +---------------------+     +------------------+
|  Botao Importar   |     |  Modal de Upload    |     |  Mapeamento de      |     |  Tabela de       |
|  Lista Externa    | --> |  + Leitura Arquivo  | --> |  Colunas            | --> |  Triagem/Preview |
+-------------------+     +---------------------+     +---------------------+     +------------------+
                                                                                          |
                                                                                          v
                                                                                  +------------------+
                                                                                  |  Salvamento no   |
                                                                                  |  Banco de Dados  |
                                                                                  +------------------+
```

---

## Componentes a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/components/prospecting/LeadImportModal.tsx` | Criar | Modal principal com upload e mapeamento |
| `src/components/prospecting/LeadImportPreview.tsx` | Criar | Tabela de triagem com checkboxes e verificacao de duplicatas |
| `src/pages/Prospecting.tsx` | Modificar | Adicionar botao "Importar Lista Externa" |
| `package.json` | Modificar | Adicionar biblioteca `xlsx` para parsing de Excel |

---

## 1. Dependencia Nova: SheetJS (xlsx)

Sera necessario instalar a biblioteca `xlsx` para parsear arquivos Excel:

```bash
npm install xlsx
```

Esta biblioteca suporta .xlsx, .xls e .csv em um unico parser.

---

## 2. Estrutura do Modal de Importacao (LeadImportModal)

### Etapas do Fluxo

1. **Upload do Arquivo**: Aceita .xlsx, .xls, .csv
2. **Leitura e Parsing**: Extrai colunas do arquivo
3. **Mapeamento de Colunas**: Usuario associa colunas do arquivo aos campos do sistema
4. **Confirmacao**: Apos mapear, avanca para a tabela de triagem

### Campos Mapeaveis

| Campo do Sistema | Descricao |
|------------------|-----------|
| `company_name` | Nome da Empresa (obrigatorio) |
| `contact_name` | Nome do Contato |
| `whatsapp` | Numero do WhatsApp |
| `instagram` | @ do Instagram |
| `segment` | Segmento/Nicho |
| `observations` | Observacoes adicionais |

### Interface de Mapeamento

```text
+----------------------------------------------------------+
| Importar Lista de Leads                               [X] |
+----------------------------------------------------------+
|                                                          |
| [1] Selecione o arquivo                                  |
| +------------------------------------------------------+ |
| | [Arraste ou clique para selecionar]                  | |
| | Suporta: .xlsx, .xls, .csv                           | |
| +------------------------------------------------------+ |
|                                                          |
| [2] Mapeie as colunas do seu arquivo:                    |
|                                                          |
| Empresa (obrigatorio):    [Dropdown: colunas do arquivo] |
| Nome do Contato:          [Dropdown: colunas do arquivo] |
| WhatsApp:                 [Dropdown: colunas do arquivo] |
| Instagram:                [Dropdown: colunas do arquivo] |
| Segmento:                 [Dropdown: colunas do arquivo] |
| Observacoes:              [Dropdown: colunas do arquivo] |
|                                                          |
|              [Cancelar]    [Continuar para Triagem]      |
+----------------------------------------------------------+
```

---

## 3. Tabela de Triagem (LeadImportPreview)

### Funcionalidades

1. **Verificacao de Duplicatas**: Compara WhatsApp e Nome da Empresa com a tabela `leads`
2. **Indicador Visual**: Leads duplicados em amarelo/laranja com icone de alerta
3. **Checkbox por Linha**: Selecao individual de leads
4. **Checkbox Geral**: Selecionar/desmarcar todos os nao-duplicados
5. **Botao "Salvar Lead"**: Salvamento individual por linha
6. **Botao "Salvar Selecionados"**: Salvamento em massa

### Regras de Duplicata

| Condicao | Comportamento |
|----------|---------------|
| WhatsApp ja existe no banco | Marcar como duplicata, desabilitar checkbox por padrao |
| Nome da empresa ja existe | Marcar como duplicata, desabilitar checkbox por padrao |
| Ambos novos | Checkbox habilitado e marcado por padrao |

### Interface da Tabela

```text
+------------------------------------------------------------------+
| Triagem de Leads Importados                                   [X] |
+------------------------------------------------------------------+
|                                                                  |
| [x] Selecionar todos novos    Novos: 45 | Duplicados: 12        |
|                                                                  |
| +--------------------------------------------------------------+ |
| | [ ] | Empresa      | WhatsApp       | Segmento    | Acao     | |
| +--------------------------------------------------------------+ |
| | [x] | ABC Comercio | (81) 99999... | Varejo      | [Salvar]  | |
| | [x] | XYZ Tech     | (11) 88888... | Tecnologia  | [Salvar]  | |
| | [!] | Loja 123     | (21) 77777... | Varejo      | [Existe]  | |  <- Linha em cor diferente
| | [x] | Nova Empresa | (85) 66666... | Servicos    | [Salvar]  | |
| +--------------------------------------------------------------+ |
|                                                                  |
| [!] = Lead possivelmente ja cadastrado (WhatsApp ou nome similar)|
|                                                                  |
|              [Cancelar]              [Salvar Selecionados (45)]  |
+------------------------------------------------------------------+
```

---

## 4. Logica de Parsing de Arquivos

### Suporte Multi-formato

```typescript
import * as XLSX from 'xlsx';

const parseFile = async (file: File): Promise<{ headers: string[], rows: string[][] }> => {
  const arrayBuffer = await file.arrayBuffer();
  
  // XLSX suporta .xlsx, .xls e .csv automaticamente
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as string[][];
  
  const headers = data[0] || [];
  const rows = data.slice(1);
  
  return { headers, rows };
};
```

---

## 5. Verificacao de Duplicatas

Reutilizar a logica existente em `serpApi.checkDuplicates`:

```typescript
const checkDuplicates = async (leads: ImportedLead[], userId: string) => {
  const { data: existingLeads } = await supabase
    .from('leads')
    .select('company_name, whatsapp')
    .eq('user_id', userId);

  const existingNames = new Set(
    existingLeads?.map(l => l.company_name.toLowerCase().trim()) || []
  );
  
  const existingPhones = new Set(
    existingLeads?.filter(l => l.whatsapp)
      .map(l => l.whatsapp?.replace(/\D/g, '')) || []
  );

  return leads.map(lead => ({
    ...lead,
    isDuplicate: 
      existingNames.has(lead.company_name.toLowerCase().trim()) ||
      (lead.whatsapp && existingPhones.has(lead.whatsapp.replace(/\D/g, '')))
  }));
};
```

---

## 6. Salvamento no Banco

### Dados Padrao ao Salvar

| Campo | Valor |
|-------|-------|
| `status` | `'lead_coletado'` |
| `lead_source` | `'Importacao de Lista'` |
| `approach_date` | Data atual |
| `user_id` | ID do usuario logado |

### Mutation de Salvamento

```typescript
const saveLeadsMutation = useMutation({
  mutationFn: async (selectedLeads: ImportedLead[]) => {
    const records = selectedLeads.map(lead => ({
      user_id: user.id,
      company_name: lead.company_name,
      contact_name: lead.contact_name || null,
      whatsapp: lead.whatsapp || null,
      instagram: lead.instagram || null,
      segment: lead.segment || null,
      observations: lead.observations || null,
      status: 'lead_coletado',
      lead_source: 'Importacao de Lista',
      approach_date: new Date().toISOString().split('T')[0],
    }));

    const { error } = await supabase.from('leads').insert(records);
    if (error) throw error;
    
    return records.length;
  },
  onSuccess: (count) => {
    toast({
      title: 'Importacao concluida!',
      description: `${count} lead(s) importado(s) com sucesso.`,
    });
  },
});
```

---

## 7. Integracao na Pagina de Prospeccao

### Botao no Header

```typescript
// Em Prospecting.tsx - Adicionar ao lado do titulo
<div className="flex items-center justify-between">
  <div className="flex items-center gap-3">
    <div className="p-2 bg-primary/10 rounded-lg">
      <MapPin className="w-6 h-6 text-primary" />
    </div>
    <div>
      <h1 className="text-2xl font-bold">Prospeccao Inteligente</h1>
      <p className="text-muted-foreground">...</p>
    </div>
  </div>
  
  <Button onClick={() => setShowImportModal(true)}>
    <FileUp className="w-4 h-4 mr-2" />
    Importar Lista Externa
  </Button>
</div>
```

---

## 8. Tratamento de Caracteres Especiais

### Formatacao de Telefone

```typescript
const formatPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,6)}-${cleaned.slice(6)}`;
  }
  return phone;
};
```

### Leitura com Encoding Correto

O SheetJS automaticamente detecta e trata encodings como UTF-8 e ISO-8859-1, garantindo que acentos e caracteres especiais sejam preservados.

---

## Fluxo Completo do Usuario

1. Usuario clica em "Importar Lista Externa"
2. Modal abre para upload do arquivo
3. Usuario seleciona arquivo .xlsx, .xls ou .csv
4. Sistema le e extrai as colunas do arquivo
5. Usuario mapeia cada coluna do arquivo para um campo do sistema
6. Ao clicar "Continuar para Triagem", sistema verifica duplicatas
7. Tabela de triagem exibe leads com indicadores de duplicata
8. Usuario seleciona quais leads deseja importar
9. Usuario clica em "Salvar Selecionados" ou salva individualmente
10. Sistema insere leads no banco com status "Lead Coletado" e origem "Importacao de Lista"
11. Toast de sucesso informa quantos leads foram importados

---

## Arquivos Finais a Criar/Modificar

1. **Criar**: `src/components/prospecting/LeadImportModal.tsx` - Modal com upload e mapeamento
2. **Criar**: `src/components/prospecting/LeadImportPreview.tsx` - Tabela de triagem
3. **Modificar**: `src/pages/Prospecting.tsx` - Adicionar botao e integracao do modal
4. **Modificar**: `package.json` - Adicionar dependencia `xlsx`
