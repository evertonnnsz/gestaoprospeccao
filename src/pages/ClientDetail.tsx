import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { addMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  FileText,
  LineChart,
  MapPin,
  Loader2,
  MousePointerClick,
  Phone,
  RefreshCw,
  Target,
  TrendingUp,
  User,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Client, MonthlyPaymentStatus } from '@/types/crm';
import { FinancialTransaction } from '@/types/financial';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClientActivity } from '@/components/clients/ClientActivity';

const paymentLabels: Record<MonthlyPaymentStatus, string> = {
  paid: 'Quitado',
  pending: 'Pendente',
  overdue: 'Vencido',
};

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [metaInsights, setMetaInsights] = useState<{
    investimento: number;
    impressoes: number;
    cliques: number;
    cpc: number | null;
    resultados: number | null;
    custo_por_resultado: number | null;
    period_start: string | null;
    period_end: string | null;
  } | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClient = async () => {
      if (!id) return;
      setLoading(true);

      const [{ data: clientData }, { data: transactionData }, { data: campaignData }] = await Promise.all([
        supabase.from('clients').select('*, lead:leads(*)').eq('id', id).maybeSingle(),
        supabase.from('financial_transactions').select('*').eq('client_id', id).order('transaction_date', { ascending: false }),
        supabase.from('campanhas_anuncios').select('*').eq('client_id', id).order('period_start', { ascending: false }),
      ]);

      setClient((clientData as Client) || null);
      setTransactions((transactionData || []) as FinancialTransaction[]);
      setCampaigns(campaignData || []);
      setLoading(false);
    };

    fetchClient();
  }, [id]);

  const fetchMetaInsights = async () => {
    if (!id || !client?.meta_ads_account_id) return;
    setMetaLoading(true);
    setMetaError(null);
    try {
      const { data, error } = await supabase.functions.invoke('meta-ads-insights', {
        body: { client_id: id, date_preset: 'last_30d' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao buscar resultados da Meta');
      setMetaInsights(data.data);
    } catch (err: any) {
      setMetaError(err.message || 'Não foi possível buscar os resultados da Meta agora.');
    } finally {
      setMetaLoading(false);
    }
  };

  useEffect(() => {
    if (client?.meta_ads_account_id) {
      fetchMetaInsights();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.meta_ads_account_id]);

  const clientName = client?.lead?.company_name || 'Cliente';
  const contractEndDate = useMemo(() => {
    if (!client?.project_start_date || !client.contract_duration_months) return null;
    return addMonths(new Date(client.project_start_date), client.contract_duration_months);
  }, [client]);

  const incomeTotal = transactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((total, transaction) => total + Number(transaction.amount), 0);

  if (loading) {
    return <div className="p-6 text-muted-foreground">Carregando cliente...</div>;
  }

  if (!client) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="outline" onClick={() => navigate('/clients')} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Cliente não encontrado.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Button variant="ghost" onClick={() => navigate('/clients')} className="gap-2 -ml-3">
            <ArrowLeft className="w-4 h-4" />
            Clientes
          </Button>
          <h1 className="text-2xl font-bold">{clientName}</h1>
          <p className="text-muted-foreground">
            Página individual com financeiro, contrato, campanhas e atividade.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate(`/google-meu-negocio?client=${client.id}&q=${encodeURIComponent(clientName)}`)}
          >
            <MapPin className="w-4 h-4" />
            Diagnóstico Google
          </Button>
          <Badge className={client.status === 'active' ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}>
            {client.status === 'active' ? 'Ativo' : client.status === 'paused' ? 'Pausado' : 'Churn'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Metric title="Valor mensal" value={formatCurrency(client.project_value)} icon={DollarSign} />
        <Metric title="Vencimento" value={formatDate(client.payment_due_date)} icon={Calendar} />
        <Metric title="Pagamento do mês" value={client.monthly_payment_status ? paymentLabels[client.monthly_payment_status] : '-'} icon={CheckCircle2} />
        <Metric title="Fim do contrato" value={contractEndDate ? formatDate(contractEndDate.toISOString()) : '-'} icon={Clock} />
      </div>

      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList className="h-auto w-full justify-start overflow-x-auto p-1">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="contrato">Contrato</TabsTrigger>
          <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
          <TabsTrigger value="historico">Atividade</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Dados do cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Info label="Contato" value={client.lead?.contact_name || '-'} />
                <Info label="WhatsApp" value={client.lead?.whatsapp || '-'} icon={Phone} />
                <Info label="Serviços" value={client.services || '-'} />
                <Info label="Observações" value={client.notes || '-'} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-warning" />
                  Situação operacional
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Info label="Campanhas registradas" value={String(campaigns.length)} />
                <Info label="Última campanha" value={campaigns[0]?.campaign_name || campaigns[0]?.name || '-'} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="financeiro">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Metric title="Receita mensal prevista" value={formatCurrency(client.project_value)} icon={DollarSign} />
            <Metric title="Receita lançada" value={formatCurrency(incomeTotal)} icon={LineChart} />
            <Metric title="Status pagamento" value={client.monthly_payment_status ? paymentLabels[client.monthly_payment_status] : '-'} icon={CheckCircle2} />
          </div>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Lançamentos financeiros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum lançamento financeiro vinculado a este cliente.</p>
              ) : (
                transactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(transaction.transaction_date)}</p>
                    </div>
                    <Badge variant={transaction.type === 'income' ? 'default' : 'outline'}>
                      {formatCurrency(Number(transaction.amount))}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contrato">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Contrato e renovação
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Info label="Início" value={formatDate(client.project_start_date)} />
              <Info label="Duração" value={client.contract_duration_months ? `${client.contract_duration_months} meses` : '-'} />
              <Info label="Renovação / fim previsto" value={contractEndDate ? format(contractEndDate, 'dd/MM/yyyy', { locale: ptBR }) : '-'} />
              <Info label="Vencimento de pagamento" value={formatDate(client.payment_due_date)} />
              <div className="md:col-span-2">
                {client.contract_url ? (
                  <Button asChild variant="outline" className="gap-2">
                    <a href={client.contract_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4" />
                      Abrir contrato anexado
                    </a>
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum contrato anexado.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campanhas" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Resultados reais — Gerenciador de Anúncios (Meta)
              </CardTitle>
              {client.meta_ads_account_id && (
                <Button variant="outline" size="sm" className="gap-2" onClick={fetchMetaInsights} disabled={metaLoading}>
                  {metaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Atualizar
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!client.meta_ads_account_id ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma conta de anúncios da Meta vinculada a este cliente ainda. Edite o cadastro do cliente e informe o ID da conta (ex: <code>act_1234567890</code>) para ver os resultados reais aqui.
                </p>
              ) : metaLoading && !metaInsights ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Buscando resultados na Meta...
                </p>
              ) : metaError ? (
                <p className="text-sm text-destructive">{metaError}</p>
              ) : metaInsights ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <Info label="Investimento (30d)" value={formatCurrency(metaInsights.investimento)} icon={DollarSign} />
                    <Info label="Cliques" value={String(metaInsights.cliques)} icon={MousePointerClick} />
                    <Info label="Impressões" value={String(metaInsights.impressoes)} icon={TrendingUp} />
                    <Info label="CPC médio" value={metaInsights.cpc ? formatCurrency(metaInsights.cpc) : '-'} />
                    <Info label="Resultados" value={metaInsights.resultados !== null ? String(metaInsights.resultados) : '-'} />
                    <Info label="Custo por resultado" value={metaInsights.custo_por_resultado ? formatCurrency(metaInsights.custo_por_resultado) : '-'} />
                  </div>
                  <Button variant="outline" className="gap-2" onClick={() => navigate(`/ads-dashboard?client=${id}`)}>
                    <LineChart className="w-4 h-4" />
                    Ver dashboard completo
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados ainda — clique em Atualizar.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Campanhas registradas manualmente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma campanha registrada para este cliente.</p>
              ) : (
                campaigns.map((campaign) => (
                  <div key={campaign.id} className="rounded-lg border p-3">
                    <p className="font-medium">{campaign.campaign_name || campaign.name || 'Campanha'}</p>
                    <p className="text-sm text-muted-foreground">
                      {campaign.period_start ? formatDate(campaign.period_start) : '-'} até {campaign.period_end ? formatDate(campaign.period_end) : '-'}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <ClientActivity clientId={client.id} createdAt={client.created_at} projectStartDate={client.project_start_date} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ title, value, icon: Icon }: { title: string; value: string; icon: any }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
        <p className="font-medium whitespace-pre-wrap">{value}</p>
      </div>
    </div>
  );
}

function formatCurrency(value: number | null) {
  if (!value) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(date: string | null) {
  if (!date) return '-';
  return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR });
}
