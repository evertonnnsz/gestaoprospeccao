export type TransactionType = 'income' | 'expense';

export type ExpenseCategory = 'marketing' | 'salarios' | 'aluguel' | 'ferramentas' | 'impostos' | 'outros';

export interface FinancialTransaction {
  id: string;
  user_id: string;
  type: TransactionType;
  category: ExpenseCategory;
  description: string;
  amount: number;
  transaction_date: string;
  client_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  marketing: 'Marketing',
  salarios: 'Salários',
  aluguel: 'Aluguel',
  ferramentas: 'Ferramentas',
  impostos: 'Impostos',
  outros: 'Outros',
};

export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  marketing: 'hsl(var(--chart-1))',
  salarios: 'hsl(var(--chart-2))',
  aluguel: 'hsl(var(--chart-3))',
  ferramentas: 'hsl(var(--chart-4))',
  impostos: 'hsl(var(--chart-5))',
  outros: 'hsl(var(--muted-foreground))',
};
