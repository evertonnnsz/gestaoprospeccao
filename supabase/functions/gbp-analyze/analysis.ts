// Cálculos do diagnóstico de Google Meu Negócio a partir dos dados públicos do
// Google Maps (SerpAPI). Sem dependências do Deno para poder ser testado em Node.

export type ChecklistStatus = 'ok' | 'atencao' | 'desconhecido';

export type ChecklistItem = {
  id: string;
  label: string;
  why: string;
  status: ChecklistStatus;
  detail: string;
  weight: number;
};

export type Profile = {
  title: string;
  place_id: string | null;
  data_id: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviews: number | null;
  categories: string[];
  description: string | null;
  hours: Record<string, string> | null;
  has_photos: boolean;
  thumbnail: string | null;
  attributes: string[];
  claimed: boolean | null;
  posts_count: number | null;
  last_post_date: string | null;
  gps: { latitude: number; longitude: number } | null;
  maps_url: string | null;
};

export type Review = {
  rating: number;
  date: string | null;
  text: string;
  likes: number;
  has_response: boolean;
  has_images: boolean;
  local_guide: boolean;
  user: string;
};

export type Competitor = {
  title: string;
  data_id: string | null;
  place_id: string | null;
  rating: number | null;
  reviews: number;
  categories: string[];
  address: string | null;
  website: string | null;
  is_self: boolean;
};

// ---------- Normalização dos dados da SerpAPI ----------

const asArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string');
  return typeof value === 'string' && value ? [value] : [];
};

export function normalizePlace(place: any): Profile {
  const categories = place.types?.length ? asArray(place.types) : asArray(place.type);

  let hours: Record<string, string> | null = null;
  if (place.operating_hours && typeof place.operating_hours === 'object') {
    hours = place.operating_hours;
  } else if (Array.isArray(place.hours)) {
    hours = Object.assign({}, ...place.hours.filter((h: unknown) => h && typeof h === 'object'));
  }

  const description =
    typeof place.description === 'string'
      ? place.description
      : place.description?.snippet || place.about?.description || null;

  const attributes: string[] = [];
  const collect = (value: any) => {
    if (!value) return;
    if (Array.isArray(value)) value.forEach(collect);
    else if (typeof value === 'string') attributes.push(value);
    else if (typeof value === 'object')
      Object.entries(value).forEach(([key, v]) => (v === true ? attributes.push(key.replace(/_/g, ' ')) : collect(v)));
  };
  collect(place.service_options);
  collect(place.extensions);

  const posts = Array.isArray(place.posts) ? place.posts : null;
  const lastPost = posts?.map((p: any) => p.iso_date || p.date).filter(Boolean).sort().pop() || null;

  return {
    title: place.title || 'Empresa',
    place_id: place.place_id || null,
    data_id: place.data_id || null,
    address: place.address || null,
    phone: place.phone || null,
    website: place.website || null,
    rating: typeof place.rating === 'number' ? place.rating : null,
    reviews: typeof place.reviews === 'number' ? place.reviews : null,
    categories: [...new Set(categories)],
    description,
    hours: hours && Object.keys(hours).length ? hours : null,
    has_photos: Boolean(place.images?.length || place.thumbnail || place.photos_link),
    thumbnail: place.thumbnail || place.images?.[0]?.thumbnail || null,
    attributes: [...new Set(attributes)].slice(0, 30),
    claimed: typeof place.unclaimed_listing === 'boolean' ? !place.unclaimed_listing : null,
    posts_count: posts ? posts.length : null,
    last_post_date: lastPost,
    gps: place.gps_coordinates || null,
    maps_url: place.place_id ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}` : null,
  };
}

export function normalizeReview(review: any): Review {
  return {
    rating: Number(review.rating) || 0,
    date: review.iso_date || review.iso_date_of_last_edit || null,
    text: (review.extracted_snippet?.original || review.snippet || '').trim(),
    likes: Number(review.likes) || 0,
    has_response: Boolean(review.response?.snippet || review.response?.extracted_snippet),
    has_images: Array.isArray(review.images) && review.images.length > 0,
    local_guide: Boolean(review.user?.local_guide),
    user: review.user?.name || 'Anônimo',
  };
}

export function normalizeCompetitor(result: any, self: Profile): Competitor {
  const categories = result.types?.length ? asArray(result.types) : asArray(result.type);
  const isSelf =
    (self.data_id && result.data_id === self.data_id) ||
    (self.place_id && result.place_id === self.place_id) ||
    false;
  return {
    title: result.title || 'Empresa',
    data_id: result.data_id || null,
    place_id: result.place_id || null,
    rating: typeof result.rating === 'number' ? result.rating : null,
    reviews: Number(result.reviews) || 0,
    categories: [...new Set(categories)],
    address: result.address || null,
    website: result.website || null,
    is_self: Boolean(isSelf),
  };
}

// ---------- Avaliações ----------

const STOPWORDS = new Set(
  (
    'a o e é de da do das dos em no na nos nas um uma uns umas que com por para pra pro os as se ' +
    'muito muita muitos muitas mais mas foi ser são sao tem ter tinha está esta estão estao estava ' +
    'eu ele ela eles elas nós nos vocês voces você voce me meu minha meus minhas seu sua seus suas ' +
    'isso isto esse essa este aquele aquela lá la aqui ali já ja não nao sim só so bem também tambem ' +
    'como quando onde quem qual quais até ate sobre sem entre depois antes ainda sempre nunca nada ' +
    'tudo todo toda todos todas ao aos à às pelo pela pelos pelas num numa lhe lhes vai vou fui ' +
    'fomos estou estamos era eram há ha hoje ontem dia vez vezes local lugar the and'
  ).split(' '),
);

function topWords(texts: string[], limit = 20): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  texts.forEach((text) => {
    const seen = new Set<string>();
    text
      .toLowerCase()
      .normalize('NFC')
      .replace(/[^\p{L}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
      .forEach((w) => {
        // Conta cada palavra uma vez por avaliação.
        if (seen.has(w)) return;
        seen.add(w);
        counts.set(w, (counts.get(w) || 0) + 1);
      });
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0);

export function computeReviewStats(reviews: Review[], now: Date = new Date()) {
  const total = reviews.length;
  const stars: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  reviews.forEach((r) => {
    const key = String(Math.min(5, Math.max(1, Math.round(r.rating))));
    stars[key] += 1;
  });

  // Últimos 12 meses (inclui o mês atual).
  const months: { month: string; count: number; avg: number | null }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const inMonth = reviews.filter((r) => r.date?.startsWith(key));
    months.push({
      month: key,
      count: inMonth.length,
      avg: inMonth.length ? Math.round((inMonth.reduce((s, r) => s + r.rating, 0) / inMonth.length) * 100) / 100 : null,
    });
  }

  const byYearMap = new Map<string, Review[]>();
  reviews.forEach((r) => {
    if (!r.date) return;
    const year = r.date.slice(0, 4);
    byYearMap.set(year, [...(byYearMap.get(year) || []), r]);
  });
  const byYear = [...byYearMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, list]) => ({
      year,
      count: list.length,
      avg: Math.round((list.reduce((s, r) => s + r.rating, 0) / list.length) * 100) / 100,
    }));

  const dated = reviews.filter((r) => r.date).map((r) => r.date!).sort();
  const lastDate = dated.length ? dated[dated.length - 1] : null;
  const daysSinceLast = lastDate ? Math.floor((now.getTime() - new Date(lastDate).getTime()) / 86_400_000) : null;

  const negatives = reviews.filter((r) => r.rating <= 3);
  const positives = reviews.filter((r) => r.rating >= 4);
  const withText = reviews.filter((r) => r.text.length > 0);

  return {
    total,
    average: total ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / total) * 100) / 100 : null,
    stars,
    months,
    by_year: byYear,
    last_review_date: lastDate,
    days_since_last: daysSinceLast,
    responded_pct: pct(reviews.filter((r) => r.has_response).length, total),
    negative_total: negatives.length,
    negative_responded_pct: pct(negatives.filter((r) => r.has_response).length, negatives.length),
    with_text_pct: pct(withText.length, total),
    with_images_pct: pct(reviews.filter((r) => r.has_images).length, total),
    local_guides_pct: pct(reviews.filter((r) => r.local_guide).length, total),
    top_liked: [...reviews]
      .filter((r) => r.likes > 0)
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 5)
      .map((r) => ({ user: r.user, rating: r.rating, likes: r.likes, text: r.text.slice(0, 280), date: r.date })),
    words_positive: topWords(positives.map((r) => r.text)),
    words_negative: topWords(negatives.map((r) => r.text)),
  };
}

export type ReviewStats = ReturnType<typeof computeReviewStats>;

// ---------- Concorrentes e categorias ----------

export function computeCompetition(self: Profile, competitors: Competitor[]) {
  const others = competitors.filter((c) => !c.is_self);
  const averageReviews = others.length ? Math.round(others.reduce((s, c) => s + c.reviews, 0) / others.length) : 0;
  const averageRating = others.filter((c) => c.rating).length
    ? Math.round((others.reduce((s, c) => s + (c.rating || 0), 0) / others.filter((c) => c.rating).length) * 100) / 100
    : null;

  const selfEntry: Competitor = {
    title: self.title,
    data_id: self.data_id,
    place_id: self.place_id,
    rating: self.rating,
    reviews: self.reviews || 0,
    categories: self.categories,
    address: self.address,
    website: self.website,
    is_self: true,
  };
  const ranking = [...others, selfEntry].sort((a, b) => b.reviews - a.reviews);
  const position = ranking.findIndex((c) => c.is_self) + 1;

  return {
    ranking: ranking.slice(0, 10).concat(position > 10 ? [selfEntry] : []),
    position,
    total_compared: ranking.length,
    average_reviews: averageReviews,
    average_rating: averageRating,
  };
}

export function computeCategories(self: Profile, competitors: Competitor[]) {
  const others = competitors.filter((c) => !c.is_self);
  const count = (list: string[]) => {
    const map = new Map<string, number>();
    list.forEach((c) => map.set(c, (map.get(c) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([category, total]) => ({ category, total }));
  };
  const primary = count(others.map((c) => c.categories[0]).filter(Boolean));
  const additional = count(others.flatMap((c) => c.categories.slice(1)));
  const all = count(others.flatMap((c) => c.categories));
  const own = new Set(self.categories.map((c) => c.toLowerCase()));
  const minUsage = Math.max(2, Math.ceil(others.length * 0.2));
  const missing = all.filter((c) => !own.has(c.category.toLowerCase()) && c.total >= minUsage).slice(0, 10);

  return {
    own: self.categories,
    primary_ranking: primary.slice(0, 10),
    additional_ranking: additional.slice(0, 15),
    missing,
    locations: others
      .map((c) => ({ title: c.title, categories: c.categories, reviews: c.reviews }))
      .sort((a, b) => b.categories.length - a.categories.length),
  };
}

// ---------- Checklist e nota ----------

export function buildChecklist(
  profile: Profile,
  stats: ReviewStats,
  competition: ReturnType<typeof computeCompetition>,
): ChecklistItem[] {
  const item = (
    id: string,
    label: string,
    why: string,
    weight: number,
    status: ChecklistStatus,
    detail: string,
  ): ChecklistItem => ({ id, label, why, weight, status, detail });

  const reviewsCount = profile.reviews || 0;
  const days = stats.days_since_last;

  return [
    item(
      'categoria_principal',
      'Categoria principal definida',
      'A categoria principal é o fator que mais pesa no ranqueamento local.',
      10,
      profile.categories[0] ? 'ok' : 'atencao',
      profile.categories[0] || 'Nenhuma categoria encontrada.',
    ),
    item(
      'categorias_adicionais',
      'Categorias adicionais',
      'Categorias extras fazem o perfil aparecer em mais buscas relacionadas.',
      8,
      profile.categories.length >= 3 ? 'ok' : 'atencao',
      profile.categories.length > 1
        ? `${profile.categories.length - 1} adicional(is): ${profile.categories.slice(1).join(', ')}`
        : 'Nenhuma categoria adicional.',
    ),
    item(
      'descricao',
      'Descrição do negócio',
      'A descrição explica o que a empresa faz e reforça as palavras-chave do segmento.',
      8,
      profile.description ? 'ok' : 'desconhecido',
      profile.description ? `${profile.description.length} caracteres` : 'Não aparece nos dados públicos; confira no perfil.',
    ),
    item(
      'telefone',
      'Telefone',
      'Facilita a ligação direto da busca, uma das ações que mais geram clientes.',
      6,
      profile.phone ? 'ok' : 'atencao',
      profile.phone || 'Sem telefone cadastrado.',
    ),
    item(
      'site',
      'Site',
      'O link para o site aumenta a confiança e gera visitas qualificadas.',
      8,
      profile.website ? 'ok' : 'atencao',
      profile.website || 'Sem site cadastrado.',
    ),
    item(
      'endereco',
      'Endereço',
      'Endereço completo e correto é base para aparecer no mapa da região.',
      5,
      profile.address ? 'ok' : 'atencao',
      profile.address || 'Sem endereço público (pode ser área de atendimento).',
    ),
    item(
      'horario',
      'Horário de funcionamento',
      'Perfis com horário atualizado transmitem confiança e evitam visitas perdidas.',
      8,
      profile.hours ? 'ok' : 'atencao',
      profile.hours ? `${Object.keys(profile.hours).length} dia(s) informados` : 'Horário não informado.',
    ),
    item(
      'fotos',
      'Fotos no perfil',
      'Perfis com fotos recebem mais pedidos de rota e cliques no site.',
      8,
      profile.has_photos ? 'ok' : 'atencao',
      profile.has_photos ? 'Possui fotos publicadas.' : 'Nenhuma foto encontrada.',
    ),
    item(
      'quantidade_avaliacoes',
      'Quantidade de avaliações vs. concorrentes',
      'Volume de avaliações é um dos sinais de relevância do Google.',
      10,
      competition.total_compared <= 1
        ? 'desconhecido'
        : reviewsCount >= competition.average_reviews
          ? 'ok'
          : 'atencao',
      `${reviewsCount} avaliações · média dos concorrentes: ${competition.average_reviews} · posição ${competition.position}º de ${competition.total_compared}`,
    ),
    item(
      'nota',
      'Nota média',
      'Nota alta aumenta a taxa de clique e a decisão de compra.',
      10,
      profile.rating === null ? 'desconhecido' : profile.rating >= 4.5 ? 'ok' : 'atencao',
      profile.rating === null ? 'Sem nota.' : `Nota ${profile.rating.toFixed(1)}`,
    ),
    item(
      'avaliacoes_recentes',
      'Avaliações recentes',
      'Receber avaliações com frequência mostra ao Google que o negócio está ativo.',
      8,
      days === null ? 'atencao' : days <= 30 ? 'ok' : 'atencao',
      days === null ? 'Nenhuma avaliação encontrada.' : `Última avaliação há ${days} dia(s).`,
    ),
    item(
      'taxa_resposta',
      'Respostas às avaliações',
      'Responder avaliações melhora a reputação e é um sinal positivo para o Google.',
      10,
      stats.total === 0 ? 'desconhecido' : stats.responded_pct >= 80 ? 'ok' : 'atencao',
      stats.total === 0 ? 'Sem avaliações analisadas.' : `${stats.responded_pct}% das avaliações analisadas têm resposta.`,
    ),
    item(
      'resposta_negativas',
      'Respostas às avaliações negativas',
      'Responder críticas mostra cuidado com o cliente para quem está decidindo.',
      6,
      stats.negative_total === 0 ? 'ok' : stats.negative_responded_pct >= 100 ? 'ok' : 'atencao',
      stats.negative_total === 0
        ? 'Nenhuma avaliação de 1 a 3 estrelas.'
        : `${stats.negative_responded_pct}% das ${stats.negative_total} avaliações negativas respondidas.`,
    ),
    item(
      'atributos',
      'Atributos e opções de serviço',
      'Atributos (ex.: entrega, acessibilidade, Wi-Fi) ajudam a aparecer em buscas específicas.',
      4,
      profile.attributes.length ? 'ok' : 'atencao',
      profile.attributes.length ? profile.attributes.slice(0, 6).join(', ') : 'Nenhum atributo encontrado.',
    ),
    item(
      'postagens',
      'Postagens recentes',
      'Postagens frequentes mantêm o perfil ativo e destacam ofertas e novidades.',
      6,
      profile.posts_count === null
        ? 'desconhecido'
        : profile.last_post_date && Date.now() - new Date(profile.last_post_date).getTime() <= 30 * 86_400_000
          ? 'ok'
          : 'atencao',
      profile.posts_count === null
        ? 'Postagens não disponíveis nos dados públicos.'
        : `${profile.posts_count} postagem(ns) encontradas.`,
    ),
    item(
      'perfil_reivindicado',
      'Perfil reivindicado pelo dono',
      'Sem reivindicar o perfil, a empresa não controla as informações nem responde avaliações.',
      8,
      profile.claimed === null ? 'desconhecido' : profile.claimed ? 'ok' : 'atencao',
      profile.claimed === null ? 'Não foi possível confirmar.' : profile.claimed ? 'Perfil gerenciado pelo dono.' : 'Perfil sem dono (não reivindicado).',
    ),
  ];
}

export function computeScore(checklist: ChecklistItem[]): number {
  const known = checklist.filter((i) => i.status !== 'desconhecido');
  const total = known.reduce((s, i) => s + i.weight, 0);
  if (total === 0) return 0;
  const ok = known.filter((i) => i.status === 'ok').reduce((s, i) => s + i.weight, 0);
  return Math.round((ok / total) * 100);
}
