import { useEffect, useMemo, useState } from 'react';
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

type CampaignRow = Metrics & {
  id: string;
  name: string;
  objective: string | null;
  status: string | null;
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
    } catch (err: any) {
      setError(err.message || 'Não foi possível buscar os dados da Meta agora.');
      setAccount(null);
      setCampaigns([]);
      setSeries([]);
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
                <p className="text-sm text-muted-foreground">Sem dados diários no período selecionado.</p>
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
                      <TableRow
                        key={campaign.id}
                        className="cursor-pointer"
                        onClick={() => setCampaignId(campaign.id)}
                      >
                        <TableCell className="font-medium">{campaign.name}</TableCell>
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
