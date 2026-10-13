import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link2, Loader2, MapPin, Plus, Star, Trash2, TrendingUp, Trophy, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { RankingMap, positionColor } from '@/components/gbp/RankingMap';
import type { Profile } from '../../supabase/functions/gbp-analyze/analysis';

// gbp_rankings e gbp_analyses ainda não estão nos tipos gerados do Supabase.
const db = supabase as any;

const MAX_TERMS = 5;
const LINE_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--chart-2))'];

type PointResult = { row: number; col: number; lat: number; lng: number; position: number | null };
type TermResult = {
  term: string;
  center_position: number | null;
  best: number | null;
  average: number | null;
  found: number;
  total: number;
  top3_share: number;
  points: PointResult[];
};
type Ranking = {
  id: string;
  place_id: string | null;
  data_id: string | null;
  business_name: string;
  lat: number;
  lng: number;
  grid_size: number;
  spacing_km: number;
  depth: number;
  results: TermResult[];
  credits_used: number;
  created_at: string;
};

type Mode = 'centro' | 'grade3' | 'grade5';

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  color: 'hsl(var(--foreground))',
};

async function invoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('gbp-analyze', { body });
  if (error) {
    const detail = await (error as any).context?.json?.().catch(() => null);
    throw new Error(detail?.error || error.message);
  }
  if (!data?.success) throw new Error(data?.error || 'Erro ao consultar o Google.');
  return data;
}

function PositionBadge({ position, depth }: { position: number | null; depth: number }) {
  return (
    <span
      className="inline-flex min-w-[56px] items-center justify-center rounded-md px-2 py-1 text-sm font-bold text-white"
      style={{ background: positionColor(position) }}
    >
      {position ? `${position}º` : `${depth}+`}
    </span>
  );
}

export default function GbpRanking() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [link, setLink] = useState('');
  const [savedProfiles, setSavedProfiles] = useState<{ place_id: string; name: string }[]>([]);
  const [resolving, setResolving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [terms, setTerms] = useState<string[]>([]);
  const [newTerm, setNewTerm] = useState('');
  const [mode, setMode] = useState<Mode>('centro');
  const [depth, setDepth] = useState('1');
  const [spacing, setSpacing] = useState('1');
  const [running, setRunning] = useState(false);

  const [history, setHistory] = useState<Ranking[]>([]);
  const [selected, setSelected] = useState<Ranking | null>(null);
  const [mapTerm, setMapTerm] = useState(0);

  useEffect(() => {
    db.from('gbp_analyses')
      .select('place_id, business_name, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }: any) => {
        const unique = new Map<string, { place_id: string; name: string }>();
        (data || []).forEach((r: any) => {
          if (r.place_id && !unique.has(r.place_id)) unique.set(r.place_id, { place_id: r.place_id, name: r.business_name });
        });
        setSavedProfiles([...unique.values()]);
      });
  }, []);

  const loadHistory = async (p: Profile) => {
    const filter = p.place_id ? ['place_id', p.place_id] : ['data_id', p.data_id];
    const { data } = await db
      .from('gbp_rankings')
      .select('*')
      .eq(filter[0], filter[1])
      .order('created_at', { ascending: false })
      .limit(50);
    setHistory(data || []);
    setSelected(data?.[0] || null);
    setMapTerm(0);
  };

  const resolve = async (body: Record<string, unknown>) => {
    setResolving(true);
    setProfile(null);
    setSelected(null);
    try {
      const data = await invoke({ action: 'resolve', ...body });
      setProfile(data.profile);
      setTerms(data.suggested_terms);
      loadHistory(data.profile);
    } catch (error: any) {
      toast({ title: 'Não foi possível ler o perfil', description: error.message, variant: 'destructive' });
    } finally {
      setResolving(false);
    }
  };

  // Vindo do diagnóstico: ?place=<place_id>
  useEffect(() => {
    const place = searchParams.get('place');
    if (!place) return;
    resolve({ place_id: place });
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const addTerm = () => {
    const term = newTerm.trim();
    if (!term || terms.includes(term) || terms.length >= MAX_TERMS) return;
    setTerms((t) => [...t, term]);
    setNewTerm('');
  };

  const points = mode === 'grade5' ? 25 : mode === 'grade3' ? 9 : 1;
  const estimate = terms.length * points * (mode === 'centro' ? Number(depth) : 1);

  const run = async () => {
    if (!profile?.gps || terms.length === 0) return;
    setRunning(true);
    try {
      const data = await invoke({
        action: 'rank',
        place_id: profile.place_id,
        data_id: profile.data_id,
        business_name: profile.title,
        address: profile.address,
        lat: profile.gps.latitude,
        lng: profile.gps.longitude,
        terms,
        grid_size: points === 1 ? 1 : Math.sqrt(points),
        spacing_km: Number(spacing),
        depth: Number(depth),
      });
      const ranking = data.ranking as Ranking;
      setHistory((h) => [ranking, ...h]);
      setSelected(ranking);
      setMapTerm(0);
      toast({ title: 'Ranking atualizado', description: `${ranking.credits_used} crédito(s) usados.` });
    } catch (error: any) {
      toast({ title: 'Não foi possível verificar o ranking', description: error.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  const remove = async (ranking: Ranking) => {
    const { error } = await db.from('gbp_rankings').delete().eq('id', ranking.id);
    if (error) return toast({ title: 'Não foi possível excluir', description: error.message, variant: 'destructive' });
    const rest = history.filter((h) => h.id !== ranking.id);
    setHistory(rest);
    if (selected?.id === ranking.id) setSelected(rest[0] || null);
  };

  // Evolução da posição no ponto central, por termo (verificações mais antigas primeiro).
  const evolution = useMemo(() => {
    const allTerms = [...new Set(history.flatMap((h) => h.results.map((r) => r.term)))].slice(0, MAX_TERMS);
    const rows = [...history]
      .reverse()
      .map((h) => {
        const row: Record<string, string | number | null> = { date: format(parseISO(h.created_at), 'dd/MM HH:mm') };
        allTerms.forEach((t) => {
          const r = h.results.find((x) => x.term === t);
          row[t] = r ? r.center_position : null;
        });
        return row;
      });
    return { terms: allTerms, rows };
  }, [history]);

  const currentTerm = selected?.results[mapTerm];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Trophy className="w-6 h-6 text-primary" />
          Ranking no Google
        </h1>
        <p className="text-sm text-muted-foreground">
          Cole o link do perfil e veja em que posição ele aparece no Google Maps para cada busca.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="ranking-link" className="flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" />
                Link do perfil no Google Maps
              </Label>
              <Input
                id="ranking-link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && link.trim() && resolve({ url: link.trim() })}
                placeholder="https://maps.app.goo.gl/... ou https://www.google.com/maps/place/..."
              />
            </div>
            <Button className="gap-2" onClick={() => resolve({ url: link.trim() })} disabled={resolving || !link.trim()}>
              {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              Ler perfil
            </Button>
          </div>
          {savedProfiles.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">ou um perfil já analisado:</span>
              <Select onValueChange={(id) => resolve({ place_id: id })}>
                <SelectTrigger className="w-[260px] h-8">
                  <SelectValue placeholder="Escolher perfil" />
                </SelectTrigger>
                <SelectContent>
                  {savedProfiles.map((p) => (
                    <SelectItem key={p.place_id} value={p.place_id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {profile && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex flex-wrap items-center gap-2">
              {profile.title}
              {profile.rating !== null && (
                <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {profile.rating.toFixed(1)} · {profile.reviews ?? 0} avaliações
                </span>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {[profile.categories[0], profile.address].filter(Boolean).join(' · ')}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Buscas para verificar (até {MAX_TERMS})</Label>
              <div className="flex flex-wrap items-center gap-2">
                {terms.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1.5 py-1 text-sm">
                    {t}
                    <button onClick={() => setTerms((list) => list.filter((x) => x !== t))} aria-label={`Remover ${t}`}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </Badge>
                ))}
                {terms.length < MAX_TERMS && (
                  <div className="flex gap-1">
                    <Input
                      value={newTerm}
                      onChange={(e) => setNewTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addTerm()}
                      placeholder="Outra busca"
                      className="h-8 w-[180px]"
                    />
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={addTerm} aria-label="Adicionar busca">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label>Tipo de verificação</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                  <SelectTrigger className="w-[230px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="centro">Posição no endereço do negócio</SelectItem>
                    <SelectItem value="grade3">Mapa 3x3 (9 pontos)</SelectItem>
                    <SelectItem value="grade5">Mapa 5x5 (25 pontos)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {mode === 'centro' ? (
                <div className="space-y-1.5">
                  <Label>Procurar até</Label>
                  <Select value={depth} onValueChange={setDepth}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Top 20</SelectItem>
                      <SelectItem value="2">Top 40</SelectItem>
                      <SelectItem value="3">Top 60</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Distância entre pontos</Label>
                  <Select value={spacing} onValueChange={setSpacing}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.5">500 m</SelectItem>
                      <SelectItem value="1">1 km</SelectItem>
                      <SelectItem value="2">2 km</SelectItem>
                      <SelectItem value="3">3 km</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button className="gap-2" onClick={run} disabled={running || terms.length === 0}>
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                {running ? 'Verificando...' : 'Ver ranking'}
              </Button>
              <span className="text-xs text-muted-foreground pb-2">
                {mode === 'centro' ? `até ${estimate}` : estimate} crédito(s)
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {selected && (
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Resultado de {format(parseISO(selected.created_at), "dd/MM/yyyy 'às' HH:mm")}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {selected.grid_size > 1
                    ? `mapa ${selected.grid_size}x${selected.grid_size}, ${Number(selected.spacing_km)} km entre pontos`
                    : `no endereço do negócio, top ${selected.depth}`}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {selected.results.map((r, i) => (
                <button
                  key={r.term}
                  onClick={() => setMapTerm(i)}
                  className={cn(
                    'flex w-full flex-wrap items-center gap-3 py-3 text-left',
                    selected.grid_size > 1 && mapTerm === i && 'bg-primary/5 -mx-2 px-2 rounded-md',
                  )}
                >
                  <PositionBadge position={r.center_position} depth={selected.depth} />
                  <span className="flex-1 font-medium">{r.term}</span>
                  {selected.grid_size > 1 && (
                    <span className="text-xs text-muted-foreground">
                      aparece em {r.found}/{r.total} pontos · top 3 em {r.top3_share}%
                      {r.average !== null && ` · média ${r.average}º`}
                    </span>
                  )}
                </button>
              ))}
              <p className="pt-3 text-xs text-muted-foreground">
                Verde: top 3 · amarelo: 4º a 10º · laranja: 11º a {selected.depth}º · vermelho: fora do top {selected.depth}.
                Posição no Google Maps a partir do local indicado; pode variar um pouco por aparelho e histórico de quem busca.
              </p>
            </CardContent>
          </Card>

          {selected.grid_size > 1 && currentTerm && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Mapa: “{currentTerm.term}”</CardTitle>
              </CardHeader>
              <CardContent>
                <RankingMap points={currentTerm.points} center={{ lat: selected.lat, lng: selected.lng }} />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução da posição (endereço do negócio)</CardTitle>
            </CardHeader>
            <CardContent className="h-[260px]">
              {evolution.rows.length < 2 ? (
                <p className="text-sm text-muted-foreground">
                  Faça novas verificações ao longo do tempo para acompanhar a evolução.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolution.rows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis reversed allowDecimals={false} domain={[1, 'dataMax']} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => (v ? `${v}º` : 'fora')} />
                    <Legend />
                    {evolution.terms.map((t, i) => (
                      <Line key={t} type="monotone" dataKey={t} stroke={LINE_COLORS[i]} strokeWidth={2} connectNulls dot />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Verificações salvas</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {history.map((h) => (
                <div key={h.id} className={cn('flex items-center gap-3 py-2', selected?.id === h.id && 'font-medium')}>
                  <button className="flex-1 text-left text-sm" onClick={() => setSelected(h)}>
                    {format(parseISO(h.created_at), 'dd/MM/yyyy HH:mm')}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {h.grid_size > 1 ? `mapa ${h.grid_size}x${h.grid_size}` : 'endereço'} · {h.results.length} busca(s) ·{' '}
                      {h.credits_used} crédito(s)
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(h)}
                    aria-label="Excluir verificação"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
