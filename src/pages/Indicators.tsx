import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarCheck, CheckCircle2, DollarSign, FileText, Inbox, Target, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import type { Client, Lead } from '@/types/crm';
import type { FinancialTransaction } from '@/types/financial';
import { getMonthlyRevenue, getPendingFollowUps, readStoredDemands, type OSDemand } from '@/lib/fatureOS';

export default function Indicators() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [demands, setDemands] = useState<OSDemand[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: leadsData }, { data: clientsData }, { data: transactionsData }] = await Promise.all([
        supabase.from('leads').select('*'),
        supabase.from('clients').select('*'),
        supabase.from('financial_transactions').select('*'),
      ]);

      setLeads((leadsData || []) as Lead[]);
      setClients((clientsData || []) as Client[]);
      setTransactions((transactionsData || []) as FinancialTransaction[]);
      setDemands(readStoredDemands());
    };

    fetchData();
  }, []);

  const kpis = useMemo(() => {
    const proposals = leads.filter((lead) => ['proposta_enviada', 'em_negociacao', 'fechado', 'lead_perdido'].includes(lead.status)).length;
    const closed = leads.filter((lead) => lead.status === 'fechado').length;
    const meetings = leads.filter((lead) => ['reuniao_realizada', 'proposta_enviada', 'em_negociacao', 'fechado', 'lead_perdido'].includes(lead.status)).length;
    const conversion = leads.length > 0 ? (closed / leads.length) * 100 : 0;

    return [
      { title: 'Prospecções', value: leads.length, icon: Target, progress: Math.min((leads.length / 100) * 100, 100) },
      { title: 'Follow-ups pendentes', value: getPendingFollowUps(leads).length, icon: CalendarCheck, progress: Math.min((getPendingFollowUps(leads).length / 20) * 100, 100) },
      { title: 'Reuniões', value: meetings, icon: Users, progress: Math.min((meetings / 20) * 100, 100) },
      { title: 'Propostas', value: proposals, icon: FileText, progress: Math.min((proposals / 15) * 100, 100) },
      { title: 'Conversão', value: `${conversion.toFixed(1)}%`, icon: BarChart3, progress: conversion },
      { title: 'Clientes fechados', value: closed, icon: CheckCircle2, progress: Math.min((closed / 10) * 100, 100) },
      { title: 'Receita', value: `R$ ${getMonthlyRevenue(transactions).toLocaleString('pt-BR')}`, icon: DollarSign, progress: Math.min((getMonthlyRevenue(transactions) / 15000) * 100, 100) },
      { title: 'Demandas concluídas', value: demands.filter((demand) => demand.status === 'concluida').length, icon: Inbox, progress: Math.min((demands.filter((demand) => demand.status === 'concluida').length / 30) * 100, 100) },
    ];
  }, [clients.length, demands, leads, transactions]);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <p className="text-sm font-medium text-warning">KPIs operacionais</p>
        <h1 className="text-2xl font-bold">Indicadores</h1>
        <p className="text-muted-foreground">
          Visão executiva de comercial, receita, follow-ups e demandas concluídas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
                  <kpi.icon className="w-5 h-5" />
                </div>
                <CardTitle className="text-2xl">{kpi.value}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium">{kpi.title}</p>
              <Progress value={Number(kpi.progress)} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground">
          Próximas etapas preparadas: histórico semanal/mensal, tempo médio de atendimento, tempo médio por demanda e gráficos comparativos.
        </CardContent>
      </Card>
    </div>
  );
}
