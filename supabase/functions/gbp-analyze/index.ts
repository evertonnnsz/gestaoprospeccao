// Diagnóstico de Google Meu Negócio com dados públicos do Google Maps (SerpAPI).
//
// Duas ações:
// - { action: 'search', query }  -> lista de perfis encontrados para o usuário escolher (1 crédito)
// - { action: 'analyze', place_id, lead_id?, client_id?, max_reviews? }
//     -> perfil + avaliações + concorrentes da região, calcula nota/checklist e salva em gbp_analyses.
//     Custo aproximado: 2 créditos + 1 a cada 20 avaliações.
//
// Secret necessário: SERPAPI_KEY (o mesmo usado na Prospecção).

import {
  buildChecklist,
  computeCategories,
  computeCompetition,
  computeReviewStats,
  computeScore,
  normalizeCompetitor,
  normalizePlace,
  normalizeReview,
} from './analysis.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DEFAULT_MAX_REVIEWS = 100;
const MAX_REVIEWS_LIMIT = 500;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function serpapi(params: Record<string, string>) {
  const url = new URL('https://serpapi.com/search.json');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set('api_key', Deno.env.get('SERPAPI_KEY')!);
  const response = await fetch(url.toString());
  const data = await response.json();
  if (!response.ok || data.error) {
    const message = String(data.error || `Erro na SerpAPI (${response.status})`);
    // "Google hasn't returned any results" não é erro para listas vazias.
    if (/hasn't returned any results/i.test(message)) return {};
    throw new Error(message);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ success: false, error: 'Unauthorized' }, 401);

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    // Cliente com o token do usuário: o insert respeita o RLS de gbp_analyses.
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (authError || !claimsData?.claims) return json({ success: false, error: 'Unauthorized' }, 401);
    const userId = claimsData.claims.sub as string;

    if (!Deno.env.get('SERPAPI_KEY')) {
      return json({ success: false, error: 'Chave da SerpAPI não configurada (SERPAPI_KEY).' }, 500);
    }

    const body = await req.json();

    if (body.action === 'search') {
      const query = String(body.query || '').trim();
      if (!query) return json({ success: false, error: 'Informe o nome da empresa e a cidade.' }, 400);
      const data = await serpapi({ engine: 'google_maps', q: query, hl: 'pt-br', gl: 'br', type: 'search' });
      const results = data.place_results ? [data.place_results] : (data.local_results || []).slice(0, 10);
      return json({
        success: true,
        candidates: results.map((r: any) => ({
          title: r.title,
          address: r.address || null,
          rating: r.rating ?? null,
          reviews: r.reviews ?? null,
          category: Array.isArray(r.type) ? r.type[0] : r.type || null,
          thumbnail: r.thumbnail || null,
          place_id: r.place_id || null,
          data_id: r.data_id || null,
        })),
      });
    }

    if (body.action !== 'analyze') return json({ success: false, error: 'Ação inválida.' }, 400);
    if (!body.place_id) return json({ success: false, error: 'Escolha um perfil para analisar.' }, 400);

    // 1. Perfil
    const placeData = await serpapi({ engine: 'google_maps', place_id: body.place_id, hl: 'pt-br', gl: 'br' });
    const rawPlace = placeData.place_results;
    if (!rawPlace) return json({ success: false, error: 'Perfil não encontrado no Google Maps.' }, 404);
    const profile = normalizePlace(rawPlace);
    const dataId = profile.data_id || body.data_id;
    if (!profile.data_id && dataId) profile.data_id = dataId;

    // 2. Avaliações mais recentes (a primeira página traz até 8; as seguintes, 20)
    const maxReviews = Math.min(Number(body.max_reviews) || DEFAULT_MAX_REVIEWS, MAX_REVIEWS_LIMIT);
    const rawReviews: any[] = [];
    let nextPageToken: string | undefined;
    while (dataId && rawReviews.length < maxReviews) {
      const params: Record<string, string> = {
        engine: 'google_maps_reviews',
        data_id: dataId,
        hl: 'pt-br',
        sort_by: 'newestFirst',
      };
      if (nextPageToken) {
        params.next_page_token = nextPageToken;
        params.num = '20';
      }
      const page = await serpapi(params);
      rawReviews.push(...(page.reviews || []));
      nextPageToken = page.serpapi_pagination?.next_page_token;
      if (!nextPageToken || !(page.reviews || []).length) break;
    }
    const reviews = rawReviews.slice(0, maxReviews).map(normalizeReview);

    // 3. Concorrentes: mesma categoria principal, na região do perfil
    let competitors: ReturnType<typeof normalizeCompetitor>[] = [];
    if (profile.categories[0] && profile.gps) {
      const nearby = await serpapi({
        engine: 'google_maps',
        q: profile.categories[0],
        ll: `@${profile.gps.latitude},${profile.gps.longitude},14z`,
        hl: 'pt-br',
        gl: 'br',
        type: 'search',
      });
      competitors = (nearby.local_results || []).map((r: any) => normalizeCompetitor(r, profile));
    }

    const stats = computeReviewStats(reviews);
    const competition = computeCompetition(profile, competitors);
    const categories = computeCategories(profile, competitors);
    const checklist = buildChecklist(profile, stats, competition);
    const score = computeScore(checklist);

    const { data: saved, error: saveError } = await supabase
      .from('gbp_analyses')
      .insert({
        user_id: userId,
        lead_id: body.lead_id || null,
        client_id: body.client_id || null,
        place_id: profile.place_id,
        data_id: profile.data_id,
        business_name: profile.title,
        address: profile.address,
        score,
        reviews_analyzed: reviews.length,
        profile,
        checklist,
        competitors: competition,
        reviews: stats,
        categories,
      })
      .select()
      .single();
    if (saveError) throw saveError;

    return json({ success: true, analysis: saved });
  } catch (error) {
    console.error('Error in gbp-analyze:', error);
    const message = error instanceof Error ? error.message : (error as any)?.message || 'Erro inesperado';
    return json({ success: false, error: message }, 500);
  }
});
