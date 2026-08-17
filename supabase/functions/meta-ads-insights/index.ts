// Busca resultados reais de uma conta de anúncios da Meta (Gerenciador de Anúncios).
// Retorna: agregado da conta, lista de campanhas com insights e série temporal diária.
// Requer o secret META_SYSTEM_USER_TOKEN (System User com ads_read).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const META_GRAPH_VERSION = 'v21.0';

type ActionRow = { action_type: string; value: string };

interface ResultInfo {
  value: number | null;
  label: string;
  cost: number | null;
}

interface Metrics {
  investimento: number;
  impressoes: number;
  alcance: number | null;
  frequencia: number | null;
  cliques: number;
  cpc: number | null;
  cpm: number | null;
  ctr: number | null;
  resultado: number | null;
  resultado_label: string;
  custo_por_resultado: number | null;
  period_start: string | null;
  period_end: string | null;
}

const sumActions = (actions: ActionRow[] | undefined, types: string[]): number | null => {
  if (!Array.isArray(actions)) return null;
  const matched = actions.filter((a) => types.includes(a.action_type));
  if (matched.length === 0) return null;
  return matched.reduce((sum, a) => sum + Number(a.value || 0), 0);
};

// Mapa objetivo -> action_types + rótulo
function resolveResult(objective: string | null | undefined, row: any): ResultInfo {
  const actions: ActionRow[] = row?.actions || [];
  const obj = (objective || '').toUpperCase();
  const spend = Number(row?.spend || 0);

  const build = (value: number | null, label: string): ResultInfo => ({
    value,
    label,
    cost: value && value > 0 ? spend / value : null,
  });

  const messaging = [
    'onsite_conversion.messaging_conversation_started_7d',
    'onsite_conversion.total_messaging_connection',
  ];
  const leads = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'];
  const purchases = ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'];
  const linkClicks = ['link_click'];
  const engagement = ['post_engagement', 'page_engagement', 'video_view'];

  if (obj.includes('MESSAGE') || obj.includes('MESSAGING')) {
    return build(sumActions(actions, messaging), 'Conversas iniciadas');
  }
  if (obj.includes('LEAD')) {
    return build(sumActions(actions, leads), 'Leads');
  }
  if (obj.includes('CONVERSION') || obj.includes('SALES') || obj.includes('CATALOG') || obj.includes('PRODUCT')) {
    return build(sumActions(actions, purchases), 'Compras / conversões');
  }
  if (obj.includes('TRAFFIC') || obj.includes('LINK_CLICKS')) {
    return build(sumActions(actions, linkClicks), 'Cliques no link');
  }
  if (obj.includes('AWARENESS') || obj.includes('REACH') || obj.includes('BRAND')) {
    const reach = row?.reach ? Number(row.reach) : null;
    return build(reach, 'Alcance');
  }
  if (obj.includes('ENGAGEMENT') || obj.includes('VIDEO_VIEWS') || obj.includes('POST_ENGAGEMENT')) {
    return build(sumActions(actions, engagement), 'Engajamento');
  }

  // Fallback: escolhe a melhor ação disponível na ordem de valor de negócio
  const fallbacks: Array<[string[], string]> = [
    [purchases, 'Compras / conversões'],
    [leads, 'Leads'],
    [messaging, 'Conversas iniciadas'],
    [linkClicks, 'Cliques no link'],
    [engagement, 'Engajamento'],
  ];
  for (const [types, label] of fallbacks) {
    const value = sumActions(actions, types);
    if (value !== null) return build(value, label);
  }
  return build(null, 'Resultados');
}

function toMetrics(row: any, objective?: string | null): Metrics {
  const result = resolveResult(objective, row);
  const impressoes = Number(row?.impressions || 0);
  const spend = Number(row?.spend || 0);
  const reach = row?.reach ? Number(row.reach) : null;
  return {
    investimento: spend,
    impressoes,
    alcance: reach,
    frequencia: row?.frequency ? Number(row.frequency) : (reach && reach > 0 ? impressoes / reach : null),
    cliques: Number(row?.clicks || 0),
    cpc: row?.cpc ? Number(row.cpc) : null,
    cpm: row?.cpm ? Number(row.cpm) : (impressoes > 0 ? (spend / impressoes) * 1000 : null),
    ctr: row?.ctr ? Number(row.ctr) : null,
    resultado: result.value,
    resultado_label: result.label,
    custo_por_resultado: result.cost,
    period_start: row?.date_start || null,
    period_end: row?.date_stop || null,
  };
}

const emptyMetrics = (): Metrics => ({
  investimento: 0,
  impressoes: 0,
  alcance: null,
  frequencia: null,
  cliques: 0,
  cpc: null,
  cpm: null,
  ctr: null,
  resultado: null,
  resultado_label: 'Resultados',
  custo_por_resultado: null,
  period_start: null,
  period_end: null,
});

const ALLOWED_PRESETS = ['last_7d', 'last_14d', 'last_30d', 'last_90d'];
const INSIGHT_FIELDS = 'spend,impressions,reach,frequency,clicks,cpc,cpm,ctr,actions,date_start,date_stop';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ success: false, error: 'Unauthorized' }, 401);
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
      return json({ success: false, error: 'Unauthorized' }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const { client_id, date_preset = 'last_30d', since, until, campaign_id } = body ?? {};
    if (!client_id) {
      return json({ success: false, error: 'client_id é obrigatório' }, 400);
    }

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
      return json({ success: false, error: 'Cliente não encontrado' }, 404);
    }
    if (client.user_id !== userId) {
      return json({ success: false, error: 'Sem permissão para este cliente' }, 403);
    }
    if (!client.meta_ads_account_id) {
      return json({ success: false, error: 'Cliente sem conta de anúncios da Meta vinculada' }, 422);
    }

    const metaToken = Deno.env.get('META_SYSTEM_USER_TOKEN');
    if (!metaToken) {
      console.error('META_SYSTEM_USER_TOKEN not configured');
      return json({ success: false, error: 'Integração com a Meta não configurada. Configure o secret META_SYSTEM_USER_TOKEN.' }, 500);
    }

    const accountId = client.meta_ads_account_id.startsWith('act_')
      ? client.meta_ads_account_id
      : `act_${client.meta_ads_account_id}`;

    // Janela de datas: intervalo customizado tem prioridade sobre o preset
    const isCustom = Boolean(since && until);
    const preset = ALLOWED_PRESETS.includes(date_preset) ? date_preset : 'last_30d';
    const rangeParam = isCustom
      ? `time_range=${encodeURIComponent(JSON.stringify({ since, until }))}`
      : `date_preset=${preset}`;

    const base = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
    const auth = `access_token=${metaToken}`;
    const insightsNode = campaign_id ? campaign_id : accountId;

    const accountUrl = `${base}/${insightsNode}/insights?fields=${INSIGHT_FIELDS}&${rangeParam}&${auth}`;
    const seriesUrl = `${base}/${insightsNode}/insights?fields=spend,impressions,clicks,reach&${rangeParam}&time_increment=1&limit=200&${auth}`;
    const campaignsUrl = `${base}/${accountId}/campaigns?fields=id,name,objective,status,insights.${isCustom ? `time_range(${encodeURIComponent(JSON.stringify({ since, until }))})` : `date_preset(${preset})`}{${INSIGHT_FIELDS}}&limit=200&${auth}`;

    const fetchJson = async (url: string) => {
      const res = await fetch(url);
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    };

    const [accountRes, seriesRes, campaignsRes] = await Promise.all([
      fetchJson(accountUrl),
      fetchJson(seriesUrl),
      fetchJson(campaignsUrl),
    ]);

    if (!accountRes.ok) {
      console.error('Meta Graph API error:', accountRes.data);
      return json({
        success: false,
        error: accountRes.data?.error?.message || `Erro ao consultar a API da Meta (status ${accountRes.status})`,
      }, 502);
    }

    const campaignRows = campaignsRes.ok ? (campaignsRes.data?.data || []) : [];
    if (!campaignsRes.ok) {
      console.error('Meta campaigns error:', campaignsRes.data);
    }

    const campaigns = campaignRows.map((c: any) => {
      const insightRow = c?.insights?.data?.[0];
      const metrics = insightRow ? toMetrics(insightRow, c.objective) : emptyMetrics();
      return {
        id: c.id,
        name: c.name,
        objective: c.objective || null,
        status: c.status || null,
        ...metrics,
      };
    });

    // Agregado: se filtrou campanha, usa o objetivo dela; senão usa o objetivo dominante (maior investimento)
    const selectedCampaign = campaign_id ? campaignRows.find((c: any) => c.id === campaign_id) : null;
    const dominant = [...campaigns].sort((a, b) => b.investimento - a.investimento)[0];
    const aggregateObjective = selectedCampaign?.objective || dominant?.objective || null;

    const accountRow = accountRes.data?.data?.[0];
    const account = accountRow ? toMetrics(accountRow, aggregateObjective) : emptyMetrics();

    // Quando não há campanha filtrada, o resultado correto é a soma por objetivo de cada campanha
    if (!campaign_id && campaigns.length > 0) {
      const withResults = campaigns.filter((c) => c.resultado !== null);
      if (withResults.length > 0) {
        const total = withResults.reduce((sum, c) => sum + (c.resultado || 0), 0);
        const labels = Array.from(new Set(withResults.map((c) => c.resultado_label)));
        account.resultado = total;
        account.resultado_label = labels.length === 1 ? labels[0] : 'Resultados (por objetivo)';
        account.custo_por_resultado = total > 0 ? account.investimento / total : null;
      }
    }

    const timeseries = (seriesRes.ok ? (seriesRes.data?.data || []) : []).map((row: any) => ({
      date: row.date_start,
      investimento: Number(row.spend || 0),
      impressoes: Number(row.impressions || 0),
      cliques: Number(row.clicks || 0),
      alcance: row.reach ? Number(row.reach) : 0,
    }));

    return json({
      success: true,
      // compatibilidade com a versão anterior do painel
      data: {
        investimento: account.investimento,
        impressoes: account.impressoes,
        cliques: account.cliques,
        cpc: account.cpc,
        ctr: account.ctr,
        resultados: account.resultado,
        custo_por_resultado: account.custo_por_resultado,
        period_start: account.period_start,
        period_end: account.period_end,
      },
      account,
      campaigns,
      timeseries,
    });
  } catch (error) {
    console.error('Error in meta-ads-insights:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar resultados da Meta';
    return json({ success: false, error: errorMessage }, 500);
  }
});
