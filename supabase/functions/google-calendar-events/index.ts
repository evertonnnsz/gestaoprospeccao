import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  commercial_meeting: 'Reunião comercial',
  proposal_meeting: 'Reunião de proposta',
  onboarding: 'Onboarding',
  results_meeting: 'Reunião de resultado',
  operational_task: 'Demanda operacional',
  other: 'Outra demanda',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} nao configurado`);
  return value;
}

async function getUser(req: Request) {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) throw new Error('Sessao nao encontrada');

  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('Sessao invalida');

  return { user: data.user, supabase };
}

async function refreshAccessToken(connection: any, supabase: any) {
  if (new Date(connection.expires_at).getTime() > Date.now() + 60 * 1000) {
    return connection.access_token;
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      refresh_token: connection.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const refreshed = await response.json();
  if (!response.ok) throw new Error(refreshed.error_description || refreshed.error || 'Falha ao renovar acesso ao Google');

  const expiresAt = new Date(Date.now() + Number(refreshed.expires_in || 3600) * 1000).toISOString();
  const { error } = await supabase
    .from('google_calendar_connections')
    .update({
      access_token: refreshed.access_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id);

  if (error) throw error;
  return refreshed.access_token;
}

function addMinutes(dateTime: string, minutes: number) {
  const match = dateTime.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return dateTime;

  const [, date, hours, mins, seconds] = match;
  const totalMinutes = Number(hours) * 60 + Number(mins) + minutes;
  const nextHours = Math.floor(totalMinutes / 60) % 24;
  const nextMinutes = totalMinutes % 60;

  return `${date}T${String(nextHours).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}:${seconds}`;
}

function buildEvent(agendaEvent: any, lead: any | null, timeZone: string) {
  const startDateTime = `${agendaEvent.scheduled_date}T${String(agendaEvent.scheduled_time || '09:00').slice(0, 5)}:00`;
  const endDateTime = addMinutes(startDateTime, agendaEvent.duration_minutes || 60);

  const description = [
    `Tipo: ${EVENT_TYPE_LABELS[agendaEvent.event_type] || agendaEvent.event_type}`,
    lead?.contact_name ? `Contato: ${lead.contact_name}` : null,
    lead?.whatsapp ? `WhatsApp: ${lead.whatsapp}` : null,
    lead?.segment ? `Segmento: ${lead.segment}` : null,
    agendaEvent.guest_email ? `Convidado: ${agendaEvent.guest_email}` : null,
    agendaEvent.notes ? `Observações: ${agendaEvent.notes}` : null,
    lead?.observations ? `Observações do lead: ${lead.observations}` : null,
  ].filter(Boolean).join('\n');

  return {
    summary: agendaEvent.title,
    description,
    start: { dateTime: startDateTime, timeZone },
    end: { dateTime: endDateTime, timeZone },
    attendees: agendaEvent.guest_email ? [{ email: agendaEvent.guest_email }] : undefined,
    _localStart: startDateTime,
    _localEnd: endDateTime,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { user, supabase } = await getUser(req);
    const body = await req.json();

    if (body.action !== 'create') {
      return json({ error: 'Acao invalida' }, 400);
    }

    const { agendaEventId, timeZone = 'America/Sao_Paulo' } = body;
    if (!agendaEventId) {
      return json({ error: 'Compromisso da agenda e obrigatorio' }, 400);
    }

    const { data: connection, error: connectionError } = await supabase
      .from('google_calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (connectionError) throw connectionError;
    if (!connection) throw new Error('Google Agenda ainda nao conectado');

    const { data: agendaEvent, error: agendaError } = await supabase
      .from('agenda_events')
      .select('*')
      .eq('id', agendaEventId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (agendaError) throw agendaError;
    if (!agendaEvent) throw new Error('Compromisso nao encontrado');

    let lead = null;
    if (agendaEvent.lead_id) {
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', agendaEvent.lead_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (leadError) throw leadError;
      lead = leadData;
    }

    const eventPayload = buildEvent(agendaEvent, lead, timeZone);
    const accessToken = await refreshAccessToken(connection, supabase);
    const calendarId = encodeURIComponent(connection.calendar_id || 'primary');
    const sendUpdates = eventPayload.attendees ? '?sendUpdates=all' : '';
    const eventResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events${sendUpdates}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: eventPayload.summary,
        description: eventPayload.description,
        start: eventPayload.start,
        end: eventPayload.end,
        attendees: eventPayload.attendees,
      }),
    });

    const googleEvent = await eventResponse.json();
    if (!eventResponse.ok) {
      throw new Error(googleEvent.error?.message || 'Falha ao criar evento no Google Agenda');
    }

    const { error: updateError } = await supabase
      .from('agenda_events')
      .update({
        google_event_id: googleEvent.id,
        google_event_link: googleEvent.htmlLink || null,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', agendaEvent.id);

    if (updateError) throw updateError;

    return json({
      event_id: googleEvent.id,
      html_link: googleEvent.htmlLink || null,
      starts_at: eventPayload._localStart,
      ends_at: eventPayload._localEnd,
    });
  } catch (error) {
    console.error(error);
    return json({ error: error.message || 'Erro ao criar evento no Google Agenda' }, 400);
  }
});
