# Dashboard de Anúncios — 2 correções + 2 funcionalidades

## Diagnóstico dos bugs (testado ao vivo nas 8 contas reais)

### 1) Seletor de campanha — filtra sim, mas parece que não
Testei a conta Chateau Truan: sem filtro o painel traz R$ 379,14; escolhendo a campanha "[VENDAS] [LOCAL] [REC] [JUNHO]" ele passa a trazer R$ 25,03, impressões 2.826, CTR 2,69%. Ou seja, os KPIs **já recalculam** para a campanha escolhida.

O que realmente acontece na tela:
- **Resultado vira "—"**: para essa campanha (objetivo Vendas) não existe nenhuma ação de compra no período, e hoje o cálculo por campanha não tem fallback — então a linha "Resultados" fica vazia e parece "não atualizou".
- **Gráfico fica quase vazio**: no recorte por campanha a série diária volta com pouquíssimos pontos (1 dia com gasto), e a área desenhada some.
- **Nada na tela indica que o filtro está ativo**: a tabela continua listando todas as campanhas, sem destaque na linha selecionada.

Correções: aplicar o mesmo fallback de resultado usado no agregado também na campanha filtrada, mostrar aviso/estado claro quando a série tem poucos pontos, destacar a linha selecionada na tabela e adicionar um botão "limpar filtro de campanha".

### 2) Contagem de mensagens — hoje há dupla contagem
Puxei os `action_types` crus das campanhas reais. Exemplo (Chateau Truan, campanha de engajamento):
```text
onsite_conversion.messaging_conversation_started_7d   27
onsite_conversion.messaging_first_reply               27
onsite_conversion.total_messaging_connection          31
onsite_conversion.messaging_user_depth_2_message_send 12
```
O código de hoje **soma** `messaging_conversation_started_7d` + `total_messaging_connection` → 58, quando o Gerenciador mostra 27 (conversas iniciadas). Esses tipos se sobrepõem e nunca devem ser somados.

Além disso, campanhas com objetivo Tráfego/Engajamento mas com destino WhatsApp/Direct (ex.: Arenna CT, 91 conversas iniciadas) têm "Mensagens" como resultado no Gerenciador, mas hoje contam cliques no link.

Correções:
- Mensagens passa a usar **um único** tipo, por ordem de preferência: `onsite_conversion.messaging_conversation_started_7d` → `onsite_conversion.messaging_first_reply` → `onsite_conversion.total_messaging_connection` → variação sem `_7d`.
- Buscar `optimization_goal` e `destination_type` dos conjuntos de anúncios: quando a campanha otimiza para conversas/WhatsApp/Messenger, o resultado passa a ser Mensagens mesmo que o objetivo seja Tráfego ou Engajamento.
- Regra geral: nunca somar action_types sobrepostos, sempre escolher o mais específico.

(Observação: a conta do cliente **thay_brows** ainda devolve erro #200 da Meta — falta liberar o usuário de sistema nessa conta.)

## 3) Melhor criativo
Na função, buscar os anúncios do período (`/ads/insights` com `level=ad`, campos de spend, actions e `ad_creative`), calcular o resultado certo por objetivo de cada anúncio e ordenar por menor custo por resultado.
- Com campanha selecionada: melhor criativo daquela campanha. Em "Todas as campanhas": melhor entre os anúncios ativos da conta.
- Card novo no dashboard com prévia (imagem ou thumbnail do vídeo), nome do anúncio, campanha, investimento, resultado (com rótulo certo) e custo por resultado.
- Se nenhum anúncio tiver resultado no período, o card mostra estado vazio explicativo.

## 4) Leitura profissional por campanha (linha expansível)
A função passa a devolver, por campanha, blocos extras de métricas:
- **Engajamento**: reações, comentários, compartilhamentos, salvamentos, cliques na página/post.
- **Desempenho**: investimento, impressões, alcance, frequência, CTR, CPC, CPM, resultado e custo por resultado.
- **Vídeo** (só quando houver): ThruPlay, views de 3s, 25/50/75/100% assistido, tempo médio de reprodução.

Na tabela "Campanhas da conta", cada linha ganha uma seta que expande um painel com esses blocos. Blocos sem dados (ex.: vídeo numa campanha só de imagem) simplesmente não aparecem.

## Técnico
- Tudo na edge function `meta-ads-insights` (Graph API v21.0, chamadas em paralelo) e na página `src/pages/AdsDashboard.tsx`. Sem mudanças no banco.
- Campos extras nos insights: `video_thruplay_watched_actions`, `video_play_actions`, `video_p25/50/75/100_watched_actions`, `video_avg_time_watched_actions`.
