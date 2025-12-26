import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Lead, STATUS_LABELS } from '@/types/crm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Loader2 } from 'lucide-react';

const COLORS = ['hsl(217, 91%, 60%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(280, 65%, 60%)', 'hsl(0, 84%, 60%)'];

export default function Metrics() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeads = async () => {
      const { data } = await supabase.from('leads').select('*');
      setLeads((data as Lead[]) || []);
      setLoading(false);
    };
    fetchLeads();
  }, []);

  const totalLeads = leads.length;
  const closedLeads = leads.filter(l => l.status === 'fechado').length;
  const meetingsScheduled = leads.filter(l => ['agendou_reuniao', 'reuniao_realizada'].includes(l.status)).length;
  const responseRate = totalLeads > 0 ? ((leads.filter(l => !['lead_coletado', 'contato_iniciado'].includes(l.status)).length / totalLeads) * 100).toFixed(1) : 0;
  const closeRate = totalLeads > 0 ? ((closedLeads / totalLeads) * 100).toFixed(1) : 0;
  const meetingRate = totalLeads > 0 ? ((meetingsScheduled / totalLeads) * 100).toFixed(1) : 0;

  const sourceData = Object.entries(leads.reduce((acc, l) => { if (l.lead_source) acc[l.lead_source] = (acc[l.lead_source] || 0) + 1; return acc; }, {} as Record<string, number>)).map(([name, value]) => ({ name, value }));
  const segmentData = Object.entries(leads.reduce((acc, l) => { if (l.segment) acc[l.segment] = (acc[l.segment] || 0) + 1; return acc; }, {} as Record<string, number>)).map(([name, value]) => ({ name, value }));

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Métricas</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6"><p className="text-sm text-muted-foreground">Taxa de Resposta</p><p className="text-3xl font-bold text-primary">{responseRate}%</p></Card>
        <Card className="p-6"><p className="text-sm text-muted-foreground">Taxa de Reuniões</p><p className="text-3xl font-bold text-success">{meetingRate}%</p></Card>
        <Card className="p-6"><p className="text-sm text-muted-foreground">Taxa de Fechamento</p><p className="text-3xl font-bold text-warning">{closeRate}%</p></Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardHeader><CardTitle>Origem dos Leads</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={250}><BarChart data={sourceData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader><CardTitle>Segmentos</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={250}><PieChart><Pie data={segmentData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>{segmentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></CardContent></Card>
      </div>
    </div>
  );
}
