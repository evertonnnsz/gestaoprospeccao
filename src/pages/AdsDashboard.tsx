import { Fragment, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Film,
  Image as ImageIcon,
  Sparkles,
  X,
  DollarSign,
  Eye,
  Loader2,
  MousePointerClick,
  RefreshCw,
  Repeat,
  Target,
  Users,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Metrics = {
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
};

type Engagement = {
  reacoes: number | null;
  comentarios: number | null;
  compartilhamentos: number | null;
  salvamentos: number | null;
  engajamento_publicacao: number | null;
  engajamento_pagina: number | null;
  cliques_link: number | null;
  visitas_pagina: number | null;
};

type VideoMetrics = {
  thruplay: number | null;
  views_3s: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p100: number | null;
  tempo_medio: number | null;
};

type CampaignRow = Metrics & {
  id: string;
  name: string;
  objective: string | null;
  status: string | null;
  engajamento: Engagement | null;
  video: VideoMetrics | null;
};

type BestCreative = {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  investimento: number;
  impressoes: number;
  cliques: number;
  resultado: number | null;
  resultado_label: string;
  custo_por_resultado: number | null;
  thumbnail_url: string | null;
  is_video: boolean;
};

type SeriesPoint = {
  date: string;
  investimento: number;
  impressoes: number;
  cliques: number;
  alcance: number;
};

type ClientOption = { id: string; name: string; accountId: string };

const PRESETS = [
  { value: 'last_7d', label: 'Últimos 7 dias' },
  { value: 'last_14d', label: 'Últimos 14 dias' },
  { value: 'last_30d', label: 'Últimos 30 dias' },
  { value: 'last_90d', label: 'Últimos 90 dias' },
  { value: 'custom', label: 'Período personalizado' },
];

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_ENGAGEMENT: 'Engajamento',
  OUTCOME_LEADS: 'Geração de leads',
  OUTCOME_SALES: 'Vendas',
  OUTCOME_TRAFFIC: 'Tráfego',
  OUTCOME_AWARENESS: 'Reconhecimento',
  OUTCOME_APP_PROMOTION: 'Promoção de app',
  MESSAGES: 'Mensagens',
  LEAD_GENERATION: 'Geração de leads',
  CONVERSIONS: 'Conversões',
  LINK_CLICKS: 'Tráfego',
  POST_ENGAGEMENT: 'Engajamento',
  REACH: 'Alcance',
  BRAND_AWARENESS: 'Reconhecimento',
  VIDEO_VIEWS: 'Visualizações de vídeo',
};

const formatCurrency = (value?: number | null) =>
  value === null || value === undefined
    ? '—'
    : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatNumber = (value?: number | null, digits = 0) =>
  value === null || value === undefined
    ? '—'
    : value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const objectiveLabel = (objective: string | null) =>
  objective ? OBJECTIVE_LABELS[objective] || objective.replace(/^OUTCOME_/, '').replace(/_/g, ' ') : '—';

export default function AdsDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState<string>(searchParams.get('client') || '');
  const [preset, setPreset] = useState<string>('last_30d');
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [campaignId, setCampaignId] = useState<string>('__all__');

  const [account, setAccount] = useState<Metrics | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [bestCreative, setBestCreative] = useState<BestCreative | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadClients = async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, meta_ads_account_id, lead:leads(company_name)')
        .not('meta_ads_account_id', 'is', null);

      const options = (data || [])
        .filter((row: any) => row.meta_ads_account_id)
        .map((row: any) => ({
          id: row.id,
          name: row.lead?.company_name || 'Cliente',
          accountId: row.meta_ads_account_id,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

      setClients(options);
      setClientId((current) => current || options[0]?.id || '');
    };
    loadClients();
  }, []);

  const fetchInsights = async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { client_id: clientId };
      if (preset === 'custom' && customRange.from && customRange.to) {
        body.since = format(customRange.from, 'yyyy-MM-dd');
        body.until = format(customRange.to, 'yyyy-MM-dd');
      } else {
        body.date_preset = preset;
      }
      if (campaignId !== '__all__') body.campaign_id = campaignId;

      const { data, error: fnError } = await supabase.functions.invoke('meta-ads-insights', { body });
      if (fnError) throw fnError;
      if (!data?.success) throw new Error(data?.error || 'Erro ao buscar dados da Meta');

      setAccount(data.account);
      setCampaigns(data.campaigns || []);
      setSeries(data.timeseries || []);
      setBestCreative(data.best_creative || null);
    } catch (err: any) {
      setError(err.message || 'Não foi possível buscar os dados da Meta agora.');
      setAccount(null);
      setCampaigns([]);
      setSeries([]);
      setBestCreative(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!clientId) return;
    setSearchParams({ client: clientId }, { replace: true });
    fetchInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, preset, campaignId, customRange.from, customRange.to]);

  useEffect(() => {
    setCampaignId('__all__');
  }, [clientId]);

  const sortedCampaigns = useMemo(
    () => [...campaigns].sort((a, b) => b.investimento - a.investimento),
    [campaigns],
  );

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === campaignId) || null,
    [campaigns, campaignId],
  );

  const toggleCampaignDetails = (campaignIdToToggle: string) => {
    setExpanded((current) => current === campaignIdToToggle ? null : campaignIdToToggle);
  };

  const chartData = useMemo(
    () =>
      series.map((point) => ({
        ...point,
        label: format(new Date(point.date + 'T00:00:00'), 'dd/MM', { locale: ptBR }),
      })),
    [series],
  );

  const periodLabel = account?.period_start && account?.period_end
    ? `${format(new Date(account.period_start + 'T00:00:00'), 'dd/MM/yy')} a ${format(new Date(account.period_end + 'T00:00:00'), 'dd/MM/yy')}`
    : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Dashboard de Anúncios
          </h1>
          <p className="text-sm text-muted-foreground">
            Resultados reais do Gerenciador de Anúncios da Meta{periodLabel ? ` · ${periodLabel}` : ''}
            {selectedCampaign ? ` · Campanha: ${selectedCampaign.name}` : ''}
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={fetchInsights} disabled={loading || !clientId}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3">
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Selecionar cliente" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {preset === 'custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  {customRange.from && customRange.to
                    ? `${format(customRange.from, 'dd/MM/yy')} - ${format(customRange.to, 'dd/MM/yy')}`
                    : 'Selecionar datas'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: customRange.from, to: customRange.to }}
                  onSelect={(range) => setCustomRange({ from: range?.from, to: range?.to })}
                  numberOfMonths={2}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          )}

          <Select value={campaignId} onValueChange={setCampaignId} disabled={campaigns.length === 0}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Todas as campanhas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as campanhas</SelectItem>
              {sortedCampaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {campaignId !== '__all__' && (
            <Button variant="ghost" className="gap-2" onClick={() => setCampaignId('__all__')}>
              <X className="w-4 h-4" />
              Limpar filtro de campanha
            </Button>
          )}
        </CardContent>
      </Card>

      {!clientId && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Nenhum cliente com conta de anúncios da Meta cadastrada. Informe o ID da conta no cadastro do cliente.
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading && !account && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Buscando dados na Meta...
          </CardContent>
        </Card>
      )}

      {account && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Investimento" value={formatCurrency(account.investimento)} icon={DollarSign} />
            <Kpi label="Impressões" value={formatNumber(account.impressoes)} icon={Eye} />
            <Kpi label="Alcance" value={formatNumber(account.alcance)} icon={Users} />
            <Kpi label="Frequência" value={formatNumber(account.frequencia, 2)} icon={Repeat} />
            <Kpi label="CPM" value={formatCurrency(account.cpm)} />
            <Kpi label="CPC" value={formatCurrency(account.cpc)} icon={MousePointerClick} />
            <Kpi label="CTR" value={account.ctr !== null ? `${formatNumber(account.ctr, 2)}%` : '—'} />
            <Kpi
              label={account.resultado_label}
              value={formatNumber(account.resultado)}
              hint={`Custo por resultado: ${formatCurrency(account.custo_por_resultado)}`}
              icon={Target}
              highlight
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Evolução no período</CardTitle>
            </CardHeader>
            <CardContent className="h-[320px]">
              {chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sem dados diários no período selecionado{selectedCampaign ? ' para esta campanha' : ''}.
                </p>
              ) : chartData.length === 1 ? (
                <p className="text-sm text-muted-foreground">
                  Só houve veiculação em {chartData[0].label}: {formatCurrency(chartData[0].investimento)} investidos e{' '}
                  {formatNumber(chartData[0].impressoes)} impressões. Amplie o período para ver a evolução.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="fillInvest" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <ReTooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        color: 'hsl(var(--foreground))',
                      }}
                      formatter={(value: number, name: string) =>
                        name === 'Investimento' ? formatCurrency(value) : formatNumber(value)
                      }
                    />
                    <Legend />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="investimento"
                      name="Investimento"
                      stroke="hsl(var(--primary))"
                      fill="url(#fillInvest)"
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="impressoes"
                      name="Impressões"
                      stroke="hsl(var(--muted-foreground))"
                      fillOpacity={0}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Melhor criativo {selectedCampaign ? 'da campanha' : 'da conta'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!bestCreative ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum anúncio com resultado no período selecionado.
                </p>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="w-full sm:w-40 h-40 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
                    {bestCreative.thumbnail_url ? (
                      <img
                        src={bestCreative.thumbnail_url}
                        alt={`Criativo do anúncio ${bestCreative.ad_name}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : bestCreative.is_video ? (
                      <Film className="w-8 h-8 text-muted-foreground" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {bestCreative.is_video ? <Film className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                        {bestCreative.ad_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{bestCreative.campaign_name}</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <MiniStat label="Investimento" value={formatCurrency(bestCreative.investimento)} />
                      <MiniStat label={bestCreative.resultado_label} value={formatNumber(bestCreative.resultado)} />
                      <MiniStat label="Custo por resultado" value={formatCurrency(bestCreative.custo_por_resultado)} />
                      <MiniStat label="Impressões" value={formatNumber(bestCreative.impressoes)} />
                      <MiniStat label="Cliques" value={formatNumber(bestCreative.cliques)} />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Campanhas da conta</CardTitle>
            </CardHeader>
            <CardContent>
              {sortedCampaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma campanha encontrada nesta conta.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campanha</TableHead>
                      <TableHead>Objetivo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Investimento</TableHead>
                      <TableHead className="text-right">Resultado</TableHead>
                      <TableHead className="text-right">Custo por resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCampaigns.map((campaign) => (
                      <Fragment key={campaign.id}>
                      <TableRow
                        key={campaign.id}
                        className={`cursor-pointer ${campaignId === campaign.id ? 'bg-muted/60' : ''}`}
                         onClick={() => toggleCampaignDetails(campaign.id)}
                         aria-expanded={expanded === campaign.id}
                         aria-controls={`campaign-details-${campaign.id}`}
                      >
                        <TableCell className="font-medium">
                           <span className="flex items-center gap-2">
                             <Button
                               type="button"
                               variant="ghost"
                               size="icon"
                               className="h-8 w-8 shrink-0"
                               aria-label={`${expanded === campaign.id ? 'Recolher' : 'Expandir'} detalhes da campanha ${campaign.name}`}
                               aria-expanded={expanded === campaign.id}
                               aria-controls={`campaign-details-${campaign.id}`}
                               onClick={(event) => {
                                 event.stopPropagation();
                                 toggleCampaignDetails(campaign.id);
                               }}
                             >
                               {expanded === campaign.id ? (
                                 <ChevronDown className="w-4 h-4" aria-hidden="true" />
                               ) : (
                                 <ChevronRight className="w-4 h-4" aria-hidden="true" />
                               )}
                             </Button>
                             <span>{campaign.name}</span>
                           </span>
                        </TableCell>
                        <TableCell>{objectiveLabel(campaign.objective)}</TableCell>
                        <TableCell>
                          <Badge variant={campaign.status === 'ACTIVE' ? 'default' : 'secondary'}>
                            {campaign.status === 'ACTIVE' ? 'Ativa' : campaign.status === 'PAUSED' ? 'Pausada' : campaign.status || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(campaign.investimento)}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(campaign.resultado)}
                          <span className="block text-xs text-muted-foreground">{campaign.resultado_label}</span>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(campaign.custo_por_resultado)}</TableCell>
                      </TableRow>
                      {expanded === campaign.id && (
                         <TableRow
                           id={`campaign-details-${campaign.id}`}
                           key={`${campaign.id}-detail`}
                           className="bg-muted/30 hover:bg-muted/30"
                         >
                          <TableCell colSpan={6}>
                            <div className="space-y-4 py-2">
                              <div>
                                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Desempenho</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  <MiniStat label="Investimento" value={formatCurrency(campaign.investimento)} />
                                  <MiniStat label="Impressões" value={formatNumber(campaign.impressoes)} />
                                  <MiniStat label="Alcance" value={formatNumber(campaign.alcance)} />
                                  <MiniStat label="Frequência" value={formatNumber(campaign.frequencia, 2)} />
                                  <MiniStat label="CTR" value={campaign.ctr !== null ? `${formatNumber(campaign.ctr, 2)}%` : '—'} />
                                  <MiniStat label="CPC" value={formatCurrency(campaign.cpc)} />
                                  <MiniStat label="CPM" value={formatCurrency(campaign.cpm)} />
                                  <MiniStat label={campaign.resultado_label} value={formatNumber(campaign.resultado)} />
                                </div>
                              </div>

                              {campaign.engajamento && (
                                <div>
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Engajamento</p>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <MiniStat label="Reações" value={formatNumber(campaign.engajamento.reacoes)} />
                                    <MiniStat label="Comentários" value={formatNumber(campaign.engajamento.comentarios)} />
                                    <MiniStat label="Compartilhamentos" value={formatNumber(campaign.engajamento.compartilhamentos)} />
                                    <MiniStat label="Salvamentos" value={formatNumber(campaign.engajamento.salvamentos)} />
                                    <MiniStat label="Engajamento com a publicação" value={formatNumber(campaign.engajamento.engajamento_publicacao)} />
                                    <MiniStat label="Engajamento com a página" value={formatNumber(campaign.engajamento.engajamento_pagina)} />
                                    <MiniStat label="Cliques no link" value={formatNumber(campaign.engajamento.cliques_link)} />
                                    <MiniStat label="Visitas à página de destino" value={formatNumber(campaign.engajamento.visitas_pagina)} />
                                  </div>
                                </div>
                              )}

                              {campaign.video && (
                                <div>
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Vídeo</p>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <MiniStat label="ThruPlay" value={formatNumber(campaign.video.thruplay)} />
                                    <MiniStat label="Views de 3s" value={formatNumber(campaign.video.views_3s)} />
                                    <MiniStat label="25% assistido" value={formatNumber(campaign.video.p25)} />
                                    <MiniStat label="50% assistido" value={formatNumber(campaign.video.p50)} />
                                    <MiniStat label="75% assistido" value={formatNumber(campaign.video.p75)} />
                                    <MiniStat label="100% assistido" value={formatNumber(campaign.video.p100)} />
                                    <MiniStat
                                      label="Tempo médio"
                                      value={campaign.video.tempo_medio !== null ? `${formatNumber(campaign.video.tempo_medio, 1)}s` : '—'}
                                    />
                                  </div>
                                </div>
                              )}

                              <Button
                                size="sm"
                                variant={campaignId === campaign.id ? 'secondary' : 'outline'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCampaignId(campaignId === campaign.id ? '__all__' : campaign.id);
                                }}
                              >
                                {campaignId === campaign.id ? 'Remover filtro desta campanha' : 'Filtrar dashboard nesta campanha'}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold mt-0.5">{value}</p>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ElementType;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'border-primary/40' : undefined}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          {Icon && <Icon className="w-4 h-4" />}
          {label}
        </div>
        <p className="text-2xl font-semibold mt-1">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}
