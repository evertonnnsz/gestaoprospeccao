import { useEffect, useMemo, useState } from 'react';
import { format, isFuture, isToday, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Link2Off,
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
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

type AgendaFilter = 'today' | 'upcoming' | 'undated' | 'done';

const AGENDA_STATUSES = ['agendou_reuniao', 'reuniao_realizada'] as const;
const TIME_ZONE = 'America/Sao_Paulo';
const MEETING_DATE_FIELDS = [
  'meeting_date',
  'commercial_meeting_date',
  'meeting_scheduled_date',
  'scheduled_meeting_date',
  'reuniao_date',
  'reuniao_data',
  'reuniao_comercial_data',
  'data_reuniao',
  'data_da_reuniao',
  'data_reuniao_comercial',
  'meetingDate',
  'commercialMeetingDate',
  'scheduledMeetingDate',
];
const MEETING_TIME_FIELDS = [
  'meeting_time',
  'commercial_meeting_time',
  'meeting_scheduled_time',
  'scheduled_meeting_time',
  'reuniao_time',
  'reuniao_horario',
  'reuniao_comercial_horario',
  'horario_reuniao',
  'horario_da_reuniao',
  'horario_reuniao_comercial',
  'meetingTime',
  'commercialMeetingTime',
  'scheduledMeetingTime',
];
const MEETING_NOTES_FIELDS = [
  'meeting_notes',
  'meeting_observations',
  'commercial_meeting_notes',
  'commercial_meeting_observations',
  'meeting_scheduled_notes',
  'scheduled_meeting_notes',
  'reuniao_notes',
  'reuniao_observacoes',
  'reuniao_comercial_observacoes',
  'observacoes_reuniao',
  'observacoes_da_reuniao',
  'observacoes_reuniao_comercial',
  'meetingNotes',
  'meetingObservations',
  'commercialMeetingNotes',
  'commercialMeetingObservations',
  'scheduledMeetingNotes',
];

interface GoogleCalendarConnection {
  connected: boolean;
  google_email?: string | null;
  calendar_id?: string | null;
}

type AgendaLead = Lead & Record<string, unknown>;

function getFirstText(lead: AgendaLead, fields: string[]): string | null {
  for (const field of fields) {
    const value = lead[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return null;
}

function normalizeMeetingDate(value: string | null): string | null {
  if (!value) return null;
  const dateOnly = value.split('T')[0];

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return dateOnly;

  const brDate = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brDate) return `${brDate[3]}-${brDate[2]}-${brDate[1]}`;

  return null;
}

function normalizeMeetingTime(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hours = match[1].padStart(2, '0');
  return `${hours}:${match[2]}`;
}

function getLeadMeetingDateTime(lead: AgendaLead): Date | null {
  const date = normalizeMeetingDate(getFirstText(lead, MEETING_DATE_FIELDS));
  const time = normalizeMeetingTime(getFirstText(lead, MEETING_TIME_FIELDS));

  if (!date || !time) return null;

  const parsed = parseISO(`${date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getLeadMeetingNotes(lead: AgendaLead): string | null {
  return getFirstText(lead, MEETING_NOTES_FIELDS);
}

function getGoogleCalendarUrl(lead: AgendaLead, date: Date | null): string {
  const start = date || new Date();
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  const meetingNotes = getLeadMeetingNotes(lead);

  const formatGoogleDate = (value: Date) =>
    value.toISOString().replace(/[-:]|\.\d{3}/g, '');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Reuniao - ${lead.company_name}`,
    details: [
      lead.contact_name ? `Contato: ${lead.contact_name}` : null,
      lead.whatsapp ? `WhatsApp: ${lead.whatsapp}` : null,
      lead.next_action ? `Proxima acao: ${lead.next_action}` : null,
      meetingNotes ? `Observacoes da reuniao: ${meetingNotes}` : null,
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
  const [leads, setLeads] = useState<AgendaLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);
  const [syncingLeadId, setSyncingLeadId] = useState<string | null>(null);
  const [checkingGoogle, setCheckingGoogle] = useState(true);
  const [googleConnection, setGoogleConnection] = useState<GoogleCalendarConnection>({ connected: false });
  const [filter, setFilter] = useState<AgendaFilter>('today');

  const fetchAgendaLeads = async () => {
    setLoading(true);
    try {
      const data = await fetchAllRows<AgendaLead>('leads', { orderBy: 'created_at', ascending: false });
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

  const fetchGoogleConnection = async () => {
    setCheckingGoogle(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'status' },
      });

      if (error) throw error;
      setGoogleConnection(data || { connected: false });
    } catch (error: any) {
      setGoogleConnection({ connected: false });
      toast({
        title: 'Google Agenda nao conectado',
        description: error.message || 'Confira se a funcao de integracao ja foi publicada.',
        variant: 'destructive',
      });
    } finally {
      setCheckingGoogle(false);
    }
  };

  useEffect(() => {
    fetchAgendaLeads();
    fetchGoogleConnection();

    const params = new URLSearchParams(window.location.search);
    if (params.get('google_calendar') === 'connected') {
      toast({
        title: 'Google Agenda conectado',
        description: 'Agora voce ja pode sincronizar reunioes pelo CRM.',
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const agendaItems = useMemo(() => {
    const today = startOfDay(new Date());

    return leads
      .map((lead) => ({ lead, date: getLeadMeetingDateTime(lead) }))
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
    const mapped = leads.map((lead) => ({ lead, date: getLeadMeetingDateTime(lead) }));

    return {
      today: mapped.filter(({ lead, date }) => lead.status !== 'reuniao_realizada' && date && isToday(date)).length,
      upcoming: mapped.filter(({ lead, date }) => lead.status !== 'reuniao_realizada' && date && isFuture(date)).length,
      undated: mapped.filter(({ lead, date }) => lead.status !== 'reuniao_realizada' && !date).length,
      done: mapped.filter(({ lead }) => lead.status === 'reuniao_realizada').length,
    };
  }, [leads]);

  const markMeetingDone = async (lead: AgendaLead) => {
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

  const openWhatsApp = (lead: AgendaLead) => {
    if (!lead.whatsapp) return;
    const phone = lead.whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  const connectGoogleCalendar = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: {
          action: 'auth-url',
          returnTo: `${window.location.origin}/agenda`,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('URL de conexao nao retornada');
      window.location.href = data.url;
    } catch (error: any) {
      toast({
        title: 'Erro ao iniciar conexao',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const disconnectGoogleCalendar = async () => {
    try {
      const { error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'disconnect' },
      });

      if (error) throw error;
      setGoogleConnection({ connected: false });
      toast({
        title: 'Google Agenda desconectado',
        description: 'A sincronizacao automatica foi pausada para sua conta.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao desconectar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const syncGoogleCalendarEvent = async (lead: AgendaLead, date: Date | null) => {
    if (!date) {
      toast({
        title: 'Reuniao sem data ou horario',
        description: 'Preencha Data da reuniao e Horario no cadastro do cliente antes de sincronizar.',
        variant: 'destructive',
      });
      return;
    }

    const start = new Date(date);
    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    setSyncingLeadId(lead.id);
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-events', {
        body: {
          action: 'create',
          leadId: lead.id,
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
          timeZone: TIME_ZONE,
          meetingNotes: getLeadMeetingNotes(lead),
        },
      });

      if (error) throw error;

      toast({
        title: 'Evento criado no Google Agenda',
        description: `${lead.company_name} foi sincronizado com sua agenda.`,
      });

      if (data?.html_link) {
        window.open(data.html_link, '_blank');
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao sincronizar evento',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSyncingLeadId(null);
    }
  };

  return (
    <div className="app-page">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-semibold">Agenda</h1>
          <p className="text-muted-foreground">
            Acompanhe reunioes pela data e horario salvos no cadastro do cliente.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            fetchAgendaLeads();
            fetchGoogleConnection();
          }}
          className="gap-2"
        >
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
                <h2 className="mt-1 text-xl font-semibold">
                  {googleConnection.connected ? 'Google Agenda conectado' : 'Conecte sua agenda para sincronizar reunioes'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {googleConnection.connected
                    ? `Eventos serao criados na agenda ${googleConnection.google_email || 'principal da sua conta'}.`
                    : 'A conexao e individual: cada usuario conecta a propria conta quando for usar essa funcionalidade.'}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {googleConnection.connected && (
                <Button variant="outline" onClick={disconnectGoogleCalendar} className="gap-2">
                  <Link2Off className="w-4 h-4" />
                  Desconectar
                </Button>
              )}
              <Button
                variant={googleConnection.connected ? 'secondary' : 'default'}
                onClick={connectGoogleCalendar}
                disabled={checkingGoogle}
                className="w-full sm:w-auto gap-2"
              >
                {checkingGoogle ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
                {googleConnection.connected ? 'Reconectar Google' : 'Conectar Google Agenda'}
              </Button>
            </div>
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
            Quando um lead estiver como Agendou Reuniao e tiver data e horario preenchidos, ele aparece aqui.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1.4fr_160px_180px_220px] gap-4 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b bg-muted/40">
            <span>Contato</span>
            <span>Reuniao</span>
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
                {date ? format(date, "dd/MM/yyyy 'as' HH:mm", { locale: ptBR }) : 'Sem data/horario'}
              </div>

              <div>
                <LeadStatusBadge status={lead.status} size="sm" />
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    googleConnection.connected
                      ? syncGoogleCalendarEvent(lead, date)
                      : window.open(getGoogleCalendarUrl(lead, date), '_blank')
                  }
                  disabled={googleConnection.connected && (!date || syncingLeadId === lead.id)}
                  className="gap-2"
                >
                  {syncingLeadId === lead.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : googleConnection.connected ? (
                    <CalendarCheck className="w-4 h-4" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  {googleConnection.connected ? 'Sincronizar' : 'Google'}
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
