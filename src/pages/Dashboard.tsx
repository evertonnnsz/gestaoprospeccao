import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Client, Lead, LeadStatus, STATUS_LABELS, STATUS_ORDER, LEAD_SOURCES } from '@/types/crm';
import { calculateChurnRate, splitClientsRevenue } from '@/lib/utils/clientRevenue';
import { fetchAllLeads, fetchLeadCount } from '@/lib/utils/fetchAllLeads';
import {
  getAssistantInsights,
  getExecutionScore,
  getMonthlyRevenue,
  getNextBestAction,
  getPendingFollowUps,
  getRecommendedMode,
  getTodayMeetings,
  readMonthlyGoal,
  readStoredDemands,
  saveMonthlyGoal,
  type OSDemand,
} from '@/lib/fatureOS';
import { FinancialTransaction } from '@/types/financial';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PeriodFilter, PeriodType, DateRange, filterByPeriod } from '@/components/filters/PeriodFilter';
import {
  Users,
  Target,
  Calendar,
  TrendingUp,
  MessageCircle,
  CalendarCheck,
  Trophy,
  X,
  FileText,
  UserMinus,
  Brain,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Dumbbell,
  Gauge,
  Inbox,
  Play,
  Pencil,
} from 'lucide-react';
import { parseISO, startOfDay, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const isSameDay = (dateStr: string): boolean => {
  const date = parseISO(dateStr);
  const today = startOfDay(new Date());
  return startOfDay(date).getTime() === today.getTime();
};

const SOURCE_COLORS: Record<string, string> = {
  'Tráfego': 'hsl(217, 91%, 60%)',
  'WhatsApp': 'hsl(142, 76%, 36%)',
  'Instagram': 'hsl(322, 75%, 55%)',
  'PaP': 'hsl(38, 92%, 50%)',
  'Cold Call': 'hsl(280, 65%, 60%)',
};

const MEETING_STATUSES: LeadStatus[] = [
  'reuniao_realizada',
  'proposta_enviada',
  'em_negociacao',
  'fechado',
  'lead_perdido',
];

// Cumulativo: todo lead que passou pela etapa de proposta (mantém paridade com o Funil)
const PROPOSAL_OR_BEYOND: LeadStatus[] = [
  'proposta_enviada',
  'em_negociacao',
  'fechado',
  'lead_perdido',
];

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [demands, setDemands] = useState<OSDemand[]>([]);
  const [briefingOpen, setBriefingOpen] = useState(() => sessionStorage.getItem('fature-briefing-seen') !== 'yes');
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [monthlyGoal, setMonthlyGoal] = useState(readMonthlyGoal);
  const [goalInput, setGoalInput] = useState(() => readMonthlyGoal().toLocaleString('pt-BR'));
  const [leadCount, setLeadCount] = useState(0);
  const [, setLoading] = useState(true);

  // Filters
  const [period, setPeriod] = useState<PeriodType>('all');
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const [respondedFilter, setRespondedFilter] = useState<string>('all');

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const [allLeads, exactLeadCount] = await Promise.all([
          fetchAllLeads(),
          fetchLeadCount(),
        ]);
        setLeads(allLeads);
        setLeadCount(exactLeadCount);
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('*');
        if (clientsError) throw clientsError;
        setClients(((clientsData as unknown) as Client[]) || []);
        const { data: transactionsData, error: transactionsError } = await supabase
          .from('financial_transactions')
          .select('*');
        if (transactionsError) throw transactionsError;
        setTransactions((transactionsData as FinancialTransaction[]) || []);
        setDemands(readStoredDemands());
      } catch (error) {
        console.error('Error fetching leads:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLeads();
  }, []);

  // Available segments for filter dropdown
  const segmentOptions = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.segment && l.segment.trim()) set.add(l.segment.trim());
    });
    return Array.from(set).sort();
  }, [leads]);

  // Apply all filters
  const filteredLeads = useMemo(() => {
    let result = filterByPeriod(leads, period, dateRange);

    if (sourceFilter !== 'all') {
      if (sourceFilter === 'WhatsApp') {
        // Leads sem origem ou com origem fora do padrão são tratados como WhatsApp
        result = result.filter(
          (l) =>
            l.lead_source === 'WhatsApp' ||
            !l.lead_source ||
            !LEAD_SOURCES.includes(l.lead_source as any)
        );
      } else {
        result = result.filter((l) => l.lead_source === sourceFilter);
      }
    }

    if (statusFilter !== 'all') {
      result = result.filter((l) => l.status === statusFilter);
    }

    if (segmentFilter !== 'all') {
      result = result.filter((l) => l.segment === segmentFilter);
    }

    if (respondedFilter !== 'all') {
      const want = respondedFilter === 'yes';
      result = result.filter((l) => Boolean(l.responded) === want);
    }

    return result;
  }, [leads, period, dateRange, sourceFilter, statusFilter, segmentFilter, respondedFilter]);

  const hasActiveFilters =
    sourceFilter !== 'all' ||
    statusFilter !== 'all' ||
    segmentFilter !== 'all' ||
    respondedFilter !== 'all' ||
    period !== 'all';

  const clearFilters = () => {
    setPeriod('all');
    setDateRange({ from: undefined, to: undefined });
    setSourceFilter('all');
    setStatusFilter('all');
    setSegmentFilter('all');
    setRespondedFilter('all');
  };

  // KPIs
  const totalLeads = hasActiveFilters ? filteredLeads.length : Math.max(leadCount, filteredLeads.length);
  const closedLeads = filteredLeads.filter((l) => l.status === 'fechado').length;
  const meetingsHeld = filteredLeads.filter((l) => MEETING_STATUSES.includes(l.status as LeadStatus)).length;
  const respondedLeads = filteredLeads.filter((l) => l.responded === true).length;
  const proposalsSent = filteredLeads.filter((l) =>
    PROPOSAL_OR_BEYOND.includes(l.status as LeadStatus)
  ).length;

  const todayFollowUps = leads.filter((lead) => {
    if (lead.status === 'lead_perdido' || lead.status === 'sem_interesse') return false;
    const followUps = [lead.follow_up_1, lead.follow_up_2, lead.follow_up_3].filter(Boolean);
    return followUps.some((date) => date && isSameDay(date));
  }).length;

  const closeRate = totalLeads > 0 ? (closedLeads / totalLeads) * 100 : 0;
  const meetingRate = totalLeads > 0 ? (meetingsHeld / totalLeads) * 100 : 0;
  const responseRate = totalLeads > 0 ? (respondedLeads / totalLeads) * 100 : 0;
  const churn = calculateChurnRate(clients);
  const osContext = { leads, clients, transactions, demands };
  const transactionRevenue = getMonthlyRevenue(transactions);
  const clientsRevenue = splitClientsRevenue(clients);
  const monthlyRevenue = clientsRevenue.total;
  const receivedRevenue = Math.max(clientsRevenue.received, transactionRevenue);
  const revenueRemaining = Math.max(monthlyGoal - monthlyRevenue, 0);
  const revenueProgress = monthlyGoal > 0 ? Math.min((monthlyRevenue / monthlyGoal) * 100, 100) : 0;
  const executionScore = getExecutionScore(osContext);
  const pendingFollowUps = getPendingFollowUps(leads);
  const nextBestAction = getNextBestAction(osContext);
  const recommendedMode = getRecommendedMode(osContext);
  const assistantInsights = getAssistantInsights(osContext);

  const saveGoal = () => {
    const parsed = Number(goalInput.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setMonthlyGoal(parsed);
    saveMonthlyGoal(parsed);
    setGoalInput(parsed.toLocaleString('pt-BR'));
    setGoalDialogOpen(false);
  };

  // Sources chart data
  const sourcesData = useMemo(() => {
    const counts: Record<string, number> = {};
    LEAD_SOURCES.forEach((s) => (counts[s] = 0));
    filteredLeads.forEach((l) => {
      const src = l.lead_source;
      if (src && LEAD_SOURCES.includes(src as any)) {
        counts[src] += 1;
      } else {
        // Leads sem origem ou com origem não padronizada são contabilizados como WhatsApp
        counts['WhatsApp'] += 1;
      }
    });
    return LEAD_SOURCES.map((s) => ({ name: s, value: counts[s] }));
  }, [filteredLeads]);

  return (
    <div className="p-6 space-y-6">
      {briefingOpen && (
        <Card className="border-warning/30 bg-gradient-to-br from-sidebar to-sidebar-accent text-sidebar-foreground shadow-lg">
          <CardContent className="p-6 space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-medium text-warning">Briefing do Dia</p>
                <h2 className="text-2xl font-bold">Antes de começar, esta é a leitura da operação.</h2>
                <p className="text-sidebar-foreground/70">
                  Prioridades acima de horários. O sistema aponta a melhor ação para mover faturamento e operação.
                </p>
              </div>
              <Button
                className="bg-warning text-warning-foreground hover:bg-warning/90"
                onClick={() => {
                  sessionStorage.setItem('fature-briefing-seen', 'yes');
                  setBriefingOpen(false);
                }}
              >
                Iniciar meu dia
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <BriefingItem label="Meta mensal" value={`R$ ${monthlyGoal.toLocaleString('pt-BR')}`} />
              <BriefingItem label="Faturamento previsto" value={`R$ ${monthlyRevenue.toLocaleString('pt-BR')}`} />
              <BriefingItem label="Faltam" value={`R$ ${revenueRemaining.toLocaleString('pt-BR')}`} />
              <BriefingItem label="Modo recomendado" value={recommendedMode} />
              <BriefingItem label="Reuniões do dia" value={String(getTodayMeetings(leads).length)} />
              <BriefingItem label="Follow-ups pendentes" value={String(pendingFollowUps.length)} />
              <BriefingItem label="Missão principal" value={pendingFollowUps.length > 0 ? 'Follow-up comercial' : 'Gerar oportunidades'} />
              <BriefingItem label="Próxima melhor ação" value={nextBestAction.title} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            Olá, {profile?.full_name?.split(' ')[0] || 'Usuário'}!
          </h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <PeriodFilter
          value={period}
          onChange={setPeriod}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 border-warning/30 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-warning" />
              Radar de Faturamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Progresso da meta mensal</p>
                <p className="text-3xl font-bold">{revenueProgress.toFixed(0)}%</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Meta atual</p>
                <div className="flex items-center justify-end gap-2">
                  <p className="text-xl font-semibold">R$ {monthlyGoal.toLocaleString('pt-BR')}</p>
                  <Button variant="outline" size="sm" onClick={() => setGoalDialogOpen(true)} className="gap-1">
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </Button>
                </div>
              </div>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-warning transition-all" style={{ width: `${revenueProgress}%` }} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              <MiniMetric label="Previsto recorrente" value={`R$ ${monthlyRevenue.toLocaleString('pt-BR')}`} />
              <MiniMetric label="Recebido" value={`R$ ${receivedRevenue.toLocaleString('pt-BR')}`} />
              <MiniMetric label="A receber" value={`R$ ${clientsRevenue.receivable.toLocaleString('pt-BR')}`} />
              <MiniMetric label="Faltam" value={`R$ ${revenueRemaining.toLocaleString('pt-BR')}`} />
              <MiniMetric label="Clientes ativos" value={String(clientsRevenue.totalCount)} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-primary" />
              Score de Execução
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-5xl font-bold">{executionScore}</span>
              <span className="text-muted-foreground">/100</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${executionScore}%` }} />
            </div>
            <p className="text-sm text-muted-foreground">
              Calculado por prospecção, follow-ups, reuniões, demandas concluídas, CRM e planejamento.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        <OSCard icon={ClipboardList} title="Missão do Dia" text={pendingFollowUps.length > 0 ? 'Concluir follow-ups pendentes' : 'Criar novas oportunidades comerciais'} />
        <OSCard icon={CalendarCheck} title="Agenda Inteligente" text={getTodayMeetings(leads).length > 0 ? 'Reuniões comerciais dominam a prioridade' : 'Dia livre para execução por impacto'} />
        <OSCard icon={Inbox} title="Operacional" text={`${demands.filter((demand) => !['concluida', 'cancelada', 'arquivada'].includes(demand.status)).length} demandas ativas`} />
        <OSCard icon={Dumbbell} title="Academia" text="Registrar treino mantém o score do dia completo" />
      </div>

      <Card className="border-primary/20 shadow-sm">
        <CardContent className="p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <Brain className="w-5 h-5 text-primary" />
              IA Assistente
            </div>
            <p className="text-sm text-muted-foreground">{assistantInsights[0]?.message}</p>
          </div>
          <Button onClick={() => navigate(nextBestAction.path)} className="gap-2">
            <Play className="w-4 h-4" />
            {nextBestAction.title}
          </Button>
        </CardContent>
      </Card>

      {/* Smart Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[160px] space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Origem</label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as origens</SelectItem>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[160px] space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[160px] space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Segmento</label>
              <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os segmentos</SelectItem>
                  {segmentOptions.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[160px] space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Respondeu?</label>
              <Select value={respondedFilter} onValueChange={setRespondedFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="yes">Sim</SelectItem>
                  <SelectItem value="no">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                <X className="w-4 h-4" />
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total de Leads" value={totalLeads} icon={Users} variant="primary" />
        <StatsCard title="Reuniões Realizadas" value={meetingsHeld} icon={Calendar} variant="success" onClick={meetingsHeld > 0 ? () => navigate('/leads?status=reuniao_realizada') : undefined} />
        <StatsCard title="Propostas Enviadas" value={proposalsSent} icon={FileText} variant="default" onClick={proposalsSent > 0 ? () => navigate('/leads?status=proposta_enviada') : undefined} />
        <StatsCard
          title="Follow-ups do Dia"
          value={todayFollowUps}
          icon={Calendar}
          variant={todayFollowUps > 0 ? 'warning' : 'default'}
          onClick={todayFollowUps > 0 ? () => navigate('/leads?filter=today') : undefined}
        />
      </div>

      {/* Sources chart + Conversion rates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Origem dos Leads */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Origem dos Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalLeads > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={sourcesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {sourcesData.map((entry) => (
                      <Cell key={entry.name} fill={SOURCE_COLORS[entry.name] || 'hsl(var(--primary))'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                Nenhum lead no período/filtro selecionado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Taxas de Conversão */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Taxas de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RateRow
              icon={MessageCircle}
              label="Taxa de Resposta"
              rate={responseRate}
              count={respondedLeads}
              total={totalLeads}
              color="text-success"
              barColor="bg-success"
            />
            <RateRow
              icon={CalendarCheck}
              label="Taxa de Reuniões"
              rate={meetingRate}
              count={meetingsHeld}
              total={totalLeads}
              color="text-warning"
              barColor="bg-warning"
            />
            <RateRow
              icon={Trophy}
              label="Taxa de Fechamento"
              rate={closeRate}
              count={closedLeads}
              total={totalLeads}
              color="text-primary"
              barColor="bg-primary"
            />
            <RateRow
              icon={UserMinus}
              label="Taxa de Churn"
              rate={churn.rate}
              count={churn.churned}
              total={churn.total}
              color="text-destructive"
              barColor="bg-destructive"
              unit="clientes"
            />
          </CardContent>
        </Card>
      </div>

      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar meta mensal</DialogTitle>
            <DialogDescription>
              Esta meta será usada no Radar de Faturamento, Briefing do Dia e IA Assistente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="monthly-goal">Meta mensal</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">R$</span>
              <Input
                id="monthly-goal"
                inputMode="numeric"
                value={goalInput}
                onChange={(event) => setGoalInput(event.target.value)}
                placeholder="15.000,00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGoalDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveGoal}>Salvar meta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BriefingItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-sidebar-border bg-white/5 p-3">
      <p className="text-xs text-sidebar-foreground/60">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function OSCard({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="w-10 h-10 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">{text}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function RateRow({
  icon: Icon,
  label,
  rate,
  count,
  total,
  color,
  barColor,
  unit = 'leads',
}: {
  icon: any;
  label: string;
  rate: number;
  count: number;
  total: number;
  color: string;
  barColor: string;
  unit?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${color}`} />
          <span className="font-medium">{label}</span>
        </div>
        <div className="text-right">
          <span className={`text-2xl font-bold ${color}`}>{rate.toFixed(1)}%</span>
          <p className="text-xs text-muted-foreground">
            {count} de {total} {unit}
          </p>
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all`}
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
    </div>
  );
}
