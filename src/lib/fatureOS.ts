import { isToday, parseISO } from 'date-fns';
import type { Client, Lead } from '@/types/crm';
import type { FinancialTransaction } from '@/types/financial';

export const DEMAND_STORAGE_KEY = 'fature-demand-center-v2';
export const MONTHLY_GOAL = 15000;

export type OSDemand = {
  id: string;
  title: string;
  description: string;
  type: string;
  clientName?: string;
  priority: 'critica' | 'alta' | 'media' | 'baixa';
  estimatedMinutes: number;
  deadline: string;
  impact: string;
  status: string;
  priorityScore: number;
  aiSuggestion?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type OSContext = {
  leads: Lead[];
  clients: Client[];
  transactions: FinancialTransaction[];
  demands: OSDemand[];
};

export function readStoredDemands(): OSDemand[] {
  try {
    const stored = localStorage.getItem(DEMAND_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function getMonthlyRevenue(transactions: FinancialTransaction[]) {
  const now = new Date();
  return transactions
    .filter((transaction) => transaction.type === 'income')
    .filter((transaction) => {
      const date = parseISO(transaction.transaction_date);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    })
    .reduce((total, transaction) => total + Number(transaction.amount), 0);
}

export function getRecurringRevenue(clients: Client[]) {
  return clients
    .filter((client) => client.status === 'active')
    .reduce((total, client) => total + Number(client.project_value || 0), 0);
}

export function getTodayMeetings(leads: Lead[]) {
  return leads.filter((lead) => lead.status === 'agendou_reuniao' || lead.status === 'reuniao_realizada');
}

export function getPendingFollowUps(leads: Lead[]) {
  return leads.filter((lead) => {
    if (lead.status === 'lead_perdido' || lead.status === 'sem_interesse' || lead.status === 'fechado') return false;
    const followUps = [lead.follow_up_1, lead.follow_up_2, lead.follow_up_3].filter(Boolean);
    return followUps.some((date) => {
      try {
        return date ? isToday(parseISO(date)) : false;
      } catch {
        return false;
      }
    });
  });
}

export function getActiveDemands(demands: OSDemand[]) {
  return demands.filter((demand) => !['concluida', 'cancelada', 'arquivada'].includes(demand.status));
}

export function getCriticalDemands(demands: OSDemand[]) {
  return getActiveDemands(demands)
    .filter((demand) => demand.priority === 'critica' || demand.priorityScore >= 65)
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

export function getNextBestAction(context: OSContext) {
  const criticalDemand = getCriticalDemands(context.demands)[0];
  if (criticalDemand) {
    return {
      title: criticalDemand.title,
      reason: criticalDemand.aiSuggestion || 'Demanda critica com maior impacto operacional agora.',
      area: 'Central de Demandas',
      path: '/central-demandas',
    };
  }

  const todayFollowUps = getPendingFollowUps(context.leads);
  if (todayFollowUps.length > 0) {
    return {
      title: `Realizar ${todayFollowUps.length} follow-up${todayFollowUps.length > 1 ? 's' : ''}`,
      reason: 'Follow-ups pendentes seguram conversao e receita prevista.',
      area: 'Comercial',
      path: '/leads?filter=today',
    };
  }

  const openProposals = context.leads.filter((lead) => lead.status === 'proposta_enviada' || lead.status === 'em_negociacao');
  if (openProposals.length > 0) {
    return {
      title: 'Avancar propostas abertas',
      reason: 'Existe dinheiro mais proximo do fechamento no funil.',
      area: 'Comercial',
      path: '/leads',
    };
  }

  return {
    title: 'Prospectar novas empresas',
    reason: 'Sem urgencias ativas, o melhor movimento e alimentar o funil.',
    area: 'Prospecção',
    path: '/prospecting',
  };
}

export function getExecutionScore(context: OSContext) {
  const completedDemands = context.demands.filter((demand) => demand.status === 'concluida').length;
  const followUpsDone = getPendingFollowUps(context.leads).length === 0;
  const hasProspecting = context.leads.some((lead) => {
    try {
      return isToday(parseISO(lead.created_at || lead.approach_date));
    } catch {
      return false;
    }
  });
  const hasMeetings = getTodayMeetings(context.leads).length > 0;
  const crmUpdated = context.leads.some((lead) => {
    try {
      return isToday(parseISO(lead.updated_at));
    } catch {
      return false;
    }
  });

  return Math.min(
    100,
    10 +
      (hasProspecting ? 20 : 0) +
      (followUpsDone ? 15 : 0) +
      (hasMeetings ? 15 : 0) +
      (completedDemands > 0 ? 20 : 0) +
      (crmUpdated ? 10 : 0) +
      10,
  );
}

export function getRecommendedMode(context: OSContext) {
  if (getCriticalDemands(context.demands).length > 0) return 'Emergência';
  if (getTodayMeetings(context.leads).length > 0) return 'Reunião';
  if (getPendingFollowUps(context.leads).length === 0 && context.leads.length < 20) return 'Campo';
  return 'Fluxo';
}

export function getAssistantInsights(context: OSContext) {
  const revenue = getMonthlyRevenue(context.transactions);
  const remaining = Math.max(MONTHLY_GOAL - revenue, 0);
  const followUps = getPendingFollowUps(context.leads);
  const critical = getCriticalDemands(context.demands);
  const activeClients = context.clients.filter((client) => client.status === 'active');
  const nextAction = getNextBestAction(context);
  const insights = [];

  if (remaining > 0) {
    insights.push({
      level: remaining > MONTHLY_GOAL * 0.5 ? 'Atenção' : 'Informação',
      title: 'Meta mensal em andamento',
      message: `Faltam R$ ${remaining.toLocaleString('pt-BR')} para atingir a meta de R$ ${MONTHLY_GOAL.toLocaleString('pt-BR')}.`,
      action: nextAction.title,
    });
  }

  if (followUps.length > 0) {
    insights.push({
      level: 'Crítico',
      title: 'Follow-ups pendentes',
      message: `Existem ${followUps.length} follow-up${followUps.length > 1 ? 's' : ''} para proteger oportunidades comerciais.`,
      action: 'Abrir Comercial e concluir follow-ups',
    });
  }

  if (critical.length > 0) {
    insights.push({
      level: 'Crítico',
      title: 'Demandas críticas ativas',
      message: `${critical.length} demanda${critical.length > 1 ? 's' : ''} pode reorganizar o dia.`,
      action: critical[0].title,
    });
  }

  if (activeClients.length > 0 && critical.length === 0) {
    insights.push({
      level: 'Informação',
      title: 'Clientes ativos monitorados',
      message: `${activeClients.length} cliente${activeClients.length > 1 ? 's' : ''} ativo${activeClients.length > 1 ? 's' : ''} podem gerar demandas operacionais.`,
      action: 'Revisar painel operacional',
    });
  }

  insights.push({
    level: 'Atenção',
    title: 'Próxima melhor ação',
    message: nextAction.reason,
    action: nextAction.title,
  });

  return insights;
}
