
# Plano: Correção do Erro de UUID ao Salvar Lead da Prospecção

## Problema Identificado

O erro `invalid input syntax for type uuid: "undefined"` ocorre porque o formulário de leads (`LeadForm.tsx`) está tentando fazer um **UPDATE** ao invés de um **INSERT**.

### Causa Raiz

No `LeadForm.tsx`, a lógica na linha 108 é:
```typescript
if (lead) {
  // Tenta fazer UPDATE usando lead.id
}
```

O problema é que ao salvar um prospect da página de Prospecção, você passa um objeto com dados pre-preenchidos:
```typescript
const leadData: Partial<Lead> = {
  company_name: prospect.company_name,
  whatsapp: prospect.whatsapp || '',
  // ... outros campos
  // NÃO TEM 'id' aqui!
};
setSelectedProspect(leadData);
```

Como o objeto `leadData` existe (não é `null`), a condição `if (lead)` retorna `true`, mas `lead.id` é `undefined`, causando o erro no banco de dados.

---

## Solução

Modificar a lógica do `LeadForm.tsx` para verificar se `lead.id` existe, não apenas se `lead` existe:

**Antes:**
```typescript
if (lead) {
  // UPDATE
} else {
  // INSERT
}
```

**Depois:**
```typescript
if (lead?.id) {
  // UPDATE - só quando existe um ID válido
} else {
  // INSERT - para novos leads (incluindo da prospecção)
}
```

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/leads/LeadForm.tsx` | Alterar condição de `if (lead)` para `if (lead?.id)` |

---

## Detalhes da Implementação

### Alteração no LeadForm.tsx

Modificar as seguintes linhas:

1. **Linha 108** - Condição principal do submit:
   - De: `if (lead)`
   - Para: `if (lead?.id)`

2. **Linha 150** - Título do modal:
   - De: `{lead ? 'Editar Lead' : 'Novo Lead'}`
   - Para: `{lead?.id ? 'Editar Lead' : 'Novo Lead'}`

3. **Linha 364** - Texto do botão:
   - De: `{lead ? 'Atualizar' : 'Criar Lead'}`
   - Para: `{lead?.id ? 'Atualizar' : 'Criar Lead'}`

---

## Impacto

- Corrige o salvamento de leads vindos da prospecção
- Mantém funcionando a edição de leads existentes (que possuem `id`)
- Não afeta outras partes do sistema
