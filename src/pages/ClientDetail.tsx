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
  History,
  Inbox,
  LineChart,
  Phone,
  User,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Client, MonthlyPaymentStatus } from '@/types/crm';
import { FinancialTransaction } from '@/types/financial';
import { readStoredDemands, type OSDemand } from '@/lib/fatureOS';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const [demands, setDemands] = useState<OSDemand[]>([]);
  const [loading, setLoading] = useState(true);

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
      setDemands(readStoredDemands());
      setLoading(false);
    };

    fetchClient();
  }, [id]);

  const clientName = client?.lead?.company_name || 'Cliente';
  const clientDemands = useMemo(
    () =>
      demands.filter((demand) =>
        demand.clientName?.toLowerCase().trim() === clientName.toLowerCase().trim(),
      ),
    [clientName, demands],
  );

  const contractEndDate = useMemo(() => {
    if (!client?.project_start_date || !client.contract_duration_months) return null;
    return addMonths(new Date(client.project_start_date), client.contract_duration_months);
  }, [client]);

  const incomeTotal = transactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((total, transaction) => total + Number(transaction.amount), 0);

  const timeline = useMemo(() => {
    if (!client) return [];
    return [
      {
        title: 'Cliente cadastrado',
        date: client.created_at,
        detail: 'Registro criado na base de clientes.',
      },
      {
        title: 'Última atualização',
        date: client.updated_at,
        detail: 'Última alteração registrada no cadastro do cliente.',
      },
      ...(client.project_start_date
        ? [
            {
              title: 'Início do projeto',
              date: client.project_start_date,
              detail: 'Data de início operacional/contratual do cliente.',
            },
          ]
        : []),
      ...clientDemands.slice(0, 5).map((demand) => ({
        title: `Demanda: ${demand.title}`,
        date: demand.updatedAt || demand.createdAt,
        detail: demand.status,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [client, clientDemands]);

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
            Página individual com financeiro, contrato, demandas, campanhas e histórico.
          </p>
        </div>
        <Badge className={client.status === 'active' ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}>
          {client.status === 'active' ? 'Ativo' : client.status === 'paused' ? 'Pausado' : 'Churn'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Metric title="Valor mensal" value={formatCurrency(client.project_value)} icon={DollarSign} />
        <Metric title="Vencimento" value={formatDate(client.payment_due_date)} icon={Calendar} />
        <Metric title="Pagamento do mês" value={client.monthly_payment_status ? paymentLabels[client.monthly_payment_status] : '-'} icon={CheckCircle2} />
        <Metric title="Demandas vinculadas" value={String(clientDemands.length)} icon={Inbox} />
      </div>

      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList className="h-auto w-full justify-start overflow-x-auto p-1">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="contrato">Contrato</TabsTrigger>
          <TabsTrigger value="demandas">Demandas</TabsTrigger>
          <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
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
                <Info label="Demandas ativas" value={String(clientDemands.filter((demand) => !['concluida', 'arquivada', 'cancelada'].includes(demand.status)).length)} />
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

        <TabsContent value="demandas">
          <Card>
            <CardHeader>
              <CardTitle>Demandas do cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {clientDemands.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma demanda vinculada a este cliente.</p>
              ) : (
                clientDemands.map((demand) => (
                  <div key={demand.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{demand.title}</p>
                      <Badge variant="outline">{demand.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{demand.description}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campanhas">
          <Card>
            <CardHeader>
              <CardTitle>Campanhas e performance</CardTitle>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Histórico do cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {timeline.map((item) => (
                <div key={`${item.title}-${item.date}`} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{item.title}</p>
                    <span className="text-xs text-muted-foreground">{formatDate(item.date)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{item.detail}</p>
                </div>
              ))}
              <div className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
                Próxima evolução: registrar cada alteração em uma tabela de log no Supabase com usuário, campo alterado e valor anterior.
              </div>
            </CardContent>
          </Card>
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
