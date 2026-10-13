# Resumo diário no WhatsApp

Todo dia de manhã, a função `whatsapp-daily-summary` manda para o seu WhatsApp o resumo do
painel **Atividades do Dia**: follow-ups de hoje, atrasados, contratos e pagamentos vencendo,
compromissos da agenda e tarefas pendentes.

Exemplo de mensagem:

> ☀️ Bom dia! Seu resumo de hoje no CRM: 📞 3 follow-up(s) hoje (Studio Bella, Mercado Bom Preço, Clínica Sorriso) · ⚠️ 1 atrasado(s) (Ótica Visão) · 📄 1 contrato(s) vencendo (Pizzaria Forno a Lenha) · ✅ 2 tarefa(s) (Gravar criativos, Relatório semanal)

Ela usa a mesma conexão (WhatsApp Cloud API) do alerta de vencimentos. Se esse alerta já
funciona, faltam só os passos 1, 2 e 4.

## 1. Criar o template na Meta

No **WhatsApp Manager > Modelos de mensagem**, crie um modelo:

- **Nome:** `resumo_diario`
- **Categoria:** Utilidade
- **Idioma:** Português (BR)
- **Corpo:**

  ```
  ☀️ Bom dia! Seu resumo de hoje no CRM: {{1}}

  Abra o painel Atividades do Dia para dar check no que for concluindo.
  ```

A Meta precisa aprovar o modelo (normalmente leva minutos). A variável `{{1}}` recebe o resumo
em uma linha, porque a Meta não aceita quebra de linha dentro da variável.

## 2. Secrets da função

Em **Supabase > Project Settings > Edge Functions > Secrets**, adicione:

| Secret | Valor |
| --- | --- |
| `WHATSAPP_SUMMARY_TEMPLATE_NAME` | `resumo_diario` |
| `DAILY_SUMMARY_USER_ID` | *(opcional)* ID do seu usuário, para mandar só os seus dados |

Os demais já existem por causa do alerta de vencimento: `WHATSAPP_ACCESS_TOKEN`,
`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TARGET_PHONE` (quem recebe), `WHATSAPP_TEMPLATE_LANGUAGE`
e `CRON_SECRET`.

## 3. Testar uma vez

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-daily-summary" -H "X-Cron-Secret: <CRON_SECRET>"
```

A resposta mostra o texto enviado (`sent`). Se faltar algum secret, ela devolve o texto que
seria enviado em `pendingSummary`.

## 4. Agendar todo dia às 07:30

No **SQL Editor** do Supabase, troque `<PROJECT_REF>` e `<CRON_SECRET>` e rode:

```sql
select cron.schedule(
  'whatsapp-resumo-diario',
  '30 10 * * 1-6', -- 07:30 de Brasília (10:30 UTC), de segunda a sábado
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-daily-summary',
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Cron-Secret', '<CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);
```

Para mudar o horário depois, rode `select cron.unschedule('whatsapp-resumo-diario');` e agende de novo.
