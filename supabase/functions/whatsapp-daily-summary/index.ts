// Envia 1x/dia, por WhatsApp (Cloud API oficial da Meta), o resumo do dia do CRM:
// follow-ups de hoje, atrasados, vencimentos, agenda e tarefas pendentes.
// Mesmas regras do painel "Atividades do Dia" (src/lib/utils/dailyRules.ts).
//
// Chamado por agendamento (pg_cron ou cron externo), não pelo front-end: em vez
// de JWT de usuário, exige o header X-Cron-Secret igual ao secret CRON_SECRET.
//
// Secrets (Project Settings > Edge Functions > Secrets). Reaproveita os do alerta de vencimento:
// - WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TARGET_PHONE, CRON_SECRET
// - WHATSAPP_TEMPLATE_LANGUAGE        (opcional, padrão pt_BR)
// Novo:
// - WHATSAPP_SUMMARY_TEMPLATE_NAME    template aprovado na Meta com UMA variável {{1}} (ex: "resumo_diario")
// - DAILY_SUMMARY_USER_ID             (opcional) envia só os dados deste usuário do CRM

const META_GRAPH_VERSION = 'v21.0';
const CONTRACT_ALERT_WINDOW_DAYS = 30;
const PAYMENT_ALERT_WINDOW_DAYS = 7;
const NO_FOLLOW_UP_STATUSES = ['fechado', 'lead_perdido', 'sem_interesse'];
const MAX_NAMES = 4;
const PAGE_SIZE = 1000;

type Lead = {
  company_name: string;
  status: string | null;
  follow_up_1: string | null;
  follow_up_2: string | null;
  follow_up_3: string | null;
};

type Client = {
  status: string;
  project_start_date: string | null;
  contract_duration_months: number | null;
  payment_due_date: string | null;
  lead: { company_name: string | null } | null;
};

type Task = {
  id: string;
  title: string;
  task_date: string;
  status: string;
  source_type: string;
  source_ref: string;
  recurrence: string;
};

// Data de hoje no fuso de Brasília (a função roda em UTC).
function todayInBrazil(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

const toDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);
const daysBetween = (from: string, to: Date) => Math.round((to.getTime() - toDate(from).getTime()) / 86_400_000);

function occursOn(task: Task, today: string): boolean {
  if (today < task.task_date) return false;
  const day = toDate(today);
  const start = toDate(task.task_date);
  switch (task.recurrence) {
    case 'diaria':
      return true;
    case 'dias_uteis':
      return day.getUTCDay() !== 0 && day.getUTCDay() !== 6;
    case 'semanal':
      return day.getUTCDay() === start.getUTCDay();
    case 'mensal': {
      const lastDay = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0)).getUTCDate();
      return day.getUTCDate() === Math.min(start.getUTCDate(), lastDay);
    }
    default:
      return task.task_date === today;
  }
}

const names = (list: string[]) =>
  list.length === 0 ? '' : ` (${list.slice(0, MAX_NAMES).join(', ')}${list.length > MAX_NAMES ? ` +${list.length - MAX_NAMES}` : ''})`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  try {
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (!cronSecret || req.headers.get('X-Cron-Secret') !== cronSecret) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const userId = Deno.env.get('DAILY_SUMMARY_USER_ID');
    const scoped = (query: any) => (userId ? query.eq('user_id', userId) : query);

    const today = todayInBrazil();
    const todayDate = toDate(today);

    // Leads paginados (o Supabase limita cada busca a 1.000 linhas).
    const leads: Lead[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await scoped(
        supabase.from('leads').select('company_name, status, follow_up_1, follow_up_2, follow_up_3'),
      ).range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      leads.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
    }

    const [clientsRes, agendaRes, tasksRes] = await Promise.all([
      scoped(
        supabase
          .from('clients')
          .select('status, project_start_date, contract_duration_months, payment_due_date, lead:leads(company_name)')
          .eq('status', 'active'),
      ),
      scoped(
        supabase.from('agenda_events').select('title, scheduled_time').eq('scheduled_date', today).neq('status', 'cancelled'),
      ),
      scoped(
        supabase
          .from('daily_tasks')
          .select('id, title, task_date, status, source_type, source_ref, recurrence')
          .or(`task_date.eq.${today},recurrence.neq.nenhuma`),
      ),
    ]);
    if (clientsRes.error) throw clientsRes.error;
    if (agendaRes.error) throw agendaRes.error;

    const eligible = leads.filter((l) => !NO_FOLLOW_UP_STATUSES.includes(l.status || ''));
    const dates = (l: Lead) => [l.follow_up_1, l.follow_up_2, l.follow_up_3].filter(Boolean).map((d) => d!.slice(0, 10));
    const followUpsToday = eligible.filter((l) => dates(l).includes(today));
    const overdue = eligible.filter(
      (l) =>
        !dates(l).includes(today) &&
        !(l.follow_up_1 && l.follow_up_2 && l.follow_up_3) &&
        dates(l).some((d) => d < today),
    );

    const clients: Client[] = clientsRes.data || [];
    const contracts = clients.filter((c) => {
      if (!c.project_start_date || !c.contract_duration_months) return false;
      const end = toDate(c.project_start_date);
      end.setUTCMonth(end.getUTCMonth() + c.contract_duration_months);
      const days = Math.round((end.getTime() - todayDate.getTime()) / 86_400_000);
      return days > 0 && days < CONTRACT_ALERT_WINDOW_DAYS;
    });
    const payments = clients.filter((c) => {
      if (!c.payment_due_date) return false;
      const days = -daysBetween(c.payment_due_date, todayDate);
      return days > 0 && days < PAYMENT_ALERT_WINDOW_DAYS;
    });

    // Tarefas manuais (e repetidas) de hoje que ainda não foram concluídas.
    const tasks: Task[] = tasksRes.error ? [] : tasksRes.data || [];
    const doneOccurrences = new Set(
      tasks.filter((t) => t.source_type === 'recorrente' && t.task_date === today && t.status === 'concluida').map((t) => t.source_ref),
    );
    const pendingTasks = tasks.filter((t) => {
      if (t.source_type !== 'manual') return false;
      if (!t.recurrence || t.recurrence === 'nenhuma') return t.task_date === today && t.status !== 'concluida';
      return occursOn(t, today) && !doneOccurrences.has(t.id);
    });

    const agenda: { title: string; scheduled_time: string }[] = agendaRes.data || [];
    const company = (c: Client) => c.lead?.company_name || 'Cliente';

    // Template da Meta não aceita quebra de linha na variável: tudo em uma linha.
    const parts = [
      `📞 ${followUpsToday.length} follow-up(s) hoje${names(followUpsToday.map((l) => l.company_name))}`,
      overdue.length ? `⚠️ ${overdue.length} atrasado(s)${names(overdue.map((l) => l.company_name))}` : null,
      contracts.length ? `📄 ${contracts.length} contrato(s) vencendo${names(contracts.map(company))}` : null,
      payments.length ? `💰 ${payments.length} pagamento(s) vencendo${names(payments.map(company))}` : null,
      agenda.length
        ? `📅 ${agenda.length} compromisso(s)${names(agenda.map((e) => `${e.scheduled_time?.slice(0, 5)} ${e.title}`))}`
        : null,
      pendingTasks.length ? `✅ ${pendingTasks.length} tarefa(s)${names(pendingTasks.map((t) => t.title))}` : null,
    ].filter(Boolean);
    const summaryText = parts.join(' · ');

    const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    const targetPhone = Deno.env.get('WHATSAPP_TARGET_PHONE');
    const templateName = Deno.env.get('WHATSAPP_SUMMARY_TEMPLATE_NAME');
    const templateLanguage = Deno.env.get('WHATSAPP_TEMPLATE_LANGUAGE') || 'pt_BR';

    if (!token || !phoneNumberId || !targetPhone || !templateName) {
      return json({ success: false, error: 'WhatsApp não configurado (faltam secrets).', pendingSummary: summaryText }, 500);
    }

    const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: targetPhone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLanguage },
          components: [{ type: 'body', parameters: [{ type: 'text', text: summaryText.slice(0, 1000) }] }],
        },
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      console.error('WhatsApp API error:', result);
      return json({ success: false, error: result?.error?.message || 'Erro ao enviar WhatsApp', pendingSummary: summaryText }, 502);
    }

    return json({ success: true, sent: summaryText });
  } catch (error) {
    console.error('Error in whatsapp-daily-summary:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Erro inesperado' }, 500);
  }
});
