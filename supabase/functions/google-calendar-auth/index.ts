import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const encoder = new TextEncoder();

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

function base64UrlFromBytes(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlFromString(value: string) {
  return base64UrlFromBytes(encoder.encode(value));
}

function base64UrlToString(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return atob(padded);
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return base64UrlFromBytes(new Uint8Array(signature));
}

async function createState(payload: Record<string, unknown>) {
  const body = base64UrlFromString(JSON.stringify(payload));
  const signature = await hmac(body, Deno.env.get('GOOGLE_OAUTH_STATE_SECRET') || env('GOOGLE_CLIENT_SECRET'));
  return `${body}.${signature}`;
}

async function verifyState(state: string) {
  const [body, signature] = state.split('.');
  if (!body || !signature) throw new Error('Estado OAuth invalido');

  const expected = await hmac(body, Deno.env.get('GOOGLE_OAUTH_STATE_SECRET') || env('GOOGLE_CLIENT_SECRET'));
  if (signature !== expected) throw new Error('Estado OAuth nao confirmado');

  const payload = JSON.parse(base64UrlToString(body));
  if (!payload.user_id || !payload.ts) throw new Error('Estado OAuth incompleto');

  const ageMs = Date.now() - Number(payload.ts);
  if (ageMs > 15 * 60 * 1000) throw new Error('Conexao expirada. Tente novamente.');

  return payload as { user_id: string; return_to?: string };
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);

    if (req.method === 'GET' && url.searchParams.get('code')) {
      const code = url.searchParams.get('code') || '';
      const state = await verifyState(url.searchParams.get('state') || '');
      const redirectUri = env('GOOGLE_REDIRECT_URI');

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env('GOOGLE_CLIENT_ID'),
          client_secret: env('GOOGLE_CLIENT_SECRET'),
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      const tokens = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokens.error_description || tokens.error || 'Falha ao conectar Google Agenda');
      if (!tokens.refresh_token) throw new Error('Google nao retornou permissao permanente. Tente conectar novamente.');

      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = userInfoResponse.ok ? await userInfoResponse.json() : {};

      const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
      const expiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString();

      const { error } = await supabase.from('google_calendar_connections').upsert({
        user_id: state.user_id,
        google_email: userInfo.email || null,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        scope: tokens.scope || null,
        token_type: tokens.token_type || 'Bearer',
        calendar_id: 'primary',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      if (error) throw error;

      const returnTo = state.return_to || Deno.env.get('APP_URL') || '/agenda';
      return Response.redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}google_calendar=connected`, 302);
    }

    const { user, supabase } = await getUser(req);
    const body = req.method === 'POST' ? await req.json() : {};
    const action = body.action || 'status';

    if (action === 'auth-url') {
      const redirectUri = env('GOOGLE_REDIRECT_URI');
      const state = await createState({
        user_id: user.id,
        return_to: body.returnTo || Deno.env.get('APP_URL') || '',
        ts: Date.now(),
      });

      const params = new URLSearchParams({
        client_id: env('GOOGLE_CLIENT_ID'),
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: [
          'openid',
          'email',
          'https://www.googleapis.com/auth/calendar.events',
        ].join(' '),
        access_type: 'offline',
        prompt: 'consent',
        state,
      });

      return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
    }

    if (action === 'disconnect') {
      const { error } = await supabase
        .from('google_calendar_connections')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      return json({ connected: false });
    }

    const { data, error } = await supabase
      .from('google_calendar_connections')
      .select('google_email, expires_at, calendar_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    return json({
      connected: Boolean(data),
      google_email: data?.google_email || null,
      expires_at: data?.expires_at || null,
      calendar_id: data?.calendar_id || 'primary',
    });
  } catch (error) {
    console.error(error);
    return json({ error: error.message || 'Erro na integracao com Google Agenda' }, 400);
  }
});
