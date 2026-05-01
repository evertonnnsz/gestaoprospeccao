import { Client } from '@/types/crm';

export interface ClientsRevenueBreakdown {
  total: number;
  received: number;
  receivable: number;
  totalCount: number;
  paidCount: number;
  receivableCount: number;
}

const sumValue = (list: Client[]) =>
  list.reduce((acc, c) => acc + (Number(c.project_value) || 0), 0);

export function splitClientsRevenue(clients: Client[]): ClientsRevenueBreakdown {
  // Apenas clientes ativos entram no faturamento. Pausados/Churn não.
  const activeClients = clients.filter((c) => (c.status ?? 'active') === 'active');
  const paid = activeClients.filter((c) => c.monthly_payment_status === 'paid');
  const pending = activeClients.filter(
    (c) => c.monthly_payment_status === 'pending' || c.monthly_payment_status === 'overdue',
  );
  return {
    total: sumValue(activeClients),
    received: sumValue(paid),
    receivable: sumValue(pending),
    totalCount: activeClients.length,
    paidCount: paid.length,
    receivableCount: pending.length,
  };
}

export interface ChurnRateBreakdown {
  rate: number;
  churned: number;
  total: number;
}

export function calculateChurnRate(clients: Client[]): ChurnRateBreakdown {
  const total = clients.length;
  const churned = clients.filter((c) => c.status === 'churn').length;
  return {
    rate: total > 0 ? (churned / total) * 100 : 0,
    churned,
    total,
  };
}