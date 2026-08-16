// Busca os resultados reais de uma conta de anúncios da Meta (Gerenciador de Anúncios)
// para alimentar o dashboard do cliente. Chamada pelo front-end (usuário autenticado).
//
// Requer o secret META_SYSTEM_USER_TOKEN configurado no projeto Supabase
// (Project Settings > Edge Functions > Secrets), gerado a partir de um
// "System User" do Business Manager da Meta, com permissão ads_read.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const META_GRAPH_VERSION = 'v21.0';

interface InsightsResult {
  investimento: number;
  impressoes: number;
  cliques: number;
  cpc: number | null;
  ctr: number | null;
  resultados: number | null;
  custo_por_resultado: number | null;
  period_start: string | null;
  period_end: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );
    const { data: claimsData, error: authError } = await authClient.auth.getClaims(
      authHeader.replace('Bearer ', ''),
    );
    if (authError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const userId = claimsData.claims.sub as string;

    const { client_id, date_preset = 'last_30d' } = await req.json();
    if (!client_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'client_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Usa service role só para ler o vínculo cliente -> conta de anúncios,
    // validando que o cliente pertence ao usuário autenticado (RLS manual).
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: client, error: clientError } = await serviceClient
      .from('clients')
      .select('id, user_id, meta_ads_account_id')
      .eq('id', client_id)
      .maybeSingle();

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cliente não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (client.user_id !== userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sem permissão para este cliente' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!client.meta_ads_account_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cliente sem conta de anúncios da Meta vinculada' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const metaToken = Deno.env.get('META_SYSTEM_USER_TOKEN');
    if (!metaToken) {
      console.error('META_SYSTEM_USER_TOKEN not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Integração com a Meta não configurada. Configure o secret META_SYSTEM_USER_TOKEN.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const accountId = client.meta_ads_account_id.startsWith('act_')
      ? client.meta_ads_account_id
      : `act_${client.meta_ads_account_id}`;

    const fields = 'spend,impressions,clicks,cpc,ctr,actions,cost_per_action_type,date_start,date_stop';
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${accountId}/insights?fields=${fields}&date_preset=${date_preset}&access_token=${metaToken}`;

    const metaResponse = await fetch(url);
    const metaData = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error('Meta Graph API error:', metaData);
      return new Response(
        JSON.stringify({
          success: false,
          error: metaData?.error?.message || `Erro ao consultar a API da Meta (status ${metaResponse.status})`,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const row = metaData?.data?.[0];
    if (!row) {
      const empty: InsightsResult = {
        investimento: 0,
        impressoes: 0,
        cliques: 0,
        cpc: null,
        ctr: null,
        resultados: null,
        custo_por_resultado: null,
        period_start: null,
        period_end: null,
      };
      return new Response(
        JSON.stringify({ success: true, data: empty }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // "Resultados" varia por tipo de campanha (leads, conversas iniciadas, compras...).
    // Aqui somamos todas as actions retornadas como proxy de "resultados" —
    // ajuste o filtro por action_type se quiser um resultado específico
    // (ex: 'lead', 'onsite_conversion.messaging_conversation_started_7d').
    const totalResultados = Array.isArray(row.actions)
      ? row.actions.reduce((sum: number, action: { value: string }) => sum + Number(action.value || 0), 0)
      : null;

    const result: InsightsResult = {
      investimento: Number(row.spend || 0),
      impressoes: Number(row.impressions || 0),
      cliques: Number(row.clicks || 0),
      cpc: row.cpc ? Number(row.cpc) : null,
      ctr: row.ctr ? Number(row.ctr) : null,
      resultados: totalResultados,
      custo_por_resultado: totalResultados && totalResultados > 0
        ? Number(row.spend || 0) / totalResultados
        : null,
      period_start: row.date_start || null,
      period_end: row.date_stop || null,
    };

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in meta-ads-insights:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar resultados da Meta';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
