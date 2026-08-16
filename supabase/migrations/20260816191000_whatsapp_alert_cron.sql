-- Agenda o disparo diário do alerta de vencimento por WhatsApp.
--
-- IMPORTANTE (ação manual pode ser necessária):
-- As extensões pg_cron e pg_net normalmente precisam ser habilitadas pelo
-- painel do Supabase (Database > Extensions) antes desta migration rodar
-- com sucesso. Se a aplicação desta migration falhar por causa disso,
-- habilite as duas extensões por lá e rode este arquivo novamente
-- (ou execute o conteúdo manualmente no SQL Editor do Supabase).
--
-- Troque '<PROJECT_REF>' pela referência do seu projeto Supabase (está em
-- Project Settings > General > Reference ID) e '<CRON_SECRET>' pelo MESMO
-- valor que você configurar no secret CRON_SECRET da function, antes de
-- aplicar esta migration.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Roda todo dia às 08:00 (horário de Brasília, UTC-3) = 11:00 UTC
SELECT cron.schedule(
  'whatsapp-vencimento-alert-diario',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-vencimento-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Alternativa mais simples (e mais fácil de manter) caso prefira não lidar
-- com pg_cron/pg_net diretamente no banco: comente/remova o bloco acima e
-- use um agendamento externo (ex: cron-job.org, GitHub Actions, ou um
-- scheduled task do Claude) fazendo um POST diário para a mesma URL da
-- function, com o header X-Cron-Secret.
