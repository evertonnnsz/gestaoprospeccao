import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarCheck, ClipboardList, Inbox, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import type { Client, Lead } from '@/types/crm';
import type { FinancialTransaction } from '@/types/financial';
import {
  getActiveDemands,
  getAssistantInsights,
  getCriticalDemands,
  getNextBestAction,
  getPendingFollowUps,
  readStoredDemands,
  type OSDemand,
} from '@/lib/fatureOS';

type ExecutionItem = {
  id: string;
  title: string;
  detail: string;
  area: string;
  priority: number;
  path: string;
  tone: 'critical' | 'warning' | 'default';
};

export default function ExecutionCenter() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [demands, setDemands] = useState<OSDemand[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: leadsData }, { data: clientsData }, { data: transactionsData }] = await Promise.all([
        supabase.from('leads').select('*'),
        supabase.from('clients').select('*, lead:leads(*)'),
        supabase.from('financial_transactions').select('*'),
      ]);

      setLeads((leadsData || []) as Lead[]);
      setClients((clientsData || []) as Client[]);
      setTransactions((transactionsData || []) as FinancialTransaction[]);
      setDemands(readStoredDemands());
    };

    fetchData();
  }, []);

  const context = { leads, clients, transactions, demands };
  const nextBestAction = getNextBestAction(context);
  const criticalDemands = getCriticalDemands(demands);
  const followUps = getPendingFollowUps(leads);
  const activeDemands = getActiveDemands(demands);
  const insights = getAssistantInsights(context);

  const queue = useMemo<ExecutionItem[]>(() => {
    const demandItems = activeDemands.map((demand) => ({
      id: demand.id,
      title: demand.title,
      detail: demand.aiSuggestion || demand.description,
      area: 'Demanda',
      priority: demand.priorityScore,
      path: '/central-demandas',
      tone: demand.priority === 'critica' ? ('critical' as const) : ('warning' as const),
    }));

    const followUpItems = followUps.map((lead) => ({
      id: lead.id,
      title: `Follow-up: ${lead.company_name}`,
      detail: lead.next_action || 'Retomar contato comercial.',
      area: 'Comercial',
      priority: 55,
      path: '/leads?filter=today',
      tone: 'warning' as const,
    }));

    const missionItems: ExecutionItem[] = [
      {
        id: 'mission-prospect',
        title: 'Prospectar novas empresas',
        detail: 'Missão recorrente para manter o funil crescendo.',
        area: 'Missão',
        priority: followUps.length > 0 || criticalDemands.length > 0 ? 35 : 65,
        path: '/prospecting',
        tone: 'default',
      },
      {
        id: 'mission-planning',
        title: 'Planejar o próximo dia',
        detail: 'O expediente não encerra sem uma direção para amanhã.',
        area: 'Missão',
        priority: 25,
        path: '/dashboard',
        tone: 'default',
      },
    ];

    return [...demandItems, ...followUpItems, ...missionItems].sort((a, b) => b.priority - a.priority);
  }, [activeDemands, criticalDemands.length, followUps]);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-warning">Prioridades acima de horários</p>
          <h1 className="text-2xl font-bold">Central de Execução</h1>
          <p className="text-muted-foreground">
            Uma fila única para missões, demandas críticas e follow-ups, sempre ordenada por impacto.
          </p>
        </div>
        <Button onClick={() => navigate(nextBestAction.path)} className="gap-2">
          <Play className="w-4 h-4" />
          {nextBestAction.title}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Metric title="Demandas críticas" value={criticalDemands.length} icon={AlertTriangle} tone="critical" />
        <Metric title="Follow-ups" value={followUps.length} icon={CalendarCheck} tone="warning" />
        <Metric title="Demandas ativas" value={activeDemands.length} icon={Inbox} tone="default" />
        <Metric title="Missões fixas" value={2} icon={ClipboardList} tone="default" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle>Fila recomendada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {queue.map((item, index) => (
              <div key={item.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center font-semibold">{index + 1}</div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{item.title}</p>
                      <Badge className={badgeClass(item.tone)}>{item.area}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate(item.path)}>
                  Executar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Reorganização automática</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {insights.slice(0, 4).map((insight) => (
              <div key={`${insight.title}-${insight.action}`} className="rounded-lg bg-muted/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{insight.title}</p>
                  <Badge variant="outline">{insight.level}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{insight.action}</p>
              </div>
            ))}
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-muted-foreground">
              Reuniões e demandas críticas sobem na fila. Missões recorrentes não desaparecem, apenas mudam de posição.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ title, value, icon: Icon, tone }: { title: string; value: number; icon: any; tone: 'critical' | 'warning' | 'default' }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tone === 'critical' ? 'bg-destructive/10 text-destructive' : tone === 'warning' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'}`}>
          <Icon className="w-5 h-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function badgeClass(tone: 'critical' | 'warning' | 'default') {
  if (tone === 'critical') return 'bg-destructive text-destructive-foreground';
  if (tone === 'warning') return 'bg-warning text-warning-foreground';
  return 'bg-primary text-primary-foreground';
}
