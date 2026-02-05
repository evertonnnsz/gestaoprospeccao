

# Correcao: Pagina Branca ao Importar Lista

## Problema Identificado

O componente `LeadImportModal.tsx` possui um `SelectItem` com `value=""` (valor vazio) na linha 349:

```typescript
<SelectItem value="">Nao mapear</SelectItem>
```

O Radix UI Select nao aceita valores vazios em `SelectItem`, o que causa um erro de JavaScript que quebra a renderizacao de toda a aplicacao.

---

## Solucao

Substituir o valor vazio por um valor valido (ex: `"__none__"`) e ajustar a logica para tratar esse valor como "nao mapeado".

---

## Alteracoes no Arquivo

**Arquivo:** `src/components/prospecting/LeadImportModal.tsx`

### 1. Definir constante para valor "nao mapear"

Adicionar no inicio do arquivo:

```typescript
const NO_MAPPING_VALUE = '__none__';
```

### 2. Corrigir o SelectItem

Alterar a linha 349 de:

```typescript
<SelectItem value="">Nao mapear</SelectItem>
```

Para:

```typescript
<SelectItem value={NO_MAPPING_VALUE}>Nao mapear</SelectItem>
```

### 3. Ajustar a funcao handleMappingChange

Modificar para converter o valor especial de volta para string vazia:

```typescript
const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
  setMapping(prev => ({ 
    ...prev, 
    [field]: value === NO_MAPPING_VALUE ? '' : value 
  }));
};
```

### 4. Ajustar o valor exibido no Select

Na propriedade `value` do componente `Select`, converter string vazia para o valor especial:

```typescript
<Select
  value={mapping[field.key as keyof ColumnMapping] || NO_MAPPING_VALUE}
  onValueChange={(value) => handleMappingChange(field.key as keyof ColumnMapping, value)}
>
```

---

## Resumo das Mudancas

| Local | Antes | Depois |
|-------|-------|--------|
| SelectItem value | `""` | `"__none__"` |
| Select value | `mapping[field.key]` | `mapping[field.key] \|\| '__none__'` |
| handleMappingChange | Apenas atribui o valor | Converte `__none__` para `''` |

---

## Resultado Esperado

Apos a correcao:
- O modal de importacao abrira normalmente
- O usuario podera fazer upload do arquivo
- O mapeamento de colunas funcionara sem erros
- A opcao "Nao mapear" funcionara corretamente

