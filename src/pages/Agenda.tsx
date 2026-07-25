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
  Plus,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Client, Lead } from '@/types/crm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

type AgendaFilter = 'today' | 'upcoming' | 'done';
type ManualEventType = 'mentoring' | 'personal' | 'standalone_meeting' | 'operational_task' | 'other';

const TIME_ZONE = 'America/Sao_Paulo';
const EVENT_TYPE_LABELS: Record<string, string> = {
  commercial_meeting: 'Reunião comercial',
  proposal_meeting: 'Reunião de proposta',
  onboarding: 'Onboarding',
  mentoring: 'Mentoria',
  personal: 'Pessoal',
  standalone_meeting: 'Reuniao avulsa',
  results_meeting: 'Reunião de resultado',
  operational_task: 'Demanda operacional',
  other: 'Outra demanda',
};

const MANUAL_EVENT_DEFAULTS = {
  title: '',
  event_type: 'standalone_meeting' as ManualEventType,
  scheduled_date: '',
  scheduled_time: '',
  duration_minutes: '60',
  guest_email: '',
  notes: '',
};

interface GoogleCalendarConnection {
  connected: boolean;
  google_email?: string | null;
  calendar_id?: string | null;
}

interface AgendaEvent {
  id: string;
  user_id: string;
  source_type: 'lead' | 'client' | 'manual';
  lead_id: string | null;
  client_id: string | null;
  event_type: string;
  title: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number | null;
  guest_email: string | null;
  notes: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  google_event_id: string | null;
  google_event_link: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AgendaItem {
  event: AgendaEvent;
  lead: Lead | null;
  client: Client | null;
  date: Date;
}

function parseAgendaDateTime(event: AgendaEvent): Date {
  const time = (event.scheduled_time || '09:00').slice(0, 5);
  const parsed = parseISO(`${event.scheduled_date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? new Date(`${event.scheduled_date}T09:00:00`) : parsed;
}

function toGoogleDate(value: Date): string {
  return value.toISOString().replace(/[-:]|\.\d{3}/g, '');
}

function getManualGoogleCalendarUrl(item: AgendaItem): string {
  const start = item.date;
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + (item.event.duration_minutes || 60));

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: item.event.title,
    details: [
      `Tipo: ${EVENT_TYPE_LABELS[item.event.event_type] || item.event.event_type}`,
      item.lead?.contact_name ? `Contato: ${item.lead.contact_name}` : null,
      item.lead?.whatsapp ? `WhatsApp: ${item.lead.whatsapp}` : null,
      item.event.guest_email ? `Convidado: ${item.event.guest_email}` : null,
      item.event.notes ? `Observações: ${item.event.notes}` : null,
    ].filter(Boolean).join('\n'),
    dates: `${toGoogleDate(start)}/${toGoogleDate(end)}`,
  });

  if (item.event.guest_email) {
    params.set('add', item.event.guest_email);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function Agenda() {
  const { toast } = useToast();
  const db = supabase as any;
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingEventId, setSavingEventId] = useState<string | null>(null);
  const [syncingEventId, setSyncingEventId] = useState<string | null>(null);
  const [checkingGoogle, setCheckingGoogle] = useState(true);
  const [googleConnection, setGoogleConnection] = useState<GoogleCalendarConnection>({ connected: false });
  const [filter, setFilter] = useState<AgendaFilter>('today');
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [savingManualEvent, setSavingManualEvent] = useState(false);
  const [manualEvent, setManualEvent] = useState(MANUAL_EVENT_DEFAULTS);

  const fetchAgendaData = async () => {
    setLoading(true);
    try {
      const { data: eventsData, error: eventsError } = await db
        .from('agenda_events')
        .select('*')
        .neq('status', 'cancelled')
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true });

      if (eventsError) throw eventsError;

      const agendaEvents = (eventsData || []) as AgendaEvent[];
      const leadIds = Array.from(new Set(agendaEvents.map((event) => event.lead_id).filter((id): id is string => Boolean(id))));
      const clientIds = Array.from(new Set(agendaEvents.map((event) => event.client_id).filter((id): id is string => Boolean(id))));

      const { data: leadsData, error: leadsError } = leadIds.length
        ? await db.from('leads').select('*').in('id', leadIds)
        : { data: [], error: null };

      if (leadsError) throw leadsError;

      const { data: clientsData, error: clientsError } = clientIds.length
        ? await db.from('clients').select('*').in('id', clientIds)
        : { data: [], error: null };

      if (clientsError) throw clientsError;

      const clientLeadIds = Array.from(new Set(((clientsData || []) as Client[]).map((client) => client.lead_id).filter((id): id is string => Boolean(id))));
      const missingClientLeadIds = clientLeadIds.filter((id) => !leadIds.includes(id));

      const { data: clientLeadsData, error: clientLeadsError } = missingClientLeadIds.length
        ? await db.from('leads').select('*').in('id', missingClientLeadIds)
        : { data: [], error: null };

      if (clientLeadsError) throw clientLeadsError;

      setEvents(agendaEvents);
      setLeads([...(leadsData || []), ...(clientLeadsData || [])] as Lead[]);
      setClients((clientsData || []) as Client[]);
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
        title: 'Google Agenda não conectado',
        description: error.message || 'Confira se a integração está publicada.',
        variant: 'destructive',
      });
    } finally {
      setCheckingGoogle(false);
    }
  };

  useEffect(() => {
    fetchAgendaData();
    fetchGoogleConnection();

    const params = new URLSearchParams(window.location.search);
    if (params.get('google_calendar') === 'connected') {
      toast({
        title: 'Google Agenda conectado',
        description: 'Agora você já pode sincronizar compromissos pelo CRM.',
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const agendaItems = useMemo(() => {
    const leadById = new Map(leads.map((lead) => [lead.id, lead]));
    const clientById = new Map(clients.map((client) => [client.id, client]));
    const today = startOfDay(new Date());

    return events
      .map((event) => {
        const client = event.client_id ? clientById.get(event.client_id) || null : null;
        const lead = event.lead_id
          ? leadById.get(event.lead_id) || null
          : client?.lead_id
            ? leadById.get(client.lead_id) || null
            : null;

        return { event, lead, client, date: parseAgendaDateTime(event) };
      })
      .filter((item) => {
        if (filter === 'done') return item.event.status === 'completed';
        if (item.event.status === 'completed') return false;
        if (filter === 'today') return isToday(item.date);
        if (filter === 'upcoming') return isFuture(item.date) || startOfDay(item.date).getTime() === today.getTime();
        return true;
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [events, leads, clients, filter]);

  const stats = useMemo(() => {
    const mapped = events.map((event) => ({ event, date: parseAgendaDateTime(event) }));

    return {
      today: mapped.filter(({ event, date }) => event.status !== 'completed' && isToday(date)).length,
      upcoming: mapped.filter(({ event, date }) => event.status !== 'completed' && isFuture(date)).length,
      done: mapped.filter(({ event }) => event.status === 'completed').length,
    };
  }, [events]);

  const connectGoogleCalendar = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: {
          action: 'auth-url',
          returnTo: `${window.location.origin}/agenda`,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('URL de conexão não retornada');
      window.location.href = data.url;
    } catch (error: any) {
      toast({
        title: 'Erro ao iniciar conexão',
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
        description: 'A sincronização automática foi pausada para sua conta.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao desconectar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const createManualEvent = async () => {
    if (!manualEvent.title.trim() || !manualEvent.scheduled_date || !manualEvent.scheduled_time) {
      toast({
        title: 'Preencha os campos obrigatorios',
        description: 'Informe titulo, data e horario para criar o evento.',
        variant: 'destructive',
      });
      return;
    }

    setSavingManualEvent(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error('Usuario nao autenticado');

      const duration = Number(manualEvent.duration_minutes) || 60;
      const { error } = await db.from('agenda_events').insert({
        user_id: authData.user.id,
        source_type: 'manual',
        lead_id: null,
        client_id: null,
        event_type: manualEvent.event_type,
        title: manualEvent.title.trim(),
        scheduled_date: manualEvent.scheduled_date,
        scheduled_time: manualEvent.scheduled_time,
        duration_minutes: duration > 0 ? duration : 60,
        guest_email: manualEvent.guest_email.trim() || null,
        notes: manualEvent.notes.trim() || null,
        status: 'scheduled',
      });

      if (error) throw error;

      toast({
        title: 'Evento criado',
        description: `${manualEvent.title.trim()} foi adicionado na Agenda.`,
      });

      setManualEvent(MANUAL_EVENT_DEFAULTS);
      setManualDialogOpen(false);
      fetchAgendaData();
    } catch (error: any) {
      toast({
        title: 'Erro ao criar evento',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingManualEvent(false);
    }
  };

  const markEventDone = async (item: AgendaItem) => {
    setSavingEventId(item.event.id);
    try {
      const { error } = await db
        .from('agenda_events')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', item.event.id);

      if (error) throw error;

      toast({
        title: 'Compromisso concluído',
        description: `${item.event.title} foi marcado como concluído.`,
      });

      fetchAgendaData();
    } catch (error: any) {
      toast({
        title: 'Erro ao concluir compromisso',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingEventId(null);
    }
  };

  const openWhatsApp = (lead: Lead | null) => {
    if (!lead?.whatsapp) return;
    const phone = lead.whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  const syncGoogleCalendarEvent = async (item: AgendaItem) => {
    setSyncingEventId(item.event.id);
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-events', {
        body: {
          action: 'create',
          agendaEventId: item.event.id,
          timeZone: TIME_ZONE,
        },
      });

      if (error) throw error;

      toast({
        title: 'Evento criado no Google Agenda',
        description: `${item.event.title} foi sincronizado com sua agenda.`,
      });

      fetchAgendaData();

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
      setSyncingEventId(null);
    }
  };

  return (
    <div className="app-page">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-semibold">Agenda</h1>
          <p className="text-muted-foreground">
            Centralize reuniões comerciais e demandas de clientes ativos.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={() => setManualDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Criar evento
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              fetchAgendaData();
              fetchGoogleConnection();
            }}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
        </div>
      </div>

      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Criar evento</DialogTitle>
            <DialogDescription>
              Adicione compromissos avulsos, mentorias, tarefas pessoais ou reunioes fora do fluxo de leads.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="manual_event_title">Titulo</Label>
              <Input
                id="manual_event_title"
                placeholder="Ex: Mentoria com cliente"
                value={manualEvent.title}
                onChange={(event) => setManualEvent((prev) => ({ ...prev, title: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={manualEvent.event_type}
                onValueChange={(value) =>
                  setManualEvent((prev) => ({ ...prev, event_type: value as ManualEventType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mentoring">Mentoria</SelectItem>
                  <SelectItem value="standalone_meeting">Reuniao avulsa</SelectItem>
                  <SelectItem value="personal">Pessoal</SelectItem>
                  <SelectItem value="operational_task">Demanda operacional</SelectItem>
                  <SelectItem value="other">Outra demanda</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual_event_duration">Duracao em minutos</Label>
              <Input
                id="manual_event_duration"
                type="number"
                min="15"
                step="15"
                value={manualEvent.duration_minutes}
                onChange={(event) => setManualEvent((prev) => ({ ...prev, duration_minutes: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual_event_date">Data</Label>
              <Input
                id="manual_event_date"
                type="date"
                value={manualEvent.scheduled_date}
                onChange={(event) => setManualEvent((prev) => ({ ...prev, scheduled_date: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual_event_time">Horario</Label>
              <Input
                id="manual_event_time"
                type="time"
                value={manualEvent.scheduled_time}
                onChange={(event) => setManualEvent((prev) => ({ ...prev, scheduled_time: event.target.value }))}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="manual_event_guest_email">E-mail do convidado</Label>
              <Input
                id="manual_event_guest_email"
                type="email"
                placeholder="convidado@email.com"
                value={manualEvent.guest_email}
                onChange={(event) => setManualEvent((prev) => ({ ...prev, guest_email: event.target.value }))}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="manual_event_notes">Observacoes</Label>
              <Textarea
                id="manual_event_notes"
                rows={3}
                placeholder="Detalhes do compromisso..."
                value={manualEvent.notes}
                onChange={(event) => setManualEvent((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManualDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createManualEvent} disabled={savingManualEvent} className="gap-2">
              {savingManualEvent && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar evento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  {googleConnection.connected ? 'Google Agenda conectado' : 'Conecte sua agenda para sincronizar compromissos'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {googleConnection.connected
                    ? `Eventos serão criados na agenda ${googleConnection.google_email || 'principal da sua conta'}.`
                    : 'A conexão é individual: cada usuário conecta a própria conta quando for usar essa funcionalidade.'}
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <AgendaStat title="Hoje" value={stats.today} icon={CalendarCheck} active={filter === 'today'} onClick={() => setFilter('today')} />
        <AgendaStat title="Próximas" value={stats.upcoming} icon={Clock} active={filter === 'upcoming'} onClick={() => setFilter('upcoming')} />
        <AgendaStat title="Concluídas" value={stats.done} icon={CheckCircle2} active={filter === 'done'} onClick={() => setFilter('done')} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : agendaItems.length === 0 ? (
        <Card className="p-8 text-center">
          <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <h2 className="font-semibold">Nenhuma demanda nesta visão</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Reuniões, demandas e eventos manuais aparecerão aqui quando forem salvos.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1.4fr_180px_160px_260px] gap-4 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b bg-muted/40">
            <span>Contato</span>
            <span>Agenda</span>
            <span>Origem</span>
            <span className="text-right">Ações</span>
          </div>
          {agendaItems.map((item) => {
            const companyName = item.lead?.company_name || item.event.title;
            const contactLine = item.lead
              ? `${item.lead.contact_name || 'Contato não informado'} ${item.lead.whatsapp ? `- ${item.lead.whatsapp}` : ''}`
              : item.event.source_type === 'manual'
                ? 'Evento manual'
                : 'Cliente ativo';
            const sourceLabel =
              item.event.source_type === 'lead'
                ? 'Lead'
                : item.event.source_type === 'manual'
                  ? 'Manual'
                  : 'Cliente ativo';

            return (
              <div
                key={item.event.id}
                className="grid grid-cols-1 lg:grid-cols-[1.4fr_180px_160px_260px] gap-3 lg:gap-4 px-4 py-3 border-b last:border-b-0 items-center hover:bg-accent/30"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold truncate">{companyName}</h2>
                    <Badge variant="secondary">{EVENT_TYPE_LABELS[item.event.event_type] || item.event.event_type}</Badge>
                    {item.event.google_event_id && <Badge variant="outline">Google</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{contactLine}</p>
                  {item.event.guest_email && (
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      Convidado: {item.event.guest_email}
                    </p>
                  )}
                  {item.event.notes && <p className="text-xs text-muted-foreground truncate mt-1">{item.event.notes}</p>}
                </div>

                <div className="text-sm text-muted-foreground">
                  {format(item.date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>

                <div>
                  <Badge variant={item.event.source_type === 'lead' ? 'outline' : 'default'}>
                    {sourceLabel}
                  </Badge>
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      googleConnection.connected
                        ? syncGoogleCalendarEvent(item)
                        : window.open(getManualGoogleCalendarUrl(item), '_blank')
                    }
                    disabled={syncingEventId === item.event.id}
                    className="gap-2"
                  >
                    {syncingEventId === item.event.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : googleConnection.connected ? (
                      <CalendarCheck className="w-4 h-4" />
                    ) : (
                      <ExternalLink className="w-4 h-4" />
                    )}
                    {item.event.google_event_id ? 'Reenviar' : 'Sincronizar'}
                  </Button>
                  {item.lead?.whatsapp && (
                    <Button variant="outline" size="sm" onClick={() => openWhatsApp(item.lead)} className="gap-2">
                      <MessageCircle className="w-4 h-4" />
                      WhatsApp
                    </Button>
                  )}
                  {item.event.status === 'scheduled' && (
                    <Button
                      size="sm"
                      onClick={() => markEventDone(item)}
                      disabled={savingEventId === item.event.id}
                      className="gap-2"
                    >
                      {savingEventId === item.event.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Concluir
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
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
