// Verifica clientes com contrato ou pagamento mensal vencendo em breve e
// envia UM resumo por WhatsApp (Cloud API oficial da Meta) para o número
// interno da agência. Feito para ser chamado 1x/dia por um agendamento
// (pg_cron + pg_net, ver migration whatsapp_alert_cron.sql) — não é chamado
// pelo front-end, por isso não valida um JWT de usuário; em vez disso,
// exige o header X-Cron-Secret batendo com o secret CRON_SECRET.
//
// Secrets necessários (Project Settings > Edge Functions > Secrets):
// - SUPABASE_SERVICE_ROLE_KEY (já existe por padrão no projeto)
// - WHATSAPP_ACCESS_TOKEN        token permanente do WhatsApp Cloud API
// - WHATSAPP_PHONE_NUMBER_ID     ID do número de WhatsApp Business remetente
// - WHATSAPP_TARGET_PHONE        número que deve RECEBER o alerta, formato E.164 sem "+" (ex: 5581984000446)
// - WHATSAPP_TEMPLATE_NAME       nome do template aprovado na Meta (ex: "vencimento_alerta")
// - WHATSAPP_TEMPLATE_LANGUAGE   código do idioma do template (ex: "pt_BR")
// - CRON_SECRET                  segredo aleatório definido por você, usado só para autorizar o cron

const CONTRACT_ALERT_WINDOW_DAYS = 30;
const PAYMENT_ALERT_WINDOW_DAYS = 7;
const META_GRAPH_VERSION = 'v21.0';

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

interface ClientRow {
  id: string;
  user_id?: string;
  project_start_date: string | null;
  contract_duration_months: number | null;
  payment_due_date: string | null;
  lead?: { company_name?: string } | null;
}

Deno.serve(async (req) => {
  try {
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedSecret = req.headers.get('X-Cron-Secret');
    if (!cronSecret || providedSecret !== cronSecret) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const today = new Date();
    const reference = todayISO();
    const contractWindowEnd = addDays(today, CONTRACT_ALERT_WINDOW_DAYS);
    const paymentWindowEnd = addDays(today, PAYMENT_ALERT_WINDOW_DAYS);

    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, project_start_date, contract_duration_months, payment_due_date, status, lead:leads(company_name)')
      .eq('status', 'active');

    if (clientsError) throw clientsError;

    const contractsExpiring = (clients || []).filter((client: ClientRow) => {
      if (!client.project_start_date || !client.contract_duration_months) return false;
      const start = new Date(client.project_start_date);
      const end = new Date(start);
      end.setMonth(end.getMonth() + client.contract_duration_months);
      return end > today && end < contractWindowEnd;
    });

    const paymentsDue = (clients || []).filter((client: ClientRow) => {
      if (!client.payment_due_date) return false;
      const due = new Date(client.payment_due_date);
      return due > today && due < paymentWindowEnd;
    });

    // Remove quem já foi notificado hoje para o mesmo tipo de alerta
    const { data: alreadySent } = await supabase
      .from('vencimento_notifications')
      .select('client_id, alert_type')
      .eq('reference_date', reference);

    const sentKey = (clientId: string, type: string) => `${clientId}:${type}`;
    const alreadySentSet = new Set((alreadySent || []).map((row: { client_id: string; alert_type: string }) => sentKey(row.client_id, row.alert_type)));

    const newContractAlerts = contractsExpiring.filter((c: ClientRow) => !alreadySentSet.has(sentKey(c.id, 'contrato')));
    const newPaymentAlerts = paymentsDue.filter((c: ClientRow) => !alreadySentSet.has(sentKey(c.id, 'pagamento')));

    if (newContractAlerts.length === 0 && newPaymentAlerts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum vencimento novo para alertar hoje.' }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    const lines: string[] = [];
    if (newContractAlerts.length > 0) {
      lines.push(`Contratos vencendo (${CONTRACT_ALERT_WINDOW_DAYS}d): ` +
        newContractAlerts.map((c: ClientRow) => c.lead?.company_name || 'Cliente').join(', '));
    }
    if (newPaymentAlerts.length > 0) {
      lines.push(`Pagamentos vencendo (${PAYMENT_ALERT_WINDOW_DAYS}d): ` +
        newPaymentAlerts.map((c: ClientRow) => c.lead?.company_name || 'Cliente').join(', '));
    }
    const summaryText = lines.join('\n');

    const whatsappToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    const targetPhone = Deno.env.get('WHATSAPP_TARGET_PHONE');
    const templateName = Deno.env.get('WHATSAPP_TEMPLATE_NAME');
    const templateLanguage = Deno.env.get('WHATSAPP_TEMPLATE_LANGUAGE') || 'pt_BR';

    if (!whatsappToken || !phoneNumberId || !targetPhone || !templateName) {
      console.error('WhatsApp Cloud API not fully configured');
      return new Response(
        JSON.stringify({ success: false, error: 'WhatsApp Cloud API não configurado (faltam secrets).', pendingSummary: summaryText }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const whatsappResponse = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: targetPhone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: templateLanguage },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: summaryText }],
              },
            ],
          },
        }),
      },
    );

    const whatsappData = await whatsappResponse.json();
    if (!whatsappResponse.ok) {
      console.error('WhatsApp API error:', whatsappData);
      return new Response(
        JSON.stringify({ success: false, error: whatsappData?.error?.message || 'Erro ao enviar WhatsApp', pendingSummary: summaryText }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Registra os alertas enviados hoje para não duplicar em execuções futuras
    const notificationRows = [
      ...newContractAlerts.map((c: ClientRow) => ({ client_id: c.id, alert_type: 'contrato', reference_date: reference, channel: 'whatsapp', user_id: c.user_id })),
      ...newPaymentAlerts.map((c: ClientRow) => ({ client_id: c.id, alert_type: 'pagamento', reference_date: reference, channel: 'whatsapp', user_id: c.user_id })),
    ];

    // user_id não veio na query acima (não foi selecionado) — busca de novo com user_id incluso
    const clientIds = [...new Set(notificationRows.map((r) => r.client_id))];
    const { data: withOwners } = await supabase.from('clients').select('id, user_id').in('id', clientIds);
    const ownerByClient = new Map((withOwners || []).map((c: ClientRow) => [c.id, c.user_id]));
    const rowsWithOwner = notificationRows.map((r) => ({ ...r, user_id: ownerByClient.get(r.client_id) }));

    const { error: insertError } = await supabase.from('vencimento_notifications').insert(rowsWithOwner);
    if (insertError) {
      console.error('Failed to record sent notifications (message was sent, but may repeat tomorrow):', insertError);
    }

    return new Response(
      JSON.stringify({ success: true, sent: summaryText, clientsNotified: notificationRows.length }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in whatsapp-vencimento-alert:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro inesperado';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
