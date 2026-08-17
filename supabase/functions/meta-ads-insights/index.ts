// Busca resultados reais de uma conta de anúncios da Meta (Gerenciador de Anúncios).
// Retorna: agregado, campanhas (com engajamento/vídeo), série temporal diária e melhor criativo.
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

const num = (v: unknown): number => Number(v || 0);

const actionValue = (actions: ActionRow[] | undefined, type: string): number | null => {
  if (!Array.isArray(actions)) return null;
  const found = actions.find((a) => a.action_type === type);
  return found ? num(found.value) : null;
};

// Escolhe o PRIMEIRO tipo disponível (nunca soma tipos sobrepostos)
const firstAction = (actions: ActionRow[] | undefined, types: string[]): number | null => {
  for (const t of types) {
    const v = actionValue(actions, t);
    if (v !== null) return v;
  }
  return null;
};

const MESSAGING_TYPES = [
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.messaging_conversation_started',
  'onsite_conversion.messaging_first_reply',
  'onsite_conversion.total_messaging_connection',
];
const LEAD_TYPES = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead'];
const PURCHASE_TYPES = ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase', 'onsite_conversion.purchase'];
const LINK_CLICK_TYPES = ['link_click'];
const ENGAGEMENT_TYPES = ['post_engagement', 'page_engagement', 'video_view'];

const isMessagingSetup = (optimizationGoals: string[], destinations: string[]): boolean => {
  const all = [...optimizationGoals, ...destinations].map((v) => (v || '').toUpperCase());
  return all.some((v) =>
    v.includes('CONVERSATION') || v.includes('MESSAG') || v.includes('WHATSAPP') || v.includes('MESSENGER') || v.includes('INSTAGRAM_DIRECT'),
  );
};

interface ObjectiveContext {
  objective?: string | null;
  optimizationGoals?: string[];
  destinations?: string[];
}

function resolveResult(ctx: ObjectiveContext, row: any): ResultInfo {
  const actions: ActionRow[] = row?.actions || [];
  const obj = (ctx.objective || '').toUpperCase();
  const spend = num(row?.spend);

  const build = (value: number | null, label: string): ResultInfo => ({
    value,
    label,
    cost: value && value > 0 ? spend / value : null,
  });

  // Destino/otimização por mensagens tem prioridade sobre o objetivo declarado
  if (isMessagingSetup(ctx.optimizationGoals || [], ctx.destinations || [])) {
    const msgs = firstAction(actions, MESSAGING_TYPES);
    if (msgs !== null) return build(msgs, 'Conversas iniciadas');
  }

  if (obj.includes('MESSAGE') || obj.includes('MESSAGING')) {
    return build(firstAction(actions, MESSAGING_TYPES), 'Conversas iniciadas');
  }
  if (obj.includes('LEAD')) {
    return build(firstAction(actions, LEAD_TYPES), 'Leads');
  }
  if (obj.includes('CONVERSION') || obj.includes('SALES') || obj.includes('CATALOG') || obj.includes('PRODUCT')) {
    const purchases = firstAction(actions, PURCHASE_TYPES);
    if (purchases !== null) return build(purchases, 'Compras / conversões');
  }
  if (obj.includes('TRAFFIC') || obj.includes('LINK_CLICKS')) {
    const clicks = firstAction(actions, LINK_CLICK_TYPES);
    if (clicks !== null) return build(clicks, 'Cliques no link');
  }
  if (obj.includes('AWARENESS') || obj.includes('REACH') || obj.includes('BRAND')) {
    const reach = row?.reach ? num(row.reach) : null;
    if (reach !== null) return build(reach, 'Alcance');
  }
  if (obj.includes('ENGAGEMENT') || obj.includes('VIDEO_VIEWS') || obj.includes('POST_ENGAGEMENT')) {
    const eng = firstAction(actions, ENGAGEMENT_TYPES);
    if (eng !== null) return build(eng, 'Engajamento');
  }

  // Fallback (sempre aplicado, inclusive quando há campanha filtrada)
  const fallbacks: Array<[string[], string]> = [
    [PURCHASE_TYPES, 'Compras / conversões'],
    [LEAD_TYPES, 'Leads'],
    [MESSAGING_TYPES, 'Conversas iniciadas'],
    [LINK_CLICK_TYPES, 'Cliques no link'],
    [ENGAGEMENT_TYPES, 'Engajamento'],
  ];
  for (const [types, label] of fallbacks) {
    const value = firstAction(actions, types);
    if (value !== null) return build(value, label);
  }
  const reach = row?.reach ? num(row.reach) : null;
  if (reach) return build(reach, 'Alcance');
  return build(null, 'Resultados');
}

function buildEngagement(row: any) {
  const actions: ActionRow[] = row?.actions || [];
  const data = {
    reacoes: actionValue(actions, 'post_reaction'),
    comentarios: actionValue(actions, 'comment'),
    compartilhamentos: actionValue(actions, 'post'),
    salvamentos: actionValue(actions, 'onsite_conversion.post_save'),
    engajamento_publicacao: actionValue(actions, 'post_engagement'),
    engajamento_pagina: actionValue(actions, 'page_engagement'),
    cliques_link: actionValue(actions, 'link_click'),
    visitas_pagina: actionValue(actions, 'landing_page_view'),
  };
  const hasAny = Object.values(data).some((v) => v !== null && v !== 0);
  return hasAny ? data : null;
}

const firstValue = (arr: any): number | null =>
  Array.isArray(arr) && arr.length > 0 ? num(arr[0]?.value) : null;

function buildVideo(row: any) {
  const data = {
    thruplay: firstValue(row?.video_thruplay_watched_actions),
    views_3s: firstValue(row?.video_play_actions),
    p25: firstValue(row?.video_p25_watched_actions),
    p50: firstValue(row?.video_p50_watched_actions),
    p75: firstValue(row?.video_p75_watched_actions),
    p100: firstValue(row?.video_p100_watched_actions),
    tempo_medio: firstValue(row?.video_avg_time_watched_actions),
  };
  const hasAny = Object.values(data).some((v) => v !== null && v !== 0);
  return hasAny ? data : null;
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

function toMetrics(row: any, ctx: ObjectiveContext): Metrics {
  const result = resolveResult(ctx, row);
  const impressoes = num(row?.impressions);
  const spend = num(row?.spend);
  const reach = row?.reach ? num(row.reach) : null;
  return {
    investimento: spend,
    impressoes,
    alcance: reach,
    frequencia: row?.frequency ? num(row.frequency) : (reach && reach > 0 ? impressoes / reach : null),
    cliques: num(row?.clicks),
    cpc: row?.cpc ? num(row.cpc) : null,
    cpm: row?.cpm ? num(row.cpm) : (impressoes > 0 ? (spend / impressoes) * 1000 : null),
    ctr: row?.ctr ? num(row.ctr) : null,
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
const VIDEO_FIELDS = 'video_thruplay_watched_actions,video_play_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_avg_time_watched_actions';
const INSIGHT_FIELDS = `spend,impressions,reach,frequency,clicks,cpc,cpm,ctr,actions,date_start,date_stop,${VIDEO_FIELDS}`;

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

    const isCustom = Boolean(since && until);
    const preset = ALLOWED_PRESETS.includes(date_preset) ? date_preset : 'last_30d';
    const rangeParam = isCustom
      ? `time_range=${encodeURIComponent(JSON.stringify({ since, until }))}`
      : `date_preset=${preset}`;
    const nestedRange = isCustom
      ? `time_range(${encodeURIComponent(JSON.stringify({ since, until }))})`
      : `date_preset(${preset})`;

    const base = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
    const auth = `access_token=${metaToken}`;
    const insightsNode = campaign_id ? campaign_id : accountId;

    const accountUrl = `${base}/${insightsNode}/insights?fields=${INSIGHT_FIELDS}&${rangeParam}&${auth}`;
    const seriesUrl = `${base}/${insightsNode}/insights?fields=spend,impressions,clicks,reach&${rangeParam}&time_increment=1&limit=200&${auth}`;
    const campaignsUrl = `${base}/${accountId}/campaigns?fields=id,name,objective,status,insights.${nestedRange}{${INSIGHT_FIELDS}}&limit=200&${auth}`;
    const adsetsUrl = `${base}/${accountId}/adsets?fields=id,campaign_id,optimization_goal,destination_type&limit=500&${auth}`;
    const adsUrl = `${base}/${insightsNode}/insights?level=ad&fields=ad_id,ad_name,campaign_id,campaign_name,spend,impressions,clicks,actions&${rangeParam}&limit=200&${auth}`;

    const fetchJson = async (url: string) => {
      const res = await fetch(url);
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    };

    const [accountRes, seriesRes, campaignsRes, adsetsRes, adsRes] = await Promise.all([
      fetchJson(accountUrl),
      fetchJson(seriesUrl),
      fetchJson(campaignsUrl),
      fetchJson(adsetsUrl),
      fetchJson(adsUrl),
    ]);

    if (!accountRes.ok) {
      console.error('Meta Graph API error:', accountRes.data);
      return json({
        success: false,
        error: accountRes.data?.error?.message || `Erro ao consultar a API da Meta (status ${accountRes.status})`,
      }, 502);
    }

    // Otimização / destino por campanha (via conjuntos de anúncios)
    const setupByCampaign = new Map<string, { goals: string[]; destinations: string[] }>();
    if (adsetsRes.ok) {
      for (const s of adsetsRes.data?.data || []) {
        const key = s.campaign_id;
        if (!key) continue;
        const entry = setupByCampaign.get(key) || { goals: [], destinations: [] };
        if (s.optimization_goal) entry.goals.push(s.optimization_goal);
        if (s.destination_type) entry.destinations.push(s.destination_type);
        setupByCampaign.set(key, entry);
      }
    } else {
      console.error('Meta adsets error:', adsetsRes.data);
    }

    const ctxFor = (campaignId: string | null | undefined, objective: string | null | undefined): ObjectiveContext => {
      const setup = campaignId ? setupByCampaign.get(campaignId) : undefined;
      return { objective, optimizationGoals: setup?.goals || [], destinations: setup?.destinations || [] };
    };

    const campaignRows = campaignsRes.ok ? (campaignsRes.data?.data || []) : [];
    if (!campaignsRes.ok) {
      console.error('Meta campaigns error:', campaignsRes.data);
    }

    const campaigns = campaignRows.map((c: any) => {
      const insightRow = c?.insights?.data?.[0];
      const ctx = ctxFor(c.id, c.objective);
      const metrics = insightRow ? toMetrics(insightRow, ctx) : emptyMetrics();
      return {
        id: c.id,
        name: c.name,
        objective: c.objective || null,
        status: c.status || null,
        ...metrics,
        engajamento: insightRow ? buildEngagement(insightRow) : null,
        video: insightRow ? buildVideo(insightRow) : null,
      };
    });

    const selectedCampaign = campaign_id ? campaignRows.find((c: any) => c.id === campaign_id) : null;
    const dominant = [...campaigns].sort((a, b) => b.investimento - a.investimento)[0];
    const aggregateCampaignId = campaign_id || dominant?.id || null;
    const aggregateObjective = selectedCampaign?.objective || dominant?.objective || null;
    const aggregateCtx = ctxFor(aggregateCampaignId, aggregateObjective);

    const accountRow = accountRes.data?.data?.[0];
    const account: Metrics & { engajamento?: unknown; video?: unknown } = accountRow
      ? toMetrics(accountRow, aggregateCtx)
      : emptyMetrics();
    if (accountRow) {
      account.engajamento = buildEngagement(accountRow);
      account.video = buildVideo(accountRow);
    }

    // Sem campanha filtrada: soma dos resultados corretos de cada campanha
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
      investimento: num(row.spend),
      impressoes: num(row.impressions),
      cliques: num(row.clicks),
      alcance: row.reach ? num(row.reach) : 0,
    }));

    // ===== Melhor criativo: menor custo por resultado entre os anúncios do período =====
    let best_creative: Record<string, unknown> | null = null;
    if (adsRes.ok) {
      const objectiveByCampaign = new Map<string, string | null>(
        campaignRows.map((c: any) => [c.id, c.objective || null]),
      );
      const scored = (adsRes.data?.data || [])
        .map((row: any) => {
          const ctx = ctxFor(row.campaign_id, objectiveByCampaign.get(row.campaign_id) || null);
          const result = resolveResult(ctx, row);
          return {
            ad_id: row.ad_id,
            ad_name: row.ad_name,
            campaign_id: row.campaign_id,
            campaign_name: row.campaign_name,
            investimento: num(row.spend),
            impressoes: num(row.impressions),
            cliques: num(row.clicks),
            resultado: result.value,
            resultado_label: result.label,
            custo_por_resultado: result.cost,
          };
        })
        .filter((a: any) => a.resultado && a.resultado > 0 && a.custo_por_resultado !== null)
        .sort((a: any, b: any) => (a.custo_por_resultado || 0) - (b.custo_por_resultado || 0));

      const winner = scored[0];
      if (winner) {
        const creativeUrl = `${base}/${winner.ad_id}?fields=name,creative{thumbnail_url,image_url,object_story_spec,effective_object_story_id}&${auth}`;
        const creativeRes = await fetchJson(creativeUrl);
        const creative = creativeRes.ok ? creativeRes.data?.creative : null;
        best_creative = {
          ...winner,
          thumbnail_url: creative?.thumbnail_url || creative?.image_url || null,
          is_video: Boolean(creative?.object_story_spec?.video_data),
        };
      }
    } else {
      console.error('Meta ads insights error:', adsRes.data);
    }

    return json({
      success: true,
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
      best_creative,
    });
  } catch (error) {
    console.error('Error in meta-ads-insights:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar resultados da Meta';
    return json({ success: false, error: errorMessage }, 500);
  }
});
