import { useCallback, useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, format, getDaysInMonth, isToday, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAllRows } from '@/lib/supabaseFetch';
import { normalizeWhatsAppPhone } from '@/lib/utils/whatsapp';
import { buildFollowUpCompletion } from '@/lib/utils/followUpDates';
import {
  getContractEndDate,
  hasFollowUpOn,
  hasOverdueFollowUp,
  isContractExpiringSoon,
  isPaymentDueSoon,
} from '@/lib/utils/dailyRules';

// daily_tasks ainda não está nos tipos gerados do Supabase.
const db = supabase as any;

export type ActivityKind =
  | 'follow_up_atrasado'
  | 'follow_up'
  | 'agenda'
  | 'contrato'
  | 'pagamento'
  | 'onboarding'
  | 'manual';

export type ActivityStatus = 'a_fazer' | 'em_andamento' | 'concluida';
export type ActivityPriority = 'urgente' | 'alta' | 'normal' | 'baixa';
export type ActivityRecurrence = 'nenhuma' | 'diaria' | 'dias_uteis' | 'semanal' | 'mensal';

// Tipo gravado em daily_tasks.source_type (ocorrências de tarefas repetidas usam 'recorrente').
type SourceType = Exclude<ActivityKind, 'agenda'> | 'recorrente';

export type ActivityItem = {
  key: string;
  kind: ActivityKind;
  title: string;
  subtitle?: string;
  priority: ActivityPriority;
  status: ActivityStatus;
  time?: string;
  path?: string;
  whatsappUrl?: string;
  notes?: string | null;
  recurrence?: ActivityRecurrence;
  // Persistência
  sourceType: SourceType | 'agenda';
  taskId?: string;
  templateId?: string;
  agendaId?: string;
  sourceRef: string;
  taskDate: string;
  leadId?: string | null;
  clientId?: string | null;
};

export const KIND_LABELS: Record<ActivityKind, string> = {
  follow_up_atrasado: 'Follow-up atrasado',
  follow_up: 'Follow-up',
  agenda: 'Agenda',
  contrato: 'Contrato',
  pagamento: 'Pagamento',
  onboarding: 'Onboarding',
  manual: 'Tarefa',
};

export const STATUS_LABELS: Record<ActivityStatus, string> = {
  a_fazer: 'A fazer',
  em_andamento: 'Em andamento',
  concluida: 'Concluído',
};

export const PRIORITY_LABELS: Record<ActivityPriority, string> = {
  urgente: 'Urgente',
  alta: 'Alta',
  normal: 'Normal',
  baixa: 'Baixa',
};

export const RECURRENCE_LABELS: Record<ActivityRecurrence, string> = {
  nenhuma: 'Não repetir',
  diaria: 'Todo dia',
  dias_uteis: 'Dias úteis (seg-sex)',
  semanal: 'Toda semana',
  mensal: 'Todo mês',
};

const PRIORITY_RANK: Record<ActivityPriority, number> = { urgente: 0, alta: 1, normal: 2, baixa: 3 };

type LeadRow = {
  id: string;
  company_name: string;
  contact_name: string | null;
  whatsapp: string | null;
  status: string | null;
  follow_up_1: string | null;
  follow_up_2: string | null;
  follow_up_3: string | null;
};

type ClientRow = {
  id: string;
  status: string;
  project_start_date: string | null;
  contract_duration_months: number | null;
  payment_due_date: string | null;
  project_value: number | null;
  lead: { company_name: string | null; whatsapp: string | null } | null;
};

type TaskRow = {
  id: string;
  task_date: string;
  title: string;
  notes: string | null;
  priority: ActivityPriority;
  status: ActivityStatus;
  source_type: SourceType;
  source_ref: string;
  recurrence: ActivityRecurrence;
  lead_id: string | null;
  client_id: string | null;
};

type AgendaRow = {
  id: string;
  title: string;
  scheduled_time: string;
  status: string;
  lead_id: string | null;
  client_id: string | null;
};

type RawData = {
  leads: LeadRow[];
  clients: ClientRow[];
  agenda: AgendaRow[];
  onboarding: { client_id: string }[];
  tasks: TaskRow[];
};

const EMPTY: RawData = { leads: [], clients: [], agenda: [], onboarding: [], tasks: [] };

const whatsappLink = (phone: string | null) => {
  const normalized = normalizeWhatsAppPhone(phone);
  return normalized ? `https://wa.me/${normalized}` : undefined;
};

const shortDate = (value: string | Date) =>
  format(typeof value === 'string' ? parseISO(value) : value, 'dd/MM');

const money = (value: number | null) =>
  value ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null;

const isMissingTableError = (error: any) =>
  error?.code === '42P01' || error?.code === 'PGRST205' || /daily_tasks/.test(error?.message || '');

// Uma tarefa repetida acontece neste dia?
export function occursOn(template: { task_date: string; recurrence: ActivityRecurrence }, date: Date): boolean {
  const dateStr = format(date, 'yyyy-MM-dd');
  if (dateStr < template.task_date) return false;
  const start = parseISO(template.task_date);
  switch (template.recurrence) {
    case 'diaria':
      return true;
    case 'dias_uteis':
      return date.getDay() !== 0 && date.getDay() !== 6;
    case 'semanal':
      return date.getDay() === start.getDay();
    case 'mensal':
      // Dia 31 vira o último dia em meses mais curtos.
      return date.getDate() === Math.min(start.getDate(), getDaysInMonth(date));
    default:
      return dateStr === template.task_date;
  }
}

function buildItems(data: RawData, date: Date, dateStr: string): ActivityItem[] {
  const viewingToday = isToday(date);
  const taskByKey = new Map(data.tasks.map((t) => [`${t.source_type}:${t.source_ref}:${t.task_date}`, t]));
  const clientName = new Map(data.clients.map((c) => [c.id, c.lead?.company_name || 'Cliente']));
  const items: ActivityItem[] = [];

  const auto = (base: Omit<ActivityItem, 'status' | 'key' | 'taskId' | 'sourceType'>): ActivityItem => {
    const key = `${base.kind}:${base.sourceRef}:${base.taskDate}`;
    const saved = taskByKey.get(key);
    return { ...base, key, sourceType: base.kind as SourceType, status: saved?.status || 'a_fazer', taskId: saved?.id };
  };

  data.leads.forEach((lead) => {
    const contact = lead.contact_name ? ` · ${lead.contact_name}` : '';
    if (hasFollowUpOn(lead, date)) {
      const step = [lead.follow_up_1, lead.follow_up_2, lead.follow_up_3].findIndex(
        (d) => d && d.slice(0, 10) === dateStr,
      );
      items.push(
        auto({
          kind: 'follow_up',
          title: `Follow-up ${step + 1} com ${lead.company_name}`,
          subtitle: `Lead${contact}`,
          priority: 'alta',
          path: `/leads?filter=today`,
          whatsappUrl: whatsappLink(lead.whatsapp),
          sourceRef: lead.id,
          taskDate: dateStr,
          leadId: lead.id,
        }),
      );
    } else if (viewingToday && hasOverdueFollowUp(lead)) {
      const late = [lead.follow_up_1, lead.follow_up_2, lead.follow_up_3]
        .filter((d): d is string => Boolean(d))
        .sort()
        .pop();
      items.push(
        auto({
          kind: 'follow_up_atrasado',
          title: `Follow-up atrasado: ${lead.company_name}`,
          subtitle: `Previsto para ${late ? shortDate(late) : '—'}${contact}`,
          priority: 'urgente',
          path: `/leads`,
          whatsappUrl: whatsappLink(lead.whatsapp),
          sourceRef: lead.id,
          taskDate: dateStr,
          leadId: lead.id,
        }),
      );
    }
  });

  data.agenda.forEach((event) => {
    items.push({
      key: `agenda:${event.id}`,
      kind: 'agenda',
      sourceType: 'agenda',
      title: event.title,
      subtitle: event.client_id ? clientName.get(event.client_id) : 'Compromisso da agenda',
      time: event.scheduled_time?.slice(0, 5),
      priority: 'alta',
      status: event.status === 'completed' ? 'concluida' : 'a_fazer',
      agendaId: event.id,
      sourceRef: event.id,
      taskDate: dateStr,
      leadId: event.lead_id,
      clientId: event.client_id,
    });
  });

  if (viewingToday) {
    data.clients
      .filter((c) => c.status === 'active')
      .forEach((client) => {
        const name = client.lead?.company_name || 'Cliente';
        if (isContractExpiringSoon(client)) {
          const end = getContractEndDate(client)!;
          const days = differenceInCalendarDays(end, date);
          items.push(
            auto({
              kind: 'contrato',
              title: `Renovar contrato de ${name}`,
              subtitle: `Vence em ${days} dia${days === 1 ? '' : 's'} (${shortDate(end)})`,
              priority: days <= 7 ? 'urgente' : 'alta',
              path: `/clients/${client.id}`,
              whatsappUrl: whatsappLink(client.lead?.whatsapp || null),
              sourceRef: client.id,
              taskDate: format(end, 'yyyy-MM-dd'),
              clientId: client.id,
            }),
          );
        }
        if (isPaymentDueSoon(client) && client.payment_due_date) {
          const days = differenceInCalendarDays(new Date(client.payment_due_date), date);
          const value = money(client.project_value);
          items.push(
            auto({
              kind: 'pagamento',
              title: `Cobrar pagamento de ${name}`,
              subtitle: `Vence em ${days} dia${days === 1 ? '' : 's'} (${shortDate(client.payment_due_date)})${value ? ` · ${value}` : ''}`,
              priority: days <= 2 ? 'urgente' : 'alta',
              path: `/clients/${client.id}`,
              whatsappUrl: whatsappLink(client.lead?.whatsapp || null),
              sourceRef: client.id,
              taskDate: client.payment_due_date.slice(0, 10),
              clientId: client.id,
            }),
          );
        }
      });

    const pendingByClient = new Map<string, number>();
    data.onboarding.forEach((t) => pendingByClient.set(t.client_id, (pendingByClient.get(t.client_id) || 0) + 1));
    pendingByClient.forEach((count, clientId) => {
      items.push(
        auto({
          kind: 'onboarding',
          title: `Avançar onboarding de ${clientName.get(clientId) || 'cliente'}`,
          subtitle: `${count} tarefa${count > 1 ? 's' : ''} pendente${count > 1 ? 's' : ''}`,
          priority: 'normal',
          path: '/onboarding',
          sourceRef: clientId,
          taskDate: dateStr,
          clientId,
        }),
      );
    });
  }

  // Follow-ups concluídos no dia: o lead já foi reagendado, mas o item continua em "Concluído".
  const shownKeys = new Set(items.map((i) => i.key));
  data.tasks
    .filter(
      (t) =>
        (t.source_type === 'follow_up' || t.source_type === 'follow_up_atrasado') &&
        t.task_date === dateStr &&
        !shownKeys.has(`${t.source_type}:${t.source_ref}:${t.task_date}`),
    )
    .forEach((task) => {
      items.push({
        key: `${task.source_type}:${task.source_ref}:${task.task_date}`,
        kind: task.source_type as ActivityKind,
        sourceType: task.source_type,
        title: task.title,
        subtitle: 'Contato registrado no lead',
        priority: task.priority,
        status: task.status,
        path: '/leads',
        taskId: task.id,
        sourceRef: task.source_ref,
        taskDate: task.task_date,
        leadId: task.lead_id,
      });
    });

  data.tasks
    .filter((t) => t.source_type === 'manual')
    .forEach((task) => {
      const repeats = task.recurrence && task.recurrence !== 'nenhuma';
      if (!repeats) {
        if (task.task_date !== dateStr) return;
        items.push({
          key: `manual:${task.id}`,
          kind: 'manual',
          sourceType: 'manual',
          title: task.title,
          subtitle: task.notes || undefined,
          notes: task.notes,
          priority: task.priority,
          status: task.status,
          taskId: task.id,
          sourceRef: task.source_ref,
          taskDate: task.task_date,
          leadId: task.lead_id,
          clientId: task.client_id,
        });
        return;
      }

      if (!occursOn(task, date)) return;
      const occurrence = taskByKey.get(`recorrente:${task.id}:${dateStr}`);
      items.push({
        key: `recorrente:${task.id}:${dateStr}`,
        kind: 'manual',
        sourceType: 'recorrente',
        title: task.title,
        subtitle: task.notes || undefined,
        notes: task.notes,
        recurrence: task.recurrence,
        priority: task.priority,
        status: occurrence?.status || 'a_fazer',
        taskId: occurrence?.id,
        templateId: task.id,
        sourceRef: task.id,
        taskDate: dateStr,
        leadId: task.lead_id,
        clientId: task.client_id,
      });
    });

  return items.sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      (a.time || '99').localeCompare(b.time || '99') ||
      a.title.localeCompare(b.title, 'pt-BR'),
  );
}

export function useDailyActivities(date: Date) {
  const { user } = useAuth();
  const dateStr = format(date, 'yyyy-MM-dd');
  const [data, setData] = useState<RawData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [leads, clientsRes, agendaRes, onboardingRes, tasksRes] = await Promise.all([
        fetchAllRows<LeadRow>('leads', {
          select: 'id, company_name, contact_name, whatsapp, status, follow_up_1, follow_up_2, follow_up_3',
        }),
        supabase
          .from('clients')
          .select(
            'id, status, project_start_date, contract_duration_months, payment_due_date, project_value, lead:leads(company_name, whatsapp)',
          ),
        supabase
          .from('agenda_events')
          .select('id, title, scheduled_time, status, lead_id, client_id')
          .eq('scheduled_date', dateStr)
          .neq('status', 'cancelled'),
        supabase
          .from('client_onboarding_tasks')
          .select('client_id')
          .eq('is_completed', false)
          .eq('is_applicable', true)
          .eq('is_lead_responsibility', false),
        db
          .from('daily_tasks')
          .select('*')
          .or(`task_date.eq.${dateStr},source_type.in.(contrato,pagamento),recurrence.neq.nenhuma`),
      ]);

      setTableMissing(Boolean(tasksRes.error && isMissingTableError(tasksRes.error)));
      setData({
        leads,
        clients: (clientsRes.data as unknown as ClientRow[]) || [],
        agenda: (agendaRes.data as AgendaRow[]) || [],
        onboarding: onboardingRes.data || [],
        tasks: (tasksRes.data as TaskRow[]) || [],
      });
    } catch (error) {
      console.error('Erro ao carregar atividades do dia:', error);
    } finally {
      setLoading(false);
    }
  }, [user, dateStr]);

  useEffect(() => {
    load();
  }, [load]);

  const items = useMemo(() => buildItems(data, date, dateStr), [data, date, dateStr]);

  const patchTask = (row: TaskRow) =>
    setData((current) => ({
      ...current,
      tasks: [...current.tasks.filter((t) => t.id !== row.id), row],
    }));

  // Concluir o follow-up no painel faz o mesmo que o botão do card do lead:
  // registra o contato de hoje e agenda o próximo follow-up.
  const syncFollowUpWithLead = async (item: ActivityItem) => {
    const lead = data.leads.find((l) => l.id === item.leadId);
    if (!lead || item.taskDate !== format(new Date(), 'yyyy-MM-dd')) return;
    const updates = buildFollowUpCompletion(lead, new Date(), item.kind === 'follow_up_atrasado');
    const { error } = await supabase.from('leads').update(updates).eq('id', lead.id);
    if (error) throw error;
    setData((current) => ({
      ...current,
      leads: current.leads.map((l) => (l.id === lead.id ? { ...l, ...updates } : l)),
    }));
  };

  const setStatus = async (item: ActivityItem, status: ActivityStatus) => {
    if (!user) return;
    const completed_at = status === 'concluida' ? new Date().toISOString() : null;

    if (item.kind === 'agenda' && item.agendaId) {
      const agendaStatus = status === 'concluida' ? 'completed' : 'scheduled';
      setData((current) => ({
        ...current,
        agenda: current.agenda.map((e) => (e.id === item.agendaId ? { ...e, status: agendaStatus } : e)),
      }));
      await supabase
        .from('agenda_events')
        .update({ status: agendaStatus, updated_at: new Date().toISOString() })
        .eq('id', item.agendaId);
      return;
    }

    if (item.taskId) {
      const { data: row, error } = await db
        .from('daily_tasks')
        .update({ status, completed_at })
        .eq('id', item.taskId)
        .select()
        .single();
      if (error) throw error;
      patchTask(row);
    } else {
      const { data: row, error } = await db
        .from('daily_tasks')
        .upsert(
          {
            user_id: user.id,
            task_date: item.taskDate,
            title: item.title,
            priority: item.priority,
            status,
            completed_at,
            source_type: item.sourceType,
            source_ref: item.sourceRef,
            lead_id: item.leadId || null,
            client_id: item.clientId || null,
          },
          { onConflict: 'user_id,source_type,source_ref,task_date' },
        )
        .select()
        .single();
      if (error) throw error;
      patchTask(row);
    }

    if (status === 'concluida' && (item.kind === 'follow_up' || item.kind === 'follow_up_atrasado')) {
      await syncFollowUpWithLead(item);
    }
  };

  const createTask = async (input: {
    title: string;
    priority?: ActivityPriority;
    notes?: string;
    date?: string;
    recurrence?: ActivityRecurrence;
  }) => {
    if (!user) return;
    const { data: row, error } = await db
      .from('daily_tasks')
      .insert({
        user_id: user.id,
        title: input.title,
        notes: input.notes || null,
        priority: input.priority || 'normal',
        task_date: input.date || dateStr,
        recurrence: input.recurrence || 'nenhuma',
        source_type: 'manual',
      })
      .select()
      .single();
    if (error) throw error;
    patchTask(row);
  };

  // Em tarefas repetidas, prioridade e exclusão valem para a série (o modelo).
  const manualTaskId = (item: ActivityItem) => (item.kind === 'manual' ? item.templateId || item.taskId : undefined);

  const updatePriority = async (item: ActivityItem, priority: ActivityPriority) => {
    const id = manualTaskId(item);
    if (!id) return;
    const { data: row, error } = await db.from('daily_tasks').update({ priority }).eq('id', id).select().single();
    if (error) throw error;
    patchTask(row);
  };

  const deleteTask = async (item: ActivityItem) => {
    const id = manualTaskId(item);
    if (!id) return;
    const { error } = await db.from('daily_tasks').delete().eq('id', id);
    if (error) throw error;
    setData((current) => ({ ...current, tasks: current.tasks.filter((t) => t.id !== id) }));
  };

  return { items, loading, tableMissing, reload: load, setStatus, createTask, updatePriority, deleteTask };
}
