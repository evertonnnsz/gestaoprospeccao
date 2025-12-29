import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Client, Lead } from '@/types/crm';
import { ClientCard } from '@/components/clients/ClientCard';
import { ClientForm } from '@/components/clients/ClientForm';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Users, Plus } from 'lucide-react';
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
    const companyName = client.lead?.company_name?.toLowerCase() || '';
    const contactName = client.lead?.contact_name?.toLowerCase() || '';
    const services = client.services?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    
    return companyName.includes(query) || contactName.includes(query) || services.includes(query);
  });

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
