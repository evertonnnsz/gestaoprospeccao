# Dashboard de Anúncios (Meta Ads)

## 1. Edge function `meta-ads-insights`
Passa a aceitar um parâmetro `mode` e devolver dados bem mais ricos, mantendo a validação atual (JWT + dono do cliente).

Parâmetros aceitos:
- `client_id` (obrigatório)
- `date_preset` (`last_7d`, `last_14d`, `last_30d`, `last_90d`) **ou** `since`/`until` para datas customizadas
- `campaign_id` (opcional, filtra o agregado numa campanha)

Respostas:
- **account**: agregado da conta (ou da campanha filtrada) com investimento, impressões, alcance, frequência, CPM, CPC, CTR, resultado correto e custo por resultado
- **campaigns**: lista de campanhas da conta (`name`, `objective`, `status`) já cruzada com insights por campanha
- **timeseries**: insights por dia (`time_increment=1`) para o gráfico de evolução

### Mapa objetivo → action_type (o "Resultados" correto)
| Objetivo da campanha | Resultado contado |
|---|---|
| Mensagens (MESSAGES / conversas) | conversas iniciadas (`onsite_conversion.messaging_conversation_started_7d`) |
| Geração de leads (LEAD_GENERATION) | leads (`lead`, `onsite_conversion.lead_grouped`) |
| Conversões / vendas (CONVERSIONS, SALES, CATALOG) | compras / conversões do pixel (`purchase`, `offsite_conversion.fb_pixel_purchase`) |
| Tráfego (TRAFFIC / LINK_CLICKS) | cliques no link (`link_click`) |
| Reconhecimento / alcance (AWARENESS, REACH) | alcance |
| Engajamento / vídeo | engajamento com a publicação / views |
| Desconhecido | fallback: melhor ação disponível, com rótulo explícito |

Cada resultado volta com `label` (ex.: "Conversas iniciadas") para a tela exibir o nome certo, e o custo por resultado é calculado só em cima dele.

## 2. Banco de dados
Nenhuma mudança necessária — usa `clients.meta_ads_account_id` que já existe. Sem novas tabelas (dados vêm ao vivo da Meta).

## 3. Nova página: Dashboard de Anúncios
Rota `/ads-dashboard`, item no menu lateral (grupo Operação), aceitando `?client=<id>` para abrir já filtrada.

Estrutura:
- Barra de filtros: cliente (só os que têm conta Meta cadastrada), período (7/14/30/90 dias ou intervalo customizado) e campanha (carregada após escolher o cliente)
- Cards de KPI: Investimento, Impressões, Alcance, Frequência, CPM, CPC, CTR, Resultado (rótulo dinâmico) e Custo por resultado
- Gráfico de linha/área: investimento e impressões por dia no período
- Tabela de campanhas: nome, objetivo, status (badge), investimento, resultado (tipo certo), custo por resultado — ordenável por investimento, clicável para filtrar o dashboard naquela campanha
- Estados de carregando / erro da Meta / conta sem dados no período

## 4. Ficha do cliente (aba Campanhas)
Enxuga o bloco atual: mantém só os KPIs principais (Investimento, Impressões, Cliques, CTR, CPC, Resultado + custo por resultado), remove qualquer detalhamento pesado e adiciona o botão "Ver dashboard completo" que leva para `/ads-dashboard?client=<id>`.

## Observações técnicas
- Chamadas à Graph API v21.0 em paralelo (agregado, campanhas, série temporal) para manter a resposta rápida
- Tratamento de erro da Meta preservado (mensagem clara em vez de 500 genérico)
- Formatação em pt-BR / BRL, seguindo os componentes e tokens já usados no CRM
