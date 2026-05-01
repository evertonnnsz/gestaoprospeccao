import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Lead, LeadStatus, STATUS_LABELS, STATUS_ORDER, LEAD_SOURCES } from '@/types/crm';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
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
        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setLeads((data as Lead[]) || []);
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
  const totalLeads = filteredLeads.length;
  const closedLeads = filteredLeads.filter((l) => l.status === 'fechado').length;
  const meetingsHeld = filteredLeads.filter((l) => MEETING_STATUSES.includes(l.status as LeadStatus)).length;
  const respondedLeads = filteredLeads.filter((l) => l.responded === true).length;

  const todayFollowUps = leads.filter((lead) => {
    if (lead.status === 'lead_perdido' || lead.status === 'sem_interesse') return false;
    const followUps = [lead.follow_up_1, lead.follow_up_2, lead.follow_up_3].filter(Boolean);
    return followUps.some((date) => date && isSameDay(date));
  }).length;

  const closeRate = totalLeads > 0 ? (closedLeads / totalLeads) * 100 : 0;
  const meetingRate = totalLeads > 0 ? (meetingsHeld / totalLeads) * 100 : 0;
  const responseRate = totalLeads > 0 ? (respondedLeads / totalLeads) * 100 : 0;

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
        <StatsCard title="Reuniões Realizadas" value={meetingsHeld} icon={Calendar} variant="success" />
        <StatsCard title="Taxa de Fechamento" value={`${closeRate.toFixed(1)}%`} icon={TrendingUp} variant="default" />
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
          </CardContent>
        </Card>
      </div>
    </div>
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
}: {
  icon: any;
  label: string;
  rate: number;
  count: number;
  total: number;
  color: string;
  barColor: string;
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
            {count} de {total} leads
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
