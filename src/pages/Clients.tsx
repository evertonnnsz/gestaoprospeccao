import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Client, ClientStatus, Lead } from '@/types/crm';
import { ClientCard } from '@/components/clients/ClientCard';
import { ClientForm } from '@/components/clients/ClientForm';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Users, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { splitClientsRevenue } from '@/lib/utils/clientRevenue';
import { TrendingUp, CheckCircle2, Clock, UserMinus, PauseCircle, PlayCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function Clients() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  
  const [clients, setClients] = useState<Client[]>([]);
  const [closedLeads, setClosedLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ClientStatus>('active');
  
  const [formOpen, setFormOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  
  const [newClientLeadId, setNewClientLeadId] = useState<string>('');

  const fetchData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch clients with lead data
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (clientsError) throw clientsError;

      // Fetch leads for the clients
      const leadIds = clientsData?.map(c => c.lead_id) || [];
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .in('id', leadIds);

      if (leadsError) throw leadsError;

      // Combine clients with their leads
      const clientsWithLeads = clientsData?.map(client => ({
        ...client,
        lead: leadsData?.find(l => l.id === client.lead_id),
      })) as Client[];

      setClients(clientsWithLeads || []);

      // Fetch closed leads that are not yet clients
      const existingLeadIds = clientsData?.map(c => c.lead_id) || [];
      const { data: closedLeadsData, error: closedLeadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('status', 'fechado')
        .not('id', 'in', existingLeadIds.length > 0 ? `(${existingLeadIds.join(',')})` : '(00000000-0000-0000-0000-000000000000)');

      if (closedLeadsError) throw closedLeadsError;
      setClosedLeads((closedLeadsData || []) as Lead[]);

    } catch (error: any) {
      toast({
        title: 'Erro ao carregar dados',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const filteredClients = clients.filter(client => {
    const cStatus = (client.status as ClientStatus) || 'active';
    if (statusFilter !== 'all' && cStatus !== statusFilter) return false;
    const companyName = client.lead?.company_name?.toLowerCase() || '';
    const contactName = client.lead?.contact_name?.toLowerCase() || '';
    const services = client.services?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    
    return companyName.includes(query) || contactName.includes(query) || services.includes(query);
  });

  const revenue = splitClientsRevenue(clients);
  const statusCounts = {
    active: clients.filter((c) => ((c.status as ClientStatus) || 'active') === 'active').length,
    paused: clients.filter((c) => c.status === 'paused').length,
    churn: clients.filter((c) => c.status === 'churn').length,
  };
  const fmtBRL = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setSelectedLead(client.lead || null);
    setFormOpen(true);
  };

  const handleDelete = (client: Client) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!clientToDelete) return;

    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientToDelete.id);

      if (error) throw error;

      toast({ title: 'Cliente removido com sucesso!' });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erro ao remover cliente',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    }
  };

  const handleNewClient = () => {
    if (!newClientLeadId) {
      toast({
        title: 'Selecione um lead',
        description: 'Escolha um lead fechado para cadastrar como cliente.',
        variant: 'destructive',
      });
      return;
    }

    const lead = closedLeads.find(l => l.id === newClientLeadId);
    if (lead) {
      setSelectedClient(null);
      setSelectedLead(lead);
      setFormOpen(true);
      setNewClientLeadId('');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-7 h-7" />
            Clientes
          </h1>
          <p className="text-muted-foreground">
            Gerencie seus clientes e contratos
          </p>
        </div>

        {closedLeads.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={newClientLeadId} onValueChange={setNewClientLeadId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecione um lead fechado" />
              </SelectTrigger>
              <SelectContent>
                {closedLeads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleNewClient}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Cliente
            </Button>
          </div>
        )}
      </div>

      {/* Resumo de faturamento */}
      {clients.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Faturamento Previsto
                </p>
                <p className="text-2xl font-bold mt-1">{fmtBRL(revenue.total)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {revenue.totalCount} {revenue.totalCount === 1 ? 'cliente' : 'clientes'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-success/30 bg-success/5">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-success font-medium">
                  Recebido no Mês
                </p>
                <p className="text-2xl font-bold text-success mt-1">{fmtBRL(revenue.received)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {revenue.paidCount} {revenue.paidCount === 1 ? 'cliente pago' : 'clientes pagos'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-success/15 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-warning font-medium">
                  A Receber
                </p>
                <p className="text-2xl font-bold text-warning mt-1">{fmtBRL(revenue.receivable)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {revenue.receivableCount}{' '}
                  {revenue.receivableCount === 1 ? 'pendente/atrasado' : 'pendentes/atrasados'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-warning/15 flex items-center justify-center">
                <Clock className="w-5 h-5 text-warning" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant={statusFilter === 'active' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('active')}
            className="gap-1"
          >
            <PlayCircle className="w-4 h-4" />
            Ativos ({statusCounts.active})
          </Button>
          <Button
            type="button"
            variant={statusFilter === 'paused' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('paused')}
            className="gap-1"
          >
            <PauseCircle className="w-4 h-4" />
            Pausados ({statusCounts.paused})
          </Button>
          <Button
            type="button"
            variant={statusFilter === 'churn' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('churn')}
            className="gap-1"
          >
            <UserMinus className="w-4 h-4" />
            Churn ({statusCounts.churn})
          </Button>
          <Button
            type="button"
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
          >
            Todos
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum cliente encontrado</h3>
          <p className="text-muted-foreground">
            {clients.length === 0
              ? 'Quando um lead for marcado como "Fechado", ele aparecerá aqui para ser cadastrado como cliente.'
              : 'Tente ajustar sua busca.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onChange={fetchData}
            />
          ))}
        </div>
      )}

      <ClientForm
        open={formOpen}
        onOpenChange={setFormOpen}
        client={selectedClient}
        lead={selectedLead}
        onSuccess={fetchData}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este cliente? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
