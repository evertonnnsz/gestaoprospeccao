// Diagnóstico de Google Meu Negócio com dados públicos do Google Maps (SerpAPI).
//
// Ações:
// - { action: 'search', query }  -> lista de perfis encontrados para o usuário escolher (1 crédito)
// - { action: 'analyze', place_id, lead_id?, client_id?, max_reviews? }
//     -> perfil + avaliações + concorrentes da região, calcula nota/checklist e salva em gbp_analyses.
//     Custo aproximado: 2 créditos + 1 a cada 20 avaliações.
// - { action: 'categories', query, pages? }  -> categorias usadas pelos perfis que aparecem na busca (1 crédito por página)
// - { action: 'trends', terms[], geo? }      -> interesse no Google Trends nos últimos 12 meses (1 crédito)
// - { action: 'resolve', url | place_id }    -> lê o perfil a partir do link do Maps e sugere termos (1 crédito)
// - { action: 'rank', place_id, data_id, lat, lng, terms[], grid_size, spacing_km, depth, business_name, address }
//     -> posição do perfil em cada termo, no ponto central ou num mapa em grade; salva em gbp_rankings.
//     Custo: 1 crédito por termo x ponto x página.
//
// Secret necessário: SERPAPI_KEY (o mesmo usado na Prospecção).

import {
  aggregateCategorySearch,
  findPosition,
  gridPoints,
  parseMapsUrl,
  suggestTerms,
  summarizePositions,
  buildChecklist,
  computeCategories,
  computeCompetition,
  computeReviewStats,
  computeScore,
  normalizeCompetitor,
  normalizePlace,
  normalizeReview,
  normalizeTrends,
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

    if (body.action === 'categories') {
      const query = String(body.query || '').trim();
      if (!query) return json({ success: false, error: 'Informe o segmento e a cidade.' }, 400);
      const pages = Math.min(Math.max(Number(body.pages) || 1, 1), 3);
      const results: any[] = [];
      for (let page = 0; page < pages; page++) {
        const data = await serpapi({
          engine: 'google_maps',
          q: query,
          hl: 'pt-br',
          gl: 'br',
          type: 'search',
          start: String(page * 20),
        });
        const found = data.local_results || [];
        results.push(...found);
        if (found.length < 20) break;
      }
      return json({ success: true, ...aggregateCategorySearch(results) });
    }

    if (body.action === 'trends') {
      const terms: string[] = (Array.isArray(body.terms) ? body.terms : [])
        .map((t: unknown) => String(t).trim())
        .filter(Boolean)
        .slice(0, 5);
      if (terms.length === 0) return json({ success: false, error: 'Escolha de 1 a 5 categorias.' }, 400);
      const data = await serpapi({
        engine: 'google_trends',
        q: terms.join(','),
        geo: String(body.geo || 'BR'),
        date: 'today 12-m',
        data_type: 'TIMESERIES',
        hl: 'pt-BR',
      });
      return json({ success: true, ...normalizeTrends(data, terms) });
    }

    if (body.action === 'resolve') {
      let info: { place_id: string | null; data_id: string | null; lat: number | null; lng: number | null; name: string | null } = {
        place_id: body.place_id || null,
        data_id: null,
        lat: null,
        lng: null,
        name: null,
      };
      if (!info.place_id) {
        const link = String(body.url || '').trim();
        if (!/^https?:\/\//.test(link)) return json({ success: false, error: 'Cole o link do perfil no Google Maps.' }, 400);
        // Links curtos (maps.app.goo.gl, g.page) redirecionam para o link completo.
        const response = await fetch(link, { redirect: 'follow', headers: { 'Accept-Language': 'pt-BR' } });
        info = parseMapsUrl(response.url);
        if (!info.place_id && !info.data_id) {
          // Alguns redirecionamentos param numa página; os dados do lugar estão no HTML.
          const fromHtml = parseMapsUrl((await response.text()).slice(0, 200_000));
          info = {
            place_id: info.place_id || fromHtml.place_id,
            data_id: info.data_id || fromHtml.data_id,
            lat: info.lat ?? fromHtml.lat,
            lng: info.lng ?? fromHtml.lng,
            name: info.name || fromHtml.name,
          };
        }
      }

      let place: any = null;
      if (info.place_id) {
        place = (await serpapi({ engine: 'google_maps', place_id: info.place_id, hl: 'pt-br', gl: 'br' })).place_results;
      } else if (info.data_id && info.lat !== null && info.lng !== null) {
        place = (
          await serpapi({
            engine: 'google_maps',
            type: 'place',
            data: `!4m5!3m4!1s${info.data_id}!8m2!3d${info.lat}!4d${info.lng}`,
            hl: 'pt-br',
            gl: 'br',
          })
        ).place_results;
      } else if (info.name) {
        const found = await serpapi({
          engine: 'google_maps',
          q: info.name,
          hl: 'pt-br',
          gl: 'br',
          type: 'search',
          ...(info.lat !== null ? { ll: `@${info.lat},${info.lng},15z` } : {}),
        });
        place = found.place_results || found.local_results?.[0];
      }
      if (!place) return json({ success: false, error: 'Não foi possível identificar o perfil por esse link.' }, 404);

      const profile = normalizePlace(place);
      if (!profile.data_id && info.data_id) profile.data_id = info.data_id;
      if (!profile.gps && info.lat !== null && info.lng !== null) profile.gps = { latitude: info.lat, longitude: info.lng };
      if (!profile.gps) return json({ success: false, error: 'O perfil não tem localização no mapa.' }, 422);
      return json({ success: true, profile, suggested_terms: suggestTerms(profile.categories, profile.address) });
    }

    if (body.action === 'rank') {
      const terms: string[] = (Array.isArray(body.terms) ? body.terms : [])
        .map((t: unknown) => String(t).trim())
        .filter(Boolean)
        .slice(0, 5);
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      if (!terms.length || !Number.isFinite(lat) || !Number.isFinite(lng) || (!body.place_id && !body.data_id)) {
        return json({ success: false, error: 'Perfil ou termos inválidos.' }, 400);
      }
      const gridSize = [1, 3, 5].includes(Number(body.grid_size)) ? Number(body.grid_size) : 1;
      const spacingKm = Math.min(Math.max(Number(body.spacing_km) || 1, 0.3), 5);
      // No mapa cada ponto olha só a 1ª página (top 20) para o custo não explodir.
      const pages = gridSize === 1 ? Math.min(Math.max(Number(body.depth) || 1, 1), 3) : 1;
      const target = { place_id: body.place_id || null, data_id: body.data_id || null };
      const points = gridPoints(lat, lng, gridSize, spacingKm);

      let credits = 0;
      const check = async (term: string, point: { lat: number; lng: number }) => {
        for (let page = 0; page < pages; page++) {
          credits++;
          const data = await serpapi({
            engine: 'google_maps',
            q: term,
            ll: `@${point.lat},${point.lng},15z`,
            type: 'search',
            hl: 'pt-br',
            gl: 'br',
            start: String(page * 20),
          });
          const results = data.local_results || [];
          const position = findPosition(results, target, page * 20);
          if (position || results.length < 20) return position;
        }
        return null;
      };

      // Em lotes paralelos para caber no tempo limite da função.
      const tasks = terms.flatMap((term) => points.map((point) => ({ term, point })));
      const positions: (number | null)[] = new Array(tasks.length).fill(null);
      const CONCURRENCY = 8;
      for (let i = 0; i < tasks.length; i += CONCURRENCY) {
        const batch = tasks.slice(i, i + CONCURRENCY);
        const found = await Promise.all(batch.map((t) => check(t.term, t.point).catch(() => null)));
        found.forEach((pos, j) => (positions[i + j] = pos));
      }

      const center = Math.floor(points.length / 2);
      const results = terms.map((term, ti) => {
        const termPositions = points.map((_, pi) => positions[ti * points.length + pi]);
        return {
          term,
          center_position: termPositions[center],
          ...summarizePositions(termPositions),
          points: points.map((p, pi) => ({ ...p, position: termPositions[pi] })),
        };
      });

      const { data: saved, error: saveError } = await supabase
        .from('gbp_rankings')
        .insert({
          user_id: userId,
          place_id: target.place_id,
          data_id: target.data_id,
          business_name: String(body.business_name || 'Empresa'),
          address: body.address || null,
          lat,
          lng,
          grid_size: gridSize,
          spacing_km: spacingKm,
          depth: pages * 20,
          results,
          credits_used: credits,
        })
        .select()
        .single();
      if (saveError) throw saveError;
      return json({ success: true, ranking: saved });
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
