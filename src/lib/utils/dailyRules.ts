import { addDays, addMonths, isAfter, isBefore, parseISO, startOfDay } from 'date-fns';

// Regras únicas de "o que precisa de atenção". Banner, Dashboard, Leads,
// resumo diário e painel de atividades usam estas funções para que os totais
// nunca divirjam entre telas.

// Janela de alerta: mantém o mesmo critério do alerta oficial por WhatsApp
// (edge function whatsapp-vencimento-alert).
export const CONTRACT_ALERT_WINDOW_DAYS = 30;
export const PAYMENT_ALERT_WINDOW_DAYS = 7;

type FollowUpLead = {
  status: string | null;
  follow_up_1: string | null;
  follow_up_2: string | null;
  follow_up_3: string | null;
};

type DueClient = {
  project_start_date: string | null;
  contract_duration_months: number | null;
  payment_due_date: string | null;
};

const dayKey = (date: Date) => startOfDay(date).getTime();

const followUpDates = (lead: FollowUpLead) =>
  [lead.follow_up_1, lead.follow_up_2, lead.follow_up_3].filter((d): d is string => Boolean(d));

// Lead fechado já virou cliente; perdido/sem interesse saiu do funil. Nenhum deles tem follow-up pendente.
const NO_FOLLOW_UP_STATUSES = ['fechado', 'lead_perdido', 'sem_interesse'];

export const isFollowUpEligible = (lead: FollowUpLead) => !NO_FOLLOW_UP_STATUSES.includes(lead.status || '');

export function hasFollowUpOn(lead: FollowUpLead, day: Date = new Date()): boolean {
  if (!isFollowUpEligible(lead)) return false;
  const target = dayKey(day);
  return followUpDates(lead).some((date) => dayKey(parseISO(date)) === target);
}

export const hasTodayFollowUp = (lead: FollowUpLead) => hasFollowUpOn(lead, new Date());

export function hasOverdueFollowUp(lead: FollowUpLead, today: Date = new Date()): boolean {
  if (!isFollowUpEligible(lead)) return false;
  if (lead.follow_up_1 && lead.follow_up_2 && lead.follow_up_3) return false;
  const todayKey = dayKey(today);
  return followUpDates(lead).some((date) => dayKey(parseISO(date)) < todayKey);
}

export function getContractEndDate(client: DueClient): Date | null {
  if (!client.project_start_date || !client.contract_duration_months) return null;
  return addMonths(new Date(client.project_start_date), client.contract_duration_months);
}

export function isContractExpiringSoon(client: DueClient, today: Date = new Date()): boolean {
  const endDate = getContractEndDate(client);
  if (!endDate) return false;
  return isAfter(endDate, today) && isBefore(endDate, addDays(today, CONTRACT_ALERT_WINDOW_DAYS));
}

export function isPaymentDueSoon(client: DueClient, today: Date = new Date()): boolean {
  if (!client.payment_due_date) return false;
  const dueDate = new Date(client.payment_due_date);
  return isAfter(dueDate, today) && isBefore(dueDate, addDays(today, PAYMENT_ALERT_WINDOW_DAYS));
}
