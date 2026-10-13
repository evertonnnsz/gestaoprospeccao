import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Award, LineChart as LineChartIcon, Loader2, Plus, Search, Star, Tags, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { BRAZILIAN_STATES } from '@/lib/constants/brazilianStates';
import type { CategoryUsage } from '../../supabase/functions/gbp-analyze/analysis';

const MAX_COMPARE = 5;
const LINE_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--chart-2))'];

type SearchResult = {
  total: number;
  categories: CategoryUsage[];
  recommended: CategoryUsage | null;
  businesses: { title: string; categories: string[]; rating: number | null; reviews: number; address: string | null }[];
};

type TrendsResult = {
  terms: string[];
  points: Record<string, number | string>[];
  averages: { term: string; average: number }[];
};

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  color: 'hsl(var(--foreground))',
};

// Um rótulo por mês no eixo X (os dados do Trends são semanais).
const monthTicks = (points: Record<string, number | string>[]) =>
  points
    .map((p) => String(p.date))
    .filter((date, i, all) => /^\d{4}-\d{2}/.test(date) && (i === 0 || date.slice(0, 7) !== all[i - 1].slice(0, 7)));

async function invoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('gbp-analyze', { body });
  if (error) {
    const detail = await (error as any).context?.json?.().catch(() => null);
    throw new Error(detail?.error || error.message);
  }
  if (!data?.success) throw new Error(data?.error || 'Erro ao consultar o Google.');
  return data;
}

export default function CategorySearch() {
  const { toast } = useToast();
  const [segment, setSegment] = useState('');
  const [city, setCity] = useState('');
  const [pages, setPages] = useState('1');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);

  const [compare, setCompare] = useState<string[]>([]);
  const [customTerm, setCustomTerm] = useState('');
  const [geo, setGeo] = useState('BR');
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [trends, setTrends] = useState<TrendsResult | null>(null);
  const [showBusinesses, setShowBusinesses] = useState(false);

  const search = async () => {
    if (!segment.trim()) return;
    setSearching(true);
    setResult(null);
    try {
      const query = city.trim() ? `${segment.trim()} em ${city.trim()}` : segment.trim();
      const data = await invoke({ action: 'categories', query, pages: Number(pages) });
      setResult(data);
      // Já deixa as 3 mais usadas prontas para comparar.
      setCompare(data.categories.slice(0, 3).map((c: CategoryUsage) => c.category));
      setTrends(null);
    } catch (error: any) {
      toast({ title: 'Não foi possível pesquisar', description: error.message, variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  };

  const toggleCompare = (category: string) => {
    setCompare((current) => {
      if (current.includes(category)) return current.filter((c) => c !== category);
      if (current.length >= MAX_COMPARE) {
        toast({ title: `Compare até ${MAX_COMPARE} categorias por vez` });
        return current;
      }
      return [...current, category];
    });
  };

  const addCustom = () => {
    const term = customTerm.trim();
    if (!term) return;
    toggleCompare(term);
    setCustomTerm('');
  };

  const loadTrends = async () => {
    if (compare.length === 0) return;
    setLoadingTrends(true);
    try {
      setTrends(await invoke({ action: 'trends', terms: compare, geo }));
    } catch (error: any) {
      toast({ title: 'Não foi possível consultar o Google Trends', description: error.message, variant: 'destructive' });
    } finally {
      setLoadingTrends(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Tags className="w-6 h-6 text-primary" />
          Pesquisa de categorias
        </h1>
        <p className="text-sm text-muted-foreground">
          Descubra as categorias do Google que os perfis do segmento usam e compare a procura no Google Trends.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_220px_auto] md:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="cat-segment">Segmento ou palavra-chave</Label>
              <Input
                id="cat-segment"
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && search()}
                placeholder="Ex.: barbearia, academia, clínica odontológica"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-city">Cidade (opcional)</Label>
              <Input
                id="cat-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && search()}
                placeholder="Ex.: Recife"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Perfis analisados</Label>
              <Select value={pages} onValueChange={setPages}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">20 perfis (1 crédito)</SelectItem>
                  <SelectItem value="2">40 perfis (2 créditos)</SelectItem>
                  <SelectItem value="3">60 perfis (3 créditos)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="gap-2" onClick={search} disabled={searching || !segment.trim()}>
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Pesquisar
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          {result.recommended && (
            <Card className="border-primary/40">
              <CardContent className="pt-6 flex gap-4 items-start">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <Award className="w-6 h-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Categoria principal recomendada</p>
                  <p className="text-xl font-semibold">{result.recommended.category}</p>
                  <p className="text-sm text-muted-foreground">
                    Usada como principal por {result.recommended.as_primary} de {result.total} perfis
                    {result.recommended.avg_reviews_primary !== null &&
                      ` · média de ${Math.round(result.recommended.avg_reviews_primary)} avaliações`}
                    {result.recommended.avg_rating_primary !== null && ` · nota ${result.recommended.avg_rating_primary}`}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Categorias encontradas em {result.total} perfis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum perfil encontrado para essa busca.</p>
              ) : (
                <div className="rounded-lg border">
                  <div className="hidden md:grid grid-cols-[40px_1fr_90px_90px_110px_130px] gap-2 px-3 py-2 text-xs text-muted-foreground border-b">
                    <span />
                    <span>Categoria</span>
                    <span className="text-right">Principal</span>
                    <span className="text-right">Adicional</span>
                    <span className="text-right">% dos perfis</span>
                    <span className="text-right">Média aval.*</span>
                  </div>
                  {result.categories.map((c) => (
                    <label
                      key={c.category}
                      className="grid grid-cols-[40px_1fr_auto] md:grid-cols-[40px_1fr_90px_90px_110px_130px] gap-2 items-center px-3 py-2 border-b last:border-b-0 text-sm hover:bg-muted/40 cursor-pointer"
                    >
                      <Checkbox
                        checked={compare.includes(c.category)}
                        onCheckedChange={() => toggleCompare(c.category)}
                        aria-label={`Comparar ${c.category}`}
                      />
                      <span className="font-medium">{c.category}</span>
                      <span className="text-right">{c.as_primary}</span>
                      <span className="hidden md:block text-right">{c.as_additional}</span>
                      <span className="hidden md:flex items-center justify-end gap-2">
                        <span className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
                          <span className="block h-full bg-primary" style={{ width: `${c.share}%` }} />
                        </span>
                        {c.share}%
                      </span>
                      <span className="hidden md:block text-right text-muted-foreground">
                        {c.avg_reviews_primary !== null ? Math.round(c.avg_reviews_primary) : '—'}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                * Média de avaliações dos perfis que usam a categoria como principal. Marque até {MAX_COMPARE} para comparar no
                Google Trends.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <LineChartIcon className="w-4 h-4 text-primary" />
                Procura no Google Trends (últimos 12 meses)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {compare.map((term, i) => (
                  <Badge key={term} variant="secondary" className="gap-1.5 py-1 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: LINE_COLORS[i] }} />
                    {term}
                    <button onClick={() => toggleCompare(term)} aria-label={`Remover ${term}`}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </Badge>
                ))}
                {compare.length < MAX_COMPARE && (
                  <div className="flex gap-1">
                    <Input
                      value={customTerm}
                      onChange={(e) => setCustomTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addCustom()}
                      placeholder="Outro termo"
                      className="h-8 w-[160px]"
                    />
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={addCustom} aria-label="Adicionar termo">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={geo} onValueChange={setGeo}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BR">Brasil</SelectItem>
                    {BRAZILIAN_STATES.map((s) => (
                      <SelectItem key={s.value} value={`BR-${s.value}`}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="gap-2" onClick={loadTrends} disabled={loadingTrends || compare.length === 0}>
                  {loadingTrends ? <Loader2 className="w-4 h-4 animate-spin" /> : <LineChartIcon className="w-4 h-4" />}
                  Comparar (1 crédito)
                </Button>
              </div>

              {trends && (
                <>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trends.points}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                          dataKey="date"
                          ticks={monthTicks(trends.points)}
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          tickFormatter={(v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? format(parseISO(v), 'MMM/yy', { locale: ptBR }) : v)}
                          minTickGap={24}
                        />
                        <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          labelFormatter={(v: string) =>
                            /^\d{4}-\d{2}-\d{2}$/.test(v) ? `Semana de ${format(parseISO(v), 'dd/MM/yyyy')}` : v
                          }
                        />
                        <Legend />
                        {trends.terms.map((term, i) => (
                          <Line key={term} type="monotone" dataKey={term} stroke={LINE_COLORS[i]} strokeWidth={2} dot={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {[...trends.averages]
                      .sort((a, b) => b.average - a.average)
                      .map((a, i) => (
                        <div key={a.term} className={cn('rounded-lg border px-3 py-2 text-sm', i === 0 && 'border-primary/50 bg-primary/5')}>
                          <p className="text-muted-foreground">{a.term}</p>
                          <p className="font-semibold">Interesse médio {a.average}</p>
                        </div>
                      ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O Google Trends mostra o interesse relativo (100 = pico de procura entre os termos comparados), não o
                    número de buscas.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Perfis analisados</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowBusinesses((v) => !v)}>
                {showBusinesses ? 'Ocultar' : `Ver ${result.businesses.length} perfis`}
              </Button>
            </CardHeader>
            {showBusinesses && (
              <CardContent className="divide-y">
                {result.businesses.map((b, i) => (
                  <div key={`${b.title}-${i}`} className="py-2.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{b.title}</p>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {b.rating ?? '—'} · {b.reviews} aval.
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {b.categories.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sem categoria</span>
                      ) : (
                        b.categories.map((c, ci) => (
                          <Badge key={c} variant={ci === 0 ? 'default' : 'outline'} className="text-[11px]">
                            {c}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
