import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

function buildEvent(lead: any, startDateTime: string, endDateTime: string, timeZone: string, meetingNotes?: string | null) {
  const description = [
    lead.contact_name ? `Contato: ${lead.contact_name}` : null,
    lead.whatsapp ? `WhatsApp: ${lead.whatsapp}` : null,
    lead.segment ? `Segmento: ${lead.segment}` : null,
    lead.next_action ? `Proxima acao: ${lead.next_action}` : null,
    meetingNotes ? `Observacoes da reuniao: ${meetingNotes}` : null,
    lead.observations ? `Observacoes: ${lead.observations}` : null,
  ].filter(Boolean).join('\n');

  return {
    summary: `Reuniao - ${lead.company_name}`,
    description,
    start: { dateTime: startDateTime, timeZone },
    end: { dateTime: endDateTime, timeZone },
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

    const { leadId, startDateTime, endDateTime, timeZone = 'America/Sao_Paulo', meetingNotes = null } = body;
    if (!leadId || !startDateTime || !endDateTime) {
      return json({ error: 'Lead, inicio e fim do evento sao obrigatorios' }, 400);
    }

    const { data: connection, error: connectionError } = await supabase
      .from('google_calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (connectionError) throw connectionError;
    if (!connection) throw new Error('Google Agenda ainda nao conectado');

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (leadError) throw leadError;
    if (!lead) throw new Error('Lead nao encontrado');

    const accessToken = await refreshAccessToken(connection, supabase);
    const calendarId = encodeURIComponent(connection.calendar_id || 'primary');
    const eventResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildEvent(lead, startDateTime, endDateTime, timeZone, meetingNotes)),
    });

    const event = await eventResponse.json();
    if (!eventResponse.ok) {
      throw new Error(event.error?.message || 'Falha ao criar evento no Google Agenda');
    }

    const { error: linkError } = await supabase
      .from('google_calendar_event_links')
      .insert({
        user_id: user.id,
        lead_id: lead.id,
        google_event_id: event.id,
        google_event_link: event.htmlLink || null,
        starts_at: startDateTime,
        ends_at: endDateTime,
        status: 'created',
      });

    if (linkError) throw linkError;

    return json({
      event_id: event.id,
      html_link: event.htmlLink || null,
      starts_at: startDateTime,
      ends_at: endDateTime,
    });
  } catch (error) {
    console.error(error);
    return json({ error: error.message || 'Erro ao criar evento no Google Agenda' }, 400);
  }
});
