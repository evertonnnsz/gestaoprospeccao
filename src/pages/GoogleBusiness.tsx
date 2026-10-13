import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ClipboardList, Trophy, Eye, FileDown, Link2, Loader2, MapPin, RefreshCw, Search, Star, Trash2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { GbpAnalysis, GbpAnalysisView, scoreTone } from '@/components/gbp/GbpAnalysisView';

// gbp_analyses ainda não está nos tipos gerados do Supabase.
const db = supabase as any;

type Candidate = {
  title: string;
  address: string | null;
  rating: number | null;
  reviews: number | null;
  category: string | null;
  thumbnail: string | null;
  place_id: string | null;
};

const REVIEW_OPTIONS = [
  { value: '50', label: '50 avaliações (≈ 5 créditos)' },
  { value: '100', label: '100 avaliações (≈ 8 créditos)' },
  { value: '200', label: '200 avaliações (≈ 13 créditos)' },
  { value: '500', label: '500 avaliações (≈ 28 créditos)' },
];

const isMissingTable = (error: any) => error?.code === '42P01' || error?.code === 'PGRST205';

export default function GoogleBusiness() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const leadId = searchParams.get('lead');
  const clientId = searchParams.get('client');

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [maxReviews, setMaxReviews] = useState('100');
  const [linkedName, setLinkedName] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [history, setHistory] = useState<GbpAnalysis[]>([]);
  const [tableMissing, setTableMissing] = useState(false);
  const [selected, setSelected] = useState<GbpAnalysis | null>(null);
  const [presentation, setPresentation] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const loadHistory = async () => {
      const { data, error } = await db.from('gbp_analyses').select('*').order('created_at', { ascending: false }).limit(200);
      setTableMissing(isMissingTable(error));
      const rows = (data || []) as GbpAnalysis[];
      setHistory(rows);
      // Vindo de um lead/cliente: abre a última análise dele, se existir.
      const linked = rows.find((r) => (leadId && r.lead_id === leadId) || (clientId && r.client_id === clientId));
      if (linked) setSelected(linked);
    };
    loadHistory();
  }, [leadId, clientId]);

  useEffect(() => {
    const loadLinkedName = async () => {
      if (leadId) {
        const { data } = await supabase.from('leads').select('company_name').eq('id', leadId).maybeSingle();
        setLinkedName(data?.company_name || 'Lead');
      } else if (clientId) {
        const { data } = await supabase.from('clients').select('lead:leads(company_name)').eq('id', clientId).maybeSingle();
        setLinkedName((data as any)?.lead?.company_name || 'Cliente');
      } else {
        setLinkedName(null);
      }
    };
    loadLinkedName();
  }, [leadId, clientId]);

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    // Espera os gráficos renderizarem antes de abrir a impressão.
    const timer = window.setTimeout(() => window.print(), 600);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', done);
    };
  }, [printing]);

  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('gbp-analyze', { body });
    if (error) {
      // Mensagem detalhada vem no corpo da resposta da função.
      const detail = await (error as any).context?.json?.().catch(() => null);
      throw new Error(detail?.error || error.message);
    }
    if (!data?.success) throw new Error(data?.error || 'Erro ao consultar o Google.');
    return data;
  };

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setCandidates(null);
    try {
      const data = await invoke({ action: 'search', query });
      setCandidates(data.candidates);
    } catch (error: any) {
      toast({ title: 'Não foi possível buscar', description: error.message, variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  };

  const analyze = async (placeId: string) => {
    setAnalyzingId(placeId);
    try {
      const data = await invoke({
        action: 'analyze',
        place_id: placeId,
        lead_id: leadId,
        client_id: clientId,
        max_reviews: Number(maxReviews),
      });
      const analysis = data.analysis as GbpAnalysis;
      setHistory((current) => [analysis, ...current]);
      setSelected(analysis);
      setCandidates(null);
      toast({ title: 'Diagnóstico pronto', description: `Nota ${analysis.score} de 100.` });
    } catch (error: any) {
      toast({ title: 'Não foi possível analisar', description: error.message, variant: 'destructive' });
    } finally {
      setAnalyzingId(null);
    }
  };

  const removeAnalysis = async (analysis: GbpAnalysis) => {
    const { error } = await db.from('gbp_analyses').delete().eq('id', analysis.id);
    if (error) {
      toast({ title: 'Não foi possível excluir', description: error.message, variant: 'destructive' });
      return;
    }
    setHistory((current) => current.filter((h) => h.id !== analysis.id));
    if (selected?.id === analysis.id) setSelected(null);
  };

  const unlink = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('lead');
    next.delete('client');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <MapPin className="w-6 h-6 text-primary" />
            Google Meu Negócio
          </h1>
          <p className="text-sm text-muted-foreground">
            Diagnóstico do perfil no Google: nota, checklist, concorrentes, avaliações e categorias.
          </p>
        </div>
        {selected && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={presentation} onCheckedChange={setPresentation} />
              Modo apresentação
            </label>
            <Button variant="outline" className="gap-2" onClick={() => setPrinting(true)}>
              <FileDown className="w-4 h-4" />
              Exportar PDF
            </Button>
            {selected.profile.place_id && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() =>
                  navigate(
                    `/checklist-gmn?place=${encodeURIComponent(selected.profile.place_id!)}&nome=${encodeURIComponent(selected.business_name)}`,
                  )
                }
              >
                <ClipboardList className="w-4 h-4" />
                Checklist
              </Button>
            )}
            {selected.profile.place_id && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => navigate(`/ranking-google?place=${encodeURIComponent(selected.profile.place_id!)}`)}
              >
                <Trophy className="w-4 h-4" />
                Ranking
              </Button>
            )}
            {selected.profile.place_id && (
              <Button
                variant="outline"
                className="gap-2"
                disabled={Boolean(analyzingId)}
                onClick={() => analyze(selected.profile.place_id!)}
              >
                {analyzingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Analisar de novo
              </Button>
            )}
          </div>
        )}
      </div>

      {tableMissing && (
        <Card className="border-warning/40 bg-warning/5 print:hidden">
          <CardContent className="pt-6 text-sm">
            Falta aplicar no Lovable a atualização de banco <code className="text-xs">gbp_analyses</code> para salvar os
            diagnósticos.
          </CardContent>
        </Card>
      )}

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-base">Novo diagnóstico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {linkedName && (
            <div className="flex items-center gap-2 text-sm">
              <Link2 className="w-4 h-4 text-primary" />
              Vinculado a <strong>{linkedName}</strong> ({leadId ? 'lead' : 'cliente'})
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={unlink} aria-label="Remover vínculo">
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-[1fr_260px_auto] md:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="gbp-query">Empresa e cidade</Label>
              <Input
                id="gbp-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && search()}
                placeholder="Ex.: Pizzaria Forno a Lenha Recife"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Avaliações a analisar</Label>
              <Select value={maxReviews} onValueChange={setMaxReviews}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REVIEW_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="gap-2" onClick={search} disabled={searching || !query.trim()}>
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar perfil
            </Button>
          </div>

          {candidates && (
            <div className="space-y-2">
              {candidates.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum perfil encontrado. Tente incluir a cidade ou o bairro.</p>
              )}
              {candidates.map((c) => (
                <div key={c.place_id || c.title} className="flex items-center gap-3 rounded-lg border p-3">
                  {c.thumbnail ? (
                    <img src={c.thumbnail} alt="" className="w-12 h-12 rounded-md object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[c.category, c.address].filter(Boolean).join(' · ')}
                    </p>
                    {c.rating !== null && (
                      <p className="text-xs flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {c.rating} · {c.reviews ?? 0} avaliações
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    disabled={!c.place_id || Boolean(analyzingId)}
                    onClick={() => c.place_id && analyze(c.place_id)}
                    className="gap-2 shrink-0"
                  >
                    {analyzingId === c.place_id && <Loader2 className="w-4 h-4 animate-spin" />}
                    {analyzingId === c.place_id ? 'Analisando...' : 'Analisar'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && <GbpAnalysisView analysis={selected} history={history} presentation={presentation} printing={printing} />}

      {history.length > 0 && (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="text-base">Diagnósticos salvos</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {history.map((h) => (
              <div
                key={h.id}
                className={cn('flex items-center gap-3 py-2.5', selected?.id === h.id && 'bg-primary/5 -mx-2 px-2 rounded-md')}
              >
                <span className={cn('w-10 text-lg font-bold text-center', scoreTone(h.score))}>{h.score}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{h.business_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {format(parseISO(h.created_at), 'dd/MM/yyyy HH:mm')} · {h.reviews_analyzed} avaliações analisadas
                  </p>
                </div>
                {(h.lead_id || h.client_id) && (
                  <Badge variant="secondary" className="hidden sm:inline-flex">
                    {h.client_id ? 'Cliente' : 'Lead'}
                  </Badge>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelected(h)} aria-label="Abrir">
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeAnalysis(h)}
                  aria-label="Excluir diagnóstico"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
