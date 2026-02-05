
# Plano: Envio de Resumo Dinamico via WhatsApp

## Visao Geral

Implementar um sistema de compartilhamento via WhatsApp que constroi mensagens personalizadas baseadas nas metricas que possuem dados para cada cliente, incluindo modal de pre-visualizacao e edicao antes do envio.

---

## Estrutura da Solucao

```text
+-------------------+     +---------------------+     +------------------+
|  Dashboard de     |     |  Modal de Preview   |     |  WhatsApp URL    |
|  Performance      | --> |  com Editor         | --> |  (wa.me/...)     |
|  (Botao Enviar)   |     |  de Mensagem        |     |                  |
+-------------------+     +---------------------+     +------------------+
```

---

## Componentes a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/components/customer-success/WhatsAppSummaryModal.tsx` | Criar | Modal com preview e edicao da mensagem |
| `src/components/customer-success/PerformanceDashboard.tsx` | Modificar | Adicionar botao de envio WhatsApp |
| `src/pages/CustomerSuccess.tsx` | Modificar | Buscar dados do lead (whatsapp) junto com o cliente |

---

## 1. Atualizar Query de Clientes

A query atual nao busca o numero de WhatsApp. Atualizar para incluir:

```typescript
// Em CustomerSuccess.tsx
.select(`
  *,
  lead:leads(company_name, contact_name, whatsapp)
`)
```

---

## 2. Logica de Construcao Dinamica

A mensagem sera construida com base nos dados disponiveis:

```text
Dados de Entrada (Campaign Metrics):
+---------------------+-------------+
| Metrica             | Condicao    |
+---------------------+-------------+
| investment          | > 0         |
| impressions         | > 0         |
| clicks              | > 0         |
| conversations       | > 0         |
| leads               | > 0         |
| ctr                 | calculado   |
| cpc                 | calculado   |
| cpl                 | calculado   |
| custom_metrics      | array > 0   |
+---------------------+-------------+
```

**Template da Mensagem:**

```text
Ola, [Nome do Cliente]! 👋

Segue o resumo de performance personalizado das suas campanhas ([Data Inicio] a [Data Fim]):

[Se investment > 0]     💰 Investimento: R$ [Valor]
[Se impressions > 0]    👁️ Impressoes: [Valor]
[Se clicks > 0]         🖱️ Cliques: [Valor]
[Se conversations > 0]  💬 Conversas Iniciadas: [Valor]
[Se leads > 0]          📈 Leads Gerados: [Valor]
[Se ctr > 0]            📊 CTR: [Valor]%
[Se cpc > 0]            🎯 CPC: R$ [Valor]
[Se cpl > 0]            💎 CPL: R$ [Valor]
[Para cada custom_metric] [emoji] [Nome]: [Valor]

Estes sao os indicadores que estamos acompanhando de perto para o seu negocio. Qualquer duvida, estou aqui! 👊
```

---

## 3. Estrutura do Modal (WhatsAppSummaryModal)

### Props do Componente

```typescript
interface WhatsAppSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  clientPhone: string;
  metrics: {
    investment: number;
    impressions: number;
    clicks: number;
    conversations: number;
    leads: number;
    ctr: number;
    cpc: number;
    cpl: number;
    customMetrics: Array<{ name: string; value: number }>;
  };
  periodStart: string;
  periodEnd: string;
}
```

### Funcionalidades

1. **Preview da mensagem** - Area de texto mostrando o texto gerado
2. **Campo editavel** - Usuario pode ajustar a mensagem antes de enviar
3. **Botao "Confirmar e Abrir WhatsApp"** - Abre a URL wa.me com a mensagem codificada
4. **Indicador de numero** - Mostra o numero de WhatsApp que sera usado

---

## 4. Formatacao da URL WhatsApp

```typescript
const formatWhatsAppUrl = (phone: string, message: string): string => {
  // Remove caracteres especiais do telefone
  const cleanPhone = phone.replace(/[\s\-\(\)\+\u200B\u200C\u200D]/g, '');
  
  // Adiciona codigo do Brasil se nao tiver
  const finalPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
  
  // Codifica a mensagem para URL
  const encodedMessage = encodeURIComponent(message);
  
  return `https://wa.me/${finalPhone}?text=${encodedMessage}`;
};
```

---

## 5. Interface Visual do Modal

```text
+----------------------------------------------------------+
| 📱 Enviar Resumo via WhatsApp                         [X] |
+----------------------------------------------------------+
|                                                          |
| 📞 Numero: +55 81 99790-1365                             |
|                                                          |
| ┌──────────────────────────────────────────────────────┐ |
| │ Ola, Taciana! 👋                                     │ |
| │                                                      │ |
| │ Segue o resumo de performance personalizado das      │ |
| │ suas campanhas (01/01/2026 a 30/01/2026):           │ |
| │                                                      │ |
| │ 💰 Investimento: R$ 335,33                          │ |
| │ 💬 Conversas Iniciadas: 543                         │ |
| │ 🎯 Custo por Conversa: R$ 0,62                      │ |
| │                                                      │ |
| │ Estes sao os indicadores que estamos acompanhando   │ |
| │ de perto para o seu negocio. Qualquer duvida,       │ |
| │ estou aqui! 👊                                       │ |
| └──────────────────────────────────────────────────────┘ |
|                                                          |
| ⚠️ Voce pode editar a mensagem antes de enviar          |
|                                                          |
| [Cancelar]              [✓ Confirmar e Abrir WhatsApp]   |
+----------------------------------------------------------+
```

---

## 6. Integracao com PerformanceDashboard

Adicionar botao no header do dashboard:

```typescript
// Em PerformanceDashboard.tsx
<CardHeader>
  <div className="flex items-center justify-between">
    <div>
      <CardTitle>Dashboard de Performance</CardTitle>
      <CardDescription>Metricas consolidadas para {clientName}</CardDescription>
    </div>
    <Button onClick={() => setShowWhatsAppModal(true)}>
      <MessageCircle className="w-4 h-4 mr-2" />
      Enviar Resumo via WhatsApp
    </Button>
  </div>
</CardHeader>
```

---

## 7. Metricas Customizadas

O sistema deve agregar as metricas customizadas de todas as campanhas:

```typescript
const aggregateCustomMetrics = (campaigns: Campaign[]): Record<string, number> => {
  const aggregated: Record<string, number> = {};
  
  campaigns.forEach(campaign => {
    if (campaign.custom_metrics && Array.isArray(campaign.custom_metrics)) {
      campaign.custom_metrics.forEach((metric: { name: string; value: number }) => {
        if (metric.name) {
          aggregated[metric.name] = (aggregated[metric.name] || 0) + (metric.value || 0);
        }
      });
    }
  });
  
  return aggregated;
};
```

---

## Fluxo de Usuario

1. Usuario seleciona um cliente
2. Dashboard de Performance exibe as metricas
3. Usuario clica em "Enviar Resumo via WhatsApp"
4. Modal abre com mensagem pre-construida baseada nas metricas ativas
5. Usuario pode editar a mensagem se necessario
6. Usuario clica em "Confirmar e Abrir WhatsApp"
7. Navegador abre WhatsApp Web com a mensagem pronta

---

## Tratamento de Erros

| Situacao | Comportamento |
|----------|---------------|
| Cliente sem WhatsApp cadastrado | Mostrar toast de erro e desabilitar botao |
| Sem dados de campanhas | Botao desabilitado com tooltip explicativo |
| Formato de telefone invalido | Validacao e mensagem de erro no modal |

---

## Arquivos a Modificar

1. **Criar**: `src/components/customer-success/WhatsAppSummaryModal.tsx`
2. **Modificar**: `src/components/customer-success/PerformanceDashboard.tsx`
3. **Modificar**: `src/pages/CustomerSuccess.tsx`
