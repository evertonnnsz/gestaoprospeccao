import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Lead, LeadStatus, STATUS_LABELS } from '@/types/crm';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { LeadStatusBadge } from '@/components/leads/LeadStatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PeriodFilter, PeriodType, DateRange, filterByPeriod } from '@/components/filters/PeriodFilter';
import { 
  Users, 
  Target, 
  Calendar, 
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { isPast, isToday, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['hsl(217, 91%, 60%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(280, 65%, 60%)', 'hsl(0, 84%, 60%)'];

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('all');
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });

  useEffect(() => {
    fetchLeads();
  }, []);

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

  const filteredLeads = filterByPeriod(leads, period, dateRange);

  // Calculate stats
  const totalLeads = filteredLeads.length;
  const closedLeads = filteredLeads.filter(l => l.status === 'fechado').length;
  const meetingsHeld = filteredLeads.filter(l => ['reuniao_realizada', 'proposta_enviada', 'em_negociacao', 'fechado', 'lead_perdido'].includes(l.status || '')).length;
  
  const overdueFollowUps = filteredLeads.filter(lead => {
    // Don't count overdue for lost leads or those without interest
    if (lead.status === 'lead_perdido' || lead.status === 'sem_interesse') {
      return false;
    }
    
    // Don't count overdue if all three follow-ups are filled
    if (lead.follow_up_1 && lead.follow_up_2 && lead.follow_up_3) {
      return false;
    }
    
    const followUps = [lead.follow_up_1, lead.follow_up_2, lead.follow_up_3].filter(Boolean);
    return followUps.some(date => date && isPast(new Date(date)) && !isToday(new Date(date)));
  }).length;

  const closeRate = totalLeads > 0 ? ((closedLeads / totalLeads) * 100).toFixed(1) : 0;

  // Status distribution for chart
  const statusData = Object.entries(
    filteredLeads.reduce((acc, lead) => {
      if (lead.status) acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([status, count]) => ({
    name: STATUS_LABELS[status as LeadStatus],
    value: count,
  }));

  // Recent leads
  const recentLeads = filteredLeads.slice(0, 5);

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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total de Leads"
          value={totalLeads}
          icon={Users}
          variant="primary"
        />
        <StatsCard
          title="Reuniões Realizadas"
          value={meetingsHeld}
          icon={Calendar}
          variant="success"
        />
        <StatsCard
          title="Taxa de Fechamento"
          value={`${closeRate}%`}
          icon={TrendingUp}
          variant="default"
        />
        <StatsCard
          title="Follow-ups Vencidos"
          value={overdueFollowUps}
          icon={AlertTriangle}
          variant={overdueFollowUps > 0 ? 'destructive' : 'default'}
          onClick={overdueFollowUps > 0 ? () => navigate('/leads?filter=overdue') : undefined}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Distribuição por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Nenhum lead cadastrado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Leads */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Leads Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentLeads.length > 0 ? (
              <div className="space-y-3">
                {recentLeads.map((lead) => (
                  <div 
                    key={lead.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{lead.company_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(lead.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <LeadStatusBadge status={lead.status} size="sm" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Nenhum lead cadastrado
              </div>
            )}
          </CardContent>
      </Card>
      </div>
    </div>
  );
}
