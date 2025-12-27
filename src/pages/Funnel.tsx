import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Lead, LeadStatus, STATUS_ORDER } from '@/types/crm';
import { LeadStatusBadge } from '@/components/leads/LeadStatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PeriodFilter, PeriodType, DateRange, filterByPeriod } from '@/components/filters/PeriodFilter';
import { Loader2 } from 'lucide-react';

export default function Funnel() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('all');
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });

  useEffect(() => {
    const fetchLeads = async () => {
      const { data } = await supabase.from('leads').select('*');
      setLeads((data as Lead[]) || []);
      setLoading(false);
    };
    fetchLeads();
  }, []);

  const filteredLeads = filterByPeriod(leads, period, dateRange);
  const getLeadsByStatus = (status: LeadStatus) => filteredLeads.filter(l => l.status === status);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Funil de Prospecção</h1>
          <p className="text-muted-foreground">{filteredLeads.length} leads no período selecionado</p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} dateRange={dateRange} onDateRangeChange={setDateRange} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {STATUS_ORDER.map((status) => {
          const statusLeads = getLeadsByStatus(status);
          return (
            <Card key={status} className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <LeadStatusBadge status={status} size="sm" />
                  <span className="text-lg font-bold">{statusLeads.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
                {statusLeads.map((lead) => (
                  <div key={lead.id} className="p-2 bg-muted/50 rounded-lg text-sm">
                    <p className="font-medium truncate">{lead.company_name}</p>
                    {lead.contact_name && <p className="text-xs text-muted-foreground truncate">{lead.contact_name}</p>}
                  </div>
                ))}
                {statusLeads.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum lead</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
