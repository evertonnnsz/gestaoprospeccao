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
  const paid = clients.filter((c) => c.monthly_payment_status === 'paid');
  const pending = clients.filter(
    (c) => c.monthly_payment_status === 'pending' || c.monthly_payment_status === 'overdue',
  );
  return {
    total: sumValue(clients),
    received: sumValue(paid),
    receivable: sumValue(pending),
    totalCount: clients.length,
    paidCount: paid.length,
    receivableCount: pending.length,
  };
}