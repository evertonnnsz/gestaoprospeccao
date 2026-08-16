# Setup — Alertas de vencimento (WhatsApp) e Dashboard da Meta Ads

Este documento cobre os passos manuais que só você consegue fazer (exigem acesso ao seu Business Manager da Meta e ao painel do Supabase/Lovable). O código já está pronto na branch `feature/crm-profissional-vencimentos-dashboard-meta`; depois de revisar e mesclar na `main`, siga estes passos para tudo funcionar de ponta a ponta.

## 1. Aplicar as migrations de banco

Duas migrations novas em `supabase/migrations/`:

- `20260816190000_meta_ads_account_and_vencimento_alerts.sql` — adiciona o campo `meta_ads_account_id` em `clients` e cria a tabela `vencimento_notifications`.
- `20260816191000_whatsapp_alert_cron.sql` — agenda o disparo diário (precisa de edição antes de aplicar, ver passo 5).

O Lovable normalmente não aplica migrations automaticamente só por causa de um push no GitHub — abra o projeto no Lovable e peça para ele aplicar as migrations pendentes (ele detecta os arquivos novos em `supabase/migrations/`), ou aplique manualmente pelo SQL Editor do Supabase (Project > SQL Editor), colando o conteúdo de cada arquivo em ordem.

## 2. Vincular a conta de anúncios de cada cliente

No cadastro de cada cliente (Clientes > editar), preencha o novo campo **Conta de Anúncios (Meta Ads)** com o ID no formato `act_1234567890` (encontrado em Gerenciador de Anúncios > configurações da conta, ou na URL do Ads Manager).

## 3. Criar o token de acesso da Meta (para o dashboard puxar resultados)

1. Acesse [Meta Business Suite](https://business.facebook.com) > Configurações do Negócio > Usuários > Usuários do sistema.
2. Crie um "Usuário do sistema" (System User) com papel de Admin (ou Funcionário, se preferir escopo menor).
3. Atribua a ele as contas de anúncios dos clientes que devem aparecer no dashboard.
4. Gere um token de acesso para esse usuário do sistema, com a permissão `ads_read`, sem expiração (token de longa duração).
5. No Supabase: Project Settings > Edge Functions > Secrets, adicione:
   - `META_SYSTEM_USER_TOKEN` = o token gerado.

## 4. Configurar o WhatsApp Business Cloud API (para o alerta de vencimento)

1. No mesmo Business Manager, vá em Configurações do Negócio > Contas > Contas do WhatsApp e crie/associe um número de WhatsApp Business (pode ser um número novo, não precisa ser o mesmo que você já usa pessoalmente).
2. Em Meta for Developers, crie um App do tipo "Business" e adicione o produto "WhatsApp".
3. Gere um token de acesso permanente (também via System User, permissão `whatsapp_business_messaging`).
4. Crie um template de mensagem (Gerenciador do WhatsApp > Templates de mensagem) com uma variável de corpo, por exemplo:
   > "Alerta CRM Prospect:\n{{1}}"
   Envie para aprovação (costuma sair em minutos a poucas horas).
5. No Supabase, adicione os secrets:
   - `WHATSAPP_ACCESS_TOKEN` = o token permanente
   - `WHATSAPP_PHONE_NUMBER_ID` = ID do número remetente (painel do WhatsApp no Meta for Developers)
   - `WHATSAPP_TARGET_PHONE` = `5581984000446` (seu número, sem "+")
   - `WHATSAPP_TEMPLATE_NAME` = o nome que você deu ao template
   - `WHATSAPP_TEMPLATE_LANGUAGE` = `pt_BR` (ou o idioma escolhido no template)
   - `CRON_SECRET` = qualquer valor aleatório forte (ex: gerado por um gerenciador de senhas) — só serve para autorizar o agendamento a chamar a function.

## 5. Agendar o disparo diário

Abra `supabase/migrations/20260816191000_whatsapp_alert_cron.sql`, troque:

- `<PROJECT_REF>` pela referência do seu projeto Supabase (Project Settings > General).
- `<CRON_SECRET>` pelo mesmo valor que você colocou no secret `CRON_SECRET` acima.

Aplique a migration (mesmo processo do passo 1). Se `pg_cron`/`pg_net` não estiverem habilitados no projeto, habilite em Database > Extensions antes.

Se preferir não mexer com pg_cron, existe uma alternativa mais simples no fim do próprio arquivo da migration (chamar a function 1x/dia por um agendador externo).

## 6. Testar

- Dashboard por cliente: abra Clientes, vincule uma conta de anúncios em qualquer cliente ativo, clique no ícone de dashboard no card (ou vá em `/clients/<id>`) e confira a aba "Campanhas" — deve aparecer "Resultados reais".
- Alerta de vencimento: você pode disparar manualmente a function `whatsapp-vencimento-alert` (painel do Supabase > Edge Functions > Invoke, ou via `curl`) com o header `X-Cron-Secret` para testar antes de esperar o agendamento das 8h.
