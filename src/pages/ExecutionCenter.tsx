import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BookOpen, Briefcase, CalendarCheck, ClipboardList, DollarSign, Dumbbell, Inbox, Play, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

type WeekdayId = 'domingo' | 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta' | 'sabado';

type PlannedActivity = {
  id: string;
  title: string;
  detail: string;
  area: 'Comercial' | 'Operacional' | 'Financeiro' | 'Estudos' | 'Planejamento';
  duration: string;
  icon: any;
};

const dayOptions: { value: WeekdayId; label: string }[] = [
  { value: 'segunda', label: 'Segunda-feira' },
  { value: 'terca', label: 'Terça-feira' },
  { value: 'quarta', label: 'Quarta-feira' },
  { value: 'quinta', label: 'Quinta-feira' },
  { value: 'sexta', label: 'Sexta-feira' },
  { value: 'sabado', label: 'Sábado' },
  { value: 'domingo', label: 'Domingo' },
];

const dayByIndex: WeekdayId[] = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeekdayFromDate = (dateString: string): WeekdayId => {
  const date = new Date(`${dateString}T12:00:00`);
  return dayByIndex[date.getDay()];
};

const getNextDateForWeekday = (weekday: WeekdayId) => {
  const today = new Date();
  const targetIndex = dayByIndex.indexOf(weekday);
  const daysToAdd = (targetIndex - today.getDay() + 7) % 7;
  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysToAdd);
  return toISODate(nextDate);
};

const formatSelectedDate = (dateString: string) => {
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export default function ExecutionCenter() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [demands, setDemands] = useState<OSDemand[]>([]);
  const [selectedDate, setSelectedDate] = useState(toISODate(new Date()));
  const selectedDay = getWeekdayFromDate(selectedDate);

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
  const meetingsWithDate = leads
    .filter((lead) => !!lead.meeting_date)
    .sort((a, b) => {
      const dateComparison = (a.meeting_date || '').localeCompare(b.meeting_date || '');
      if (dateComparison !== 0) return dateComparison;
      return (a.meeting_time || '').localeCompare(b.meeting_time || '');
    });
  const scheduledMeetings = meetingsWithDate
    .filter((lead) => {
      if (!lead.meeting_date) return false;
      return lead.meeting_date === selectedDate;
    })
    .sort((a, b) => {
      const dateComparison = (a.meeting_date || '').localeCompare(b.meeting_date || '');
      if (dateComparison !== 0) return dateComparison;
      return (a.meeting_time || '').localeCompare(b.meeting_time || '');
    });
  const insights = getAssistantInsights(context);
  const activeClients = clients.filter((client) => client.status === 'active');
  const plannedActivities = useMemo(
    () => getPlannedActivities(selectedDay, activeClients),
    [activeClients, selectedDay],
  );
  const selectedDayLabel = dayOptions.find((day) => day.value === selectedDay)?.label || 'Hoje';
  const isWeekend = selectedDay === 'sabado' || selectedDay === 'domingo';
  const handleDayChange = (value: WeekdayId) => setSelectedDate(getNextDateForWeekday(value));

  const queue = useMemo<ExecutionItem[]>(() => {
    const plannedItems = plannedActivities.map((activity, index) => ({
      id: activity.id,
      title: activity.title,
      detail: activity.detail,
      area: activity.area,
      priority: 60 - index,
      path: activity.area === 'Comercial' ? '/leads' : activity.area === 'Estudos' ? '/estudos' : '/central-execucao',
      tone: 'default' as const,
    }));

    const meetingItems = scheduledMeetings.map((lead) => ({
      id: `meeting-${lead.id}`,
      title: `Reunião: ${lead.company_name}`,
      detail: `${lead.meeting_time ? `${lead.meeting_time} • ` : ''}${lead.meeting_notes || lead.next_action || 'Reunião comercial agendada.'}`,
      area: 'Comercial',
      priority: 100,
      path: '/leads?status=agendou_reuniao',
      tone: 'critical' as const,
    }));

    if (isWeekend) {
      return [...meetingItems, ...plannedItems].sort((a, b) => b.priority - a.priority);
    }

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

    return [...meetingItems, ...demandItems, ...followUpItems, ...plannedItems].sort((a, b) => b.priority - a.priority);
  }, [activeDemands, followUps, isWeekend, plannedActivities, scheduledMeetings]);
  const selectedNextAction = queue[0];

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
        <Button onClick={() => navigate(selectedNextAction?.path || nextBestAction.path)} className="gap-2">
          <Play className="w-4 h-4" />
          {selectedNextAction?.title || nextBestAction.title}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <Metric title="Demandas críticas" value={criticalDemands.length} icon={AlertTriangle} tone="critical" />
        <Metric title="Follow-ups" value={followUps.length} icon={CalendarCheck} tone="warning" />
        <Metric title="Reuniões do dia" value={scheduledMeetings.length} icon={CalendarCheck} tone="critical" />
        <Metric title="Demandas ativas" value={activeDemands.length} icon={Inbox} tone="default" />
        <Metric title="Missões fixas" value={3} icon={ClipboardList} tone="default" />
      </div>

      <Card className="border-warning/30 shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Planejamento por dia</CardTitle>
              <p className="text-sm text-muted-foreground">
                Filtre por data real para enxergar reuniões, missões e operação do dia escolhido.
              </p>
            </div>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-[420px]">
              <Select value={selectedDay} onValueChange={(value) => handleDayChange(value as WeekdayId)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dayOptions.map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted/60 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold">{selectedDayLabel} - {formatSelectedDate(selectedDate)}</p>
                <p className="text-sm text-muted-foreground">
                  {isWeekend
                    ? 'Fim de semana sem operação. Apenas estudo ou leitura para manter evolução sem peso operacional.'
                    : 'Dia útil com saúde, blocos comerciais e operacionais organizados por prioridade.'}
                </p>
              </div>
              <Badge className={isWeekend ? 'bg-primary text-primary-foreground' : 'bg-warning text-warning-foreground'}>
                {isWeekend ? 'Modo Leve' : 'Modo Operação'}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {plannedActivities.map((activity) => (
              <div key={activity.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
                      <activity.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">{activity.area} • {activity.duration}</p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{activity.detail}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 shadow-sm">
        <CardHeader>
          <CardTitle>Reuniões encontradas no CRM</CardTitle>
          <p className="text-sm text-muted-foreground">
            Conferência direta dos leads que possuem data de reunião salva.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {scheduledMeetings.length > 0 ? (
            scheduledMeetings.map((lead) => (
              <div key={lead.id} className="flex flex-col gap-2 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">{lead.company_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {lead.meeting_date ? formatSelectedDate(lead.meeting_date) : 'Sem data'}
                    {lead.meeting_time ? ` às ${lead.meeting_time}` : ''}
                    {lead.meeting_notes ? ` - ${lead.meeting_notes}` : ''}
                  </p>
                </div>
                <Badge className="bg-primary text-primary-foreground">Na data selecionada</Badge>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed p-4">
              <p className="font-medium">Nenhuma reunião encontrada para {formatSelectedDate(selectedDate)}.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Total de leads com alguma data de reunião salva no CRM: {meetingsWithDate.length}.
              </p>
              {meetingsWithDate.length > 0 && (
                <div className="mt-3 space-y-2">
                  {meetingsWithDate.slice(0, 5).map((lead) => (
                    <div key={lead.id} className="flex flex-col gap-1 rounded-md bg-muted/60 p-3 text-sm md:flex-row md:items-center md:justify-between">
                      <span className="font-medium">{lead.company_name}</span>
                      <span className="text-muted-foreground">
                        {lead.meeting_date ? formatSelectedDate(lead.meeting_date) : 'Sem data'}
                        {lead.meeting_time ? ` às ${lead.meeting_time}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
            <div className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
              Academia, estudo, prospecção e planejamento são missões fixas. Elas aparecem aqui na Central de Execução, mas não entram na Central de Demandas porque não são solicitações inesperadas.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function getPlannedActivities(day: WeekdayId, activeClients: Client[]): PlannedActivity[] {
  if (day === 'sabado' || day === 'domingo') {
    return [
      {
        id: `${day}-study`,
        title: 'Estudar ou ler um livro',
        detail: 'Bloco único e leve para manter repertório sem abrir rotina operacional.',
        area: 'Estudos',
        duration: '1h a 2h',
        icon: BookOpen,
      },
    ];
  }

  const activeClientNames = activeClients
    .slice(0, 4)
    .map((client) => client.lead?.company_name)
    .filter(Boolean)
    .join(', ');

  const operationalDetail = activeClientNames
    ? `Revisar campanhas, pendências e entregas dos clientes ativos: ${activeClientNames}.`
    : 'Revisar campanhas, pendências, relatórios e entregas dos clientes ativos.';

  const base: PlannedActivity[] = [
    {
      id: `${day}-health`,
      title: 'Academia / atividade física',
      detail: 'Missão fixa de saúde. Deve ser preservada no dia útil e só reagendada quando houver prioridade real.',
      area: 'Planejamento',
      duration: '1h',
      icon: Dumbbell,
    },
    {
      id: `${day}-prospecting`,
      title: 'Prospecção ativa',
      detail: 'Abrir novas oportunidades comerciais antes de entrar no operacional profundo.',
      area: 'Comercial',
      duration: '1h',
      icon: Target,
    },
    {
      id: `${day}-followups`,
      title: 'Follow-ups comerciais',
      detail: 'Retomar oportunidades abertas, propostas e contatos que dependem de resposta.',
      area: 'Comercial',
      duration: '30min a 1h',
      icon: CalendarCheck,
    },
    {
      id: `${day}-operation`,
      title: day === 'segunda' ? 'Operacional de segunda-feira' : 'Bloco operacional',
      detail: operationalDetail,
      area: 'Operacional',
      duration: '1h a 2h',
      icon: Briefcase,
    },
    {
      id: `${day}-demands`,
      title: 'Revisar Central de Demandas',
      detail: 'Executar demandas críticas, classificar Inbox e evitar solicitação solta fora do sistema.',
      area: 'Operacional',
      duration: '30min',
      icon: Inbox,
    },
  ];

  if (day === 'segunda') {
    return [
      {
        id: 'segunda-week-plan',
        title: 'Planejamento semanal',
        detail: 'Definir foco da semana, meta comercial, clientes prioritários e entregas operacionais.',
        area: 'Planejamento',
        duration: '30min',
        icon: ClipboardList,
      },
      ...base,
      {
        id: 'segunda-finance',
        title: 'Radar financeiro da semana',
        detail: 'Checar receita prevista, clientes em risco, pagamentos e distância da meta mensal.',
        area: 'Financeiro',
        duration: '20min',
        icon: DollarSign,
      },
    ];
  }

  if (day === 'sexta') {
    return [
      ...base,
      {
        id: 'sexta-close',
        title: 'Fechamento e próxima semana',
        detail: 'Encerrar pendências críticas e deixar segunda-feira planejada.',
        area: 'Planejamento',
        duration: '40min',
        icon: ClipboardList,
      },
    ];
  }

  return base;
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
