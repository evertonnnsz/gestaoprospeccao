import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Bell, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import type { Client, Lead } from '@/types/crm';
import type { FinancialTransaction } from '@/types/financial';
import { getAssistantInsights, getNextBestAction, readStoredDemands, type OSDemand } from '@/lib/fatureOS';
import { fetchAllLeads } from '@/lib/utils/fetchAllLeads';

export default function AIAssistant() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [demands, setDemands] = useState<OSDemand[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [leadsData, { data: clientsData }, { data: transactionsData }] = await Promise.all([
        fetchAllLeads(),
        supabase.from('clients').select('*, lead:leads(*)'),
        supabase.from('financial_transactions').select('*'),
      ]);

      setLeads(leadsData);
      setClients((clientsData || []) as Client[]);
      setTransactions((transactionsData || []) as FinancialTransaction[]);
      setDemands(readStoredDemands());
    };

    fetchData();
  }, []);

  const context = { leads, clients, transactions, demands };
  const insights = getAssistantInsights(context);
  const nextBestAction = getNextBestAction(context);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-warning">Assistente operacional</p>
          <h1 className="text-2xl font-bold">IA Assistente</h1>
          <p className="text-muted-foreground">
            Alertas e recomendações baseados nos dados reais do CRM, demandas e financeiro.
          </p>
        </div>
        <Button onClick={() => navigate(nextBestAction.path)} className="gap-2">
          <Sparkles className="w-4 h-4" />
          {nextBestAction.title}
        </Button>
      </div>

      <Card className="border-primary/20 shadow-sm">
        <CardContent className="p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <Brain className="w-5 h-5 text-primary" />
              Próxima melhor ação
            </div>
            <p className="text-sm text-muted-foreground">{nextBestAction.reason}</p>
          </div>
          <Badge className="w-fit bg-warning text-warning-foreground">{nextBestAction.area}</Badge>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {insights.map((insight) => (
          <Card key={`${insight.title}-${insight.action}`} className="shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  {insight.level === 'Crítico' ? <Bell className="w-5 h-5" /> : insight.level === 'Atenção' ? <Clock className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                </div>
                <Badge variant={insight.level === 'Crítico' ? 'destructive' : 'outline'}>{insight.level}</Badge>
              </div>
              <CardTitle className="text-lg">{insight.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{insight.message}</p>
              <div className="rounded-lg bg-muted/60 p-3 text-sm">
                <span className="font-medium">Ação sugerida: </span>
                {insight.action}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
