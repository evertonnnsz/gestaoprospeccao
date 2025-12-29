import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Calendar, AlertCircle } from 'lucide-react';
import { Client } from '@/types/crm';
import { addMonths, isBefore, isAfter, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProjectionsCardProps {
  clients: Client[];
  monthlyExpensesAvg: number;
}

export function ProjectionsCard({ clients, monthlyExpensesAvg }: ProjectionsCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Calculate active clients and their monthly revenue
  const today = new Date();
  const activeClients = clients.filter(client => {
    if (!client.project_start_date || !client.contract_duration_months) return false;
    const endDate = addMonths(new Date(client.project_start_date), client.contract_duration_months);
    return isAfter(endDate, today);
  });

  const totalMonthlyRevenue = activeClients.reduce((sum, client) => {
    const monthlyValue = (client.project_value || 0) / (client.contract_duration_months || 1);
    return sum + monthlyValue;
  }, 0);

  // Calculate projected revenue for next 3 months
  const projectedRevenue3Months = totalMonthlyRevenue * 3;

  // Calculate contracts expiring soon (next 3 months)
  const threeMonthsFromNow = addMonths(today, 3);
  const expiringContracts = activeClients.filter(client => {
    const endDate = addMonths(new Date(client.project_start_date!), client.contract_duration_months!);
    return isBefore(endDate, threeMonthsFromNow);
  });

  const expiringRevenue = expiringContracts.reduce((sum, client) => {
    return sum + (client.project_value || 0) / (client.contract_duration_months || 1);
  }, 0);

  // Projected balance
  const projectedBalance = projectedRevenue3Months - (monthlyExpensesAvg * 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Projeções (3 meses)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Receita Projetada</p>
            <p className="text-xl font-bold text-emerald-600">
              {formatCurrency(projectedRevenue3Months)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Despesas Estimadas</p>
            <p className="text-xl font-bold text-destructive">
              {formatCurrency(monthlyExpensesAvg * 3)}
            </p>
          </div>
        </div>

        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Saldo Projetado</span>
            <span className={`text-lg font-bold ${projectedBalance >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
              {formatCurrency(projectedBalance)}
            </span>
          </div>
        </div>

        {expiringContracts.length > 0 && (
          <div className="pt-4 border-t">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 text-warning">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">
                  {expiringContracts.length} contrato(s) expirando
                </p>
                <p className="text-xs mt-1">
                  Receita mensal em risco: {formatCurrency(expiringRevenue)}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Clientes ativos: {activeClients.length}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
