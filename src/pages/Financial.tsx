import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Download, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FinancialTransaction, ExpenseCategory } from '@/types/financial';
import { Client, Lead } from '@/types/crm';
import { FinancialSummaryCards } from '@/components/financial/FinancialSummaryCards';
import { ExpensesByCategoryChart } from '@/components/financial/ExpensesByCategoryChart';
import { IncomeVsExpensesChart } from '@/components/financial/IncomeVsExpensesChart';
import { TransactionsTable } from '@/components/financial/TransactionsTable';
import { TransactionForm } from '@/components/financial/TransactionForm';
import { GamifiedPanel } from '@/components/financial/gamified/GamifiedPanel';
import { splitClientsRevenue } from '@/lib/utils/clientRevenue';
import { fetchAllLeads } from '@/lib/utils/fetchAllLeads';

import { PeriodFilter, PeriodType, DateRange, filterByPeriod } from '@/components/filters/PeriodFilter';
import { Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Financial() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | null>(null);
  const [period, setPeriod] = useState<PeriodType>('month');
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('financial_transactions')
        .select('*')
        .order('transaction_date', { ascending: false });

      if (transactionsError) throw transactionsError;

      // Fetch clients with leads
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*, lead:leads(*)');

      if (clientsError) throw clientsError;

      // Fetch all leads for gamified panel metrics, including records beyond Supabase's 1000-row default.
      const leadsData = await fetchAllLeads();

      // Fetch profile for company name
      const { data: profileData } = await supabase
        .from('profiles')
        .select('company_name')
        .eq('id', user.id)
        .maybeSingle();

      setTransactions((transactionsData || []) as FinancialTransaction[]);
      setClients((clientsData || []) as Client[]);
      setLeads(leadsData);
      setCompanyName(profileData?.company_name ?? null);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Filter transactions by period
  const filteredTransactions = useMemo(() => {
    return filterByPeriod(
      transactions.map(t => ({ ...t, approach_date: t.transaction_date })),
      period,
      dateRange
    ).map(t => {
      const { approach_date, ...rest } = t as any;
      return rest as FinancialTransaction;
    });
  }, [transactions, period, dateRange]);

  // Calculate totals
  const totals = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return { income, expenses };
  }, [filteredTransactions]);

  // Calculate clients revenue split by payment status
  const clientsRevenueBreakdown = useMemo(() => splitClientsRevenue(clients), [clients]);

  // Calculate expenses by category
  const expensesByCategory = useMemo(() => {
    const categories: Record<ExpenseCategory, number> = {
      marketing: 0,
      salarios: 0,
      aluguel: 0,
      ferramentas: 0,
      impostos: 0,
      outros: 0,
    };

    filteredTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        categories[t.category] += Number(t.amount);
      });

    return categories;
  }, [filteredTransactions]);

  // Calculate monthly data for chart
  const monthlyData = useMemo(() => {
    const months: Record<string, { income: number; expenses: number }> = {};
    const now = new Date();

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(now, i);
      const key = format(date, 'MMM/yy', { locale: ptBR });
      months[key] = { income: 0, expenses: 0 };
    }

    // Fill with data
    transactions.forEach(t => {
      const date = parseISO(t.transaction_date);
      const key = format(date, 'MMM/yy', { locale: ptBR });
      if (months[key]) {
        if (t.type === 'income') {
          months[key].income += Number(t.amount);
        } else {
          months[key].expenses += Number(t.amount);
        }
      }
    });

    return Object.entries(months).map(([month, data]) => ({
      month,
      ...data,
    }));
  }, [transactions]);


  const handleEdit = (transaction: FinancialTransaction) => {
    setEditingTransaction(transaction);
    setFormOpen(true);
  };

  const handleNewTransaction = () => {
    setEditingTransaction(null);
    setFormOpen(true);
  };

  const exportToCSV = () => {
    const headers = ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor'];
    const rows = filteredTransactions.map(t => [
      format(parseISO(t.transaction_date), 'dd/MM/yyyy'),
      t.type === 'income' ? 'Receita' : 'Despesa',
      t.category,
      t.description,
      t.amount.toString().replace('.', ','),
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.join(';'))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `financeiro_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="w-6 h-6" />
            Financeiro
          </h1>
          <p className="text-muted-foreground">
            Gerencie suas receitas, despesas e projeções
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <PeriodFilter
            value={period}
            onChange={setPeriod}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button onClick={handleNewTransaction}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Transação
          </Button>
        </div>
      </div>

      {/* Central de Prospecção Gamificada */}
      <GamifiedPanel leads={leads} clients={clients} companyName={companyName} />

      {/* Summary Cards */}
      <FinancialSummaryCards
        totalIncome={totals.income}
        totalExpenses={totals.expenses}
        clientsRevenue={clientsRevenueBreakdown.received}
        clientsReceivable={clientsRevenueBreakdown.receivable}
      />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IncomeVsExpensesChart data={monthlyData} />
        <ExpensesByCategoryChart data={expensesByCategory} />
      </div>

      {/* Transactions */}
      <TransactionsTable
        transactions={filteredTransactions}
        onEdit={handleEdit}
        onRefresh={fetchData}
      />

      {/* Transaction Form */}
      <TransactionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        transaction={editingTransaction}
        onSuccess={fetchData}
      />
    </div>
  );
}
