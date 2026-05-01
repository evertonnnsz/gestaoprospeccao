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
import { getPeriodRange, filterByRange } from '@/lib/utils/periodRange';

import { PeriodFilter, PeriodType, DateRange } from '@/components/filters/PeriodFilter';
import { Loader2 } from 'lucide-react';
import { format, subMonths, parseISO, eachDayOfInterval, eachMonthOfInterval, differenceInDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
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

  const periodRange = useMemo(() => getPeriodRange(period, dateRange), [period, dateRange]);

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

      // Fetch all leads for gamified panel metrics
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*');
      if (leadsError) throw leadsError;

      // Fetch profile for company name
      const { data: profileData } = await supabase
        .from('profiles')
        .select('company_name')
        .eq('id', user.id)
        .maybeSingle();

      setTransactions((transactionsData || []) as FinancialTransaction[]);
      setClients((clientsData || []) as Client[]);
      setLeads((leadsData || []) as Lead[]);
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

  // Filter transactions by period (uses transaction_date)
  const filteredTransactions = useMemo(
    () => filterByRange(transactions, periodRange, (t) => t.transaction_date),
    [transactions, periodRange],
  );

  // Filter clients by project_start_date (with fallback to created_at)
  const filteredClients = useMemo(
    () => filterByRange(clients, periodRange, (c) => c.project_start_date || c.created_at),
    [clients, periodRange],
  );

  // Filter leads by approach_date (with fallback to created_at)
  const filteredLeads = useMemo(
    () => filterByRange(leads, periodRange, (l) => l.approach_date || l.created_at),
    [leads, periodRange],
  );

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

  // Calculate clients revenue split by payment status (filtered)
  const clientsRevenueBreakdown = useMemo(() => splitClientsRevenue(filteredClients), [filteredClients]);

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

  // Calculate chart data for the selected period
  const monthlyData = useMemo(() => {
    const now = new Date();
    let rangeStart: Date;
    let rangeEnd: Date;
    let granularity: 'day' | 'month';

    if (period === 'all') {
      rangeEnd = now;
      rangeStart = subMonths(now, 5);
      granularity = 'month';
    } else if (period === 'today' || period === 'week') {
      rangeStart = periodRange.start ?? now;
      rangeEnd = periodRange.end ?? now;
      granularity = 'day';
    } else if (period === 'month') {
      rangeStart = startOfMonth(now);
      rangeEnd = endOfMonth(now);
      granularity = 'day';
    } else if (period === 'year') {
      rangeStart = startOfYear(now);
      rangeEnd = endOfYear(now);
      granularity = 'month';
    } else {
      // custom
      rangeStart = periodRange.start ?? subMonths(now, 1);
      rangeEnd = periodRange.end ?? now;
      granularity = differenceInDays(rangeEnd, rangeStart) <= 60 ? 'day' : 'month';
    }

    const fmtKey = granularity === 'day' ? 'dd/MM' : 'MMM/yy';
    const buckets: Record<string, { income: number; expenses: number; order: number }> = {};

    const points =
      granularity === 'day'
        ? eachDayOfInterval({ start: rangeStart, end: rangeEnd })
        : eachMonthOfInterval({ start: rangeStart, end: rangeEnd });

    points.forEach((d, i) => {
      const key = format(d, fmtKey, { locale: ptBR });
      buckets[key] = { income: 0, expenses: 0, order: i };
    });

    const accumulate = (dateStr: string, type: 'income' | 'expenses', amount: number) => {
      const d = dateStr.length === 10 ? new Date(dateStr + 'T00:00:00') : parseISO(dateStr);
      if (isNaN(d.getTime())) return;
      if (d < rangeStart || d > rangeEnd) return;
      const key = format(d, fmtKey, { locale: ptBR });
      if (!buckets[key]) return;
      buckets[key][type] += amount;
    };

    transactions.forEach((t) => {
      accumulate(t.transaction_date, t.type === 'income' ? 'income' : 'expenses', Number(t.amount));
    });

    // Include paid client revenue in the chart income
    clients
      .filter((c) => c.monthly_payment_status === 'paid')
      .forEach((c) => {
        const baseDate = c.project_start_date || c.created_at;
        if (baseDate) accumulate(baseDate, 'income', Number(c.project_value) || 0);
      });

    return Object.entries(buckets)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([month, data]) => ({ month, income: data.income, expenses: data.expenses }));
  }, [transactions, clients, period, periodRange]);


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
      <GamifiedPanel leads={filteredLeads} clients={filteredClients} companyName={companyName} />

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
