import { useEffect, useMemo, useState } from 'react';
import { format, isFuture, isToday, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  MessageCircle,
  RefreshCw,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Lead } from '@/types/crm';
import { fetchAllRows } from '@/lib/supabaseFetch';
import { LeadStatusBadge } from '@/components/leads/LeadStatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

type AgendaFilter = 'today' | 'upcoming' | 'undated' | 'done';

const AGENDA_STATUSES = ['agendou_reuniao', 'reuniao_realizada'] as const;

function getLeadAgendaDate(lead: Lead): Date | null {
  const candidates = [lead.follow_up_1, lead.follow_up_2, lead.follow_up_3, lead.last_contact]
    .filter(Boolean)
    .map((date) => parseISO(date!))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  return candidates[0] || null;
}

function getGoogleCalendarUrl(lead: Lead, date: Date | null): string {
  const start = date || new Date();
  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  const formatGoogleDate = (value: Date) =>
    value.toISOString().replace(/[-:]|\.\d{3}/g, '');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Reuniao - ${lead.company_name}`,
    details: [
      lead.contact_name ? `Contato: ${lead.contact_name}` : null,
      lead.whatsapp ? `WhatsApp: ${lead.whatsapp}` : null,
      lead.next_action ? `Proxima acao: ${lead.next_action}` : null,
      lead.observations ? `Observacoes: ${lead.observations}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
    dates: `${formatGoogleDate(start)}/${formatGoogleDate(end)}`,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function Agenda() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);
  const [filter, setFilter] = useState<AgendaFilter>('today');

  const fetchAgendaLeads = async () => {
    setLoading(true);
    try {
      const data = await fetchAllRows<Lead>('leads', { orderBy: 'created_at', ascending: false });
      setLeads(data.filter((lead) => AGENDA_STATUSES.includes(lead.status as any)));
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar agenda',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgendaLeads();
  }, []);

  const agendaItems = useMemo(() => {
    const today = startOfDay(new Date());

    return leads
      .map((lead) => ({ lead, date: getLeadAgendaDate(lead) }))
      .filter(({ lead, date }) => {
        if (filter === 'done') return lead.status === 'reuniao_realizada';
        if (lead.status === 'reuniao_realizada') return false;
        if (filter === 'undated') return !date;
        if (!date) return false;
        if (filter === 'today') return isToday(date);
        if (filter === 'upcoming') return isFuture(date) || startOfDay(date).getTime() === today.getTime();
        return true;
      })
      .sort((a, b) => {
        if (!a.date && !b.date) return a.lead.company_name.localeCompare(b.lead.company_name);
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date.getTime() - b.date.getTime();
      });
  }, [leads, filter]);

  const stats = useMemo(() => {
    const mapped = leads.map((lead) => ({ lead, date: getLeadAgendaDate(lead) }));

    return {
      today: mapped.filter(({ lead, date }) => lead.status !== 'reuniao_realizada' && date && isToday(date)).length,
      upcoming: mapped.filter(({ lead, date }) => lead.status !== 'reuniao_realizada' && date && isFuture(date)).length,
      undated: mapped.filter(({ lead, date }) => lead.status !== 'reuniao_realizada' && !date).length,
      done: mapped.filter(({ lead }) => lead.status === 'reuniao_realizada').length,
    };
  }, [leads]);

  const markMeetingDone = async (lead: Lead) => {
    setSavingLeadId(lead.id);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('leads')
        .update({
          status: 'reuniao_realizada',
          last_contact: today,
        })
        .eq('id', lead.id);

      if (error) throw error;

      toast({
        title: 'Reuniao marcada como realizada',
        description: `${lead.company_name} foi atualizado no CRM.`,
      });

      fetchAgendaLeads();
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar reuniao',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingLeadId(null);
    }
  };

  const openWhatsApp = (lead: Lead) => {
    if (!lead.whatsapp) return;
    const phone = lead.whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  return (
    <div className="app-page">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-semibold">Agenda</h1>
          <p className="text-muted-foreground">
            Acompanhe reunioes e demandas agendadas a partir dos leads do CRM.
          </p>
        </div>
        <Button variant="outline" onClick={fetchAgendaLeads} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      <Card className="border-primary/20 bg-accent/50">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="metric-label text-primary">Google Agenda</p>
                <h2 className="mt-1 text-xl font-semibold">Central preparada para sincronizacao</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nesta etapa, voce acompanha as reunioes no CRM e pode abrir o Google Agenda para criar o evento.
                </p>
              </div>
            </div>
            <Button variant="outline" disabled className="w-full sm:w-auto">
              Conectar Google Agenda
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <AgendaStat title="Hoje" value={stats.today} icon={CalendarCheck} active={filter === 'today'} onClick={() => setFilter('today')} />
        <AgendaStat title="Proximas" value={stats.upcoming} icon={Clock} active={filter === 'upcoming'} onClick={() => setFilter('upcoming')} />
        <AgendaStat title="Sem data" value={stats.undated} icon={Video} active={filter === 'undated'} onClick={() => setFilter('undated')} />
        <AgendaStat title="Realizadas" value={stats.done} icon={CheckCircle2} active={filter === 'done'} onClick={() => setFilter('done')} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : agendaItems.length === 0 ? (
        <Card className="p-8 text-center">
          <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <h2 className="font-semibold">Nenhuma demanda nesta visao</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Quando um lead estiver como Agendou Reuniao, ele aparece aqui.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1.4fr_160px_180px_220px] gap-4 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b bg-muted/40">
            <span>Contato</span>
            <span>Data</span>
            <span>Status</span>
            <span className="text-right">Acoes</span>
          </div>
          {agendaItems.map(({ lead, date }) => (
            <div
              key={lead.id}
              className="grid grid-cols-1 lg:grid-cols-[1.4fr_160px_180px_220px] gap-3 lg:gap-4 px-4 py-3 border-b last:border-b-0 items-center hover:bg-accent/30"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold truncate">{lead.company_name}</h2>
                  {lead.next_action && <Badge variant="outline">{lead.next_action}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {lead.contact_name || 'Contato nao informado'} {lead.whatsapp ? `- ${lead.whatsapp}` : ''}
                </p>
              </div>

              <div className="text-sm text-muted-foreground">
                {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : 'Sem data'}
              </div>

              <div>
                <LeadStatusBadge status={lead.status} size="sm" />
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(getGoogleCalendarUrl(lead, date), '_blank')}
                  className="gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Google
                </Button>
                {lead.whatsapp && (
                  <Button variant="outline" size="sm" onClick={() => openWhatsApp(lead)} className="gap-2">
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </Button>
                )}
                {lead.status === 'agendou_reuniao' && (
                  <Button
                    size="sm"
                    onClick={() => markMeetingDone(lead)}
                    disabled={savingLeadId === lead.id}
                    className="gap-2"
                  >
                    {savingLeadId === lead.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Realizada
                  </Button>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function AgendaStat({
  title,
  value,
  icon: Icon,
  active,
  onClick,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
        active ? 'border-primary/30 bg-accent/70' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="metric-label">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="w-5 h-5" />
        </span>
      </div>
    </button>
  );
}
