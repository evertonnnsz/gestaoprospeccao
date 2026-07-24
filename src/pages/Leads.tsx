import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Lead, LeadStatus, STATUS_LABELS, STATUS_ORDER } from '@/types/crm';
import { LeadCard } from '@/components/leads/LeadCard';
import { LeadForm } from '@/components/leads/LeadForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Filter, Loader2, AlertTriangle, X, Calendar, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { isPast, isToday, parseISO, startOfDay } from 'date-fns';
import { PeriodFilter, PeriodType, DateRange, filterByPeriod } from '@/components/filters/PeriodFilter';

// Helper function to compare dates without timezone issues
const isSameDay = (dateStr: string): boolean => {
  const date = parseISO(dateStr);
  const today = startOfDay(new Date());
  return startOfDay(date).getTime() === today.getTime();
};

// Helper function to check if date is in the past (excluding today)
const isDatePast = (dateStr: string): boolean => {
  const date = parseISO(dateStr);
  const today = startOfDay(new Date());
  return startOfDay(date).getTime() < today.getTime();
};

// Helper function to check if lead has overdue follow-up
const hasOverdueFollowUp = (lead: Lead): boolean => {
  if (lead.status === 'lead_perdido' || lead.status === 'sem_interesse') {
    return false;
  }
  if (lead.follow_up_1 && lead.follow_up_2 && lead.follow_up_3) {
    return false;
  }
  const followUps = [lead.follow_up_1, lead.follow_up_2, lead.follow_up_3].filter(Boolean);
  return followUps.some(date => date && isDatePast(date));
};

// Helper function to check if lead has follow-up for today
const hasTodayFollowUp = (lead: Lead): boolean => {
  if (lead.status === 'lead_perdido' || lead.status === 'sem_interesse') {
    return false;
  }
  const followUps = [lead.follow_up_1, lead.follow_up_2, lead.follow_up_3].filter(Boolean);
  return followUps.some(date => date && isSameDay(date));
};

export default function Leads() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [respondedFilter, setRespondedFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodType>('all');
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [overdueFilter, setOverdueFilter] = useState<boolean>(searchParams.get('filter') === 'overdue');
  const [todayFilter, setTodayFilter] = useState<boolean>(searchParams.get('filter') === 'today');
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const { toast } = useToast();

  // Sync filters with URL params
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    setOverdueFilter(filterParam === 'overdue');
    setTodayFilter(filterParam === 'today');
    const statusParam = searchParams.get('status');
    if (statusParam) {
      setStatusFilter(statusParam);
    }
  }, [searchParams]);

  const clearFilter = () => {
    setOverdueFilter(false);
    setTodayFilter(false);
    searchParams.delete('filter');
    setSearchParams(searchParams);
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setLeads((data as Lead[]) || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingLead) return;

    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', deletingLead.id);
      
      if (error) throw error;
      
      toast({
        title: 'Lead removido',
        description: 'O lead foi removido com sucesso.',
      });
      
      setSelectedLeads(prev => {
        const next = new Set(prev);
        next.delete(deletingLead.id);
        return next;
      });
      fetchLeads();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeletingLead(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLeads.size === 0) return;

    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .in('id', Array.from(selectedLeads));
      
      if (error) throw error;
      
      toast({
        title: 'Leads removidos',
        description: `${selectedLeads.size} lead(s) removido(s) com sucesso.`,
      });
      
      setSelectedLeads(new Set());
      fetchLeads();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setShowBulkDeleteDialog(false);
    }
  };

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map(l => l.id)));
    }
  };

  // Apply period filter first
  const periodFilteredLeads = filterByPeriod(leads, periodFilter, dateRange);

  const filteredLeads = periodFilteredLeads.filter(lead => {
    const matchesSearch = 
      lead.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    
    const matchesResponded = respondedFilter === 'all' || 
      (respondedFilter === 'yes' && lead.responded === true) ||
      (respondedFilter === 'no' && (lead.responded === false || lead.responded === null));
    
    const matchesOverdue = !overdueFilter || hasOverdueFollowUp(lead);
    const matchesToday = !todayFilter || hasTodayFollowUp(lead);
    
    return matchesSearch && matchesStatus && matchesResponded && matchesOverdue && matchesToday;
  });

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead);
    setFormOpen(true);
  };

  const handleNewLead = () => {
    setEditingLead(null);
    setFormOpen(true);
  };

  return (
    <div className="app-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {overdueFilter ? 'Follow-ups Vencidos' : todayFilter ? 'Follow-ups de Hoje' : 'Leads'}
          </h1>
          <p className="text-muted-foreground">
            {overdueFilter ? 'Leads com follow-ups vencidos' : todayFilter ? 'Leads com follow-ups para hoje' : 'Gerencie seus leads de prospecção'}
          </p>
        </div>
        <Button onClick={handleNewLead} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Lead
        </Button>
      </div>

      {/* Filter Banners */}
      {overdueFilter && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              Exibindo apenas leads com follow-ups vencidos
            </span>
          </div>
          <button
            onClick={clearFilter}
            className="text-destructive/70 hover:text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {todayFilter && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <Calendar className="h-4 w-4" />
            <span className="text-sm font-medium">
              Exibindo apenas leads com follow-ups para hoje
            </span>
          </div>
          <button
            onClick={clearFilter}
            className="text-primary/70 hover:text-primary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por empresa ou contato..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <PeriodFilter
            value={periodFilter}
            onChange={setPeriodFilter}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              {STATUS_ORDER.map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={respondedFilter} onValueChange={setRespondedFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filtrar por resposta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Respostas</SelectItem>
              <SelectItem value="yes">Respondeu</SelectItem>
              <SelectItem value="no">Não Respondeu</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats and Selection Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {filteredLeads.length > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedLeads.size === filteredLeads.length && filteredLeads.length > 0}
                onCheckedChange={toggleSelectAll}
                aria-label="Selecionar todos"
              />
              <span className="text-sm text-muted-foreground">
                {selectedLeads.size > 0 
                  ? `${selectedLeads.size} selecionado(s)` 
                  : 'Selecionar todos'}
              </span>
            </div>
          )}
          <span className="text-sm text-muted-foreground">
            {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''} encontrado{filteredLeads.length !== 1 ? 's' : ''}
          </span>
        </div>
        
        {selectedLeads.size > 0 && (
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={() => setShowBulkDeleteDialog(true)}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Excluir Selecionados ({selectedLeads.size})
          </Button>
        )}
      </div>

      {/* Leads Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-1">Nenhum lead encontrado</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || statusFilter !== 'all' 
              ? 'Tente ajustar os filtros de busca'
              : 'Comece adicionando seu primeiro lead'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <Button onClick={handleNewLead} variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              Adicionar Lead
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredLeads.map((lead) => (
            <div key={lead.id} className="relative">
              <div className="absolute top-4 left-4 z-10">
                <Checkbox
                  checked={selectedLeads.has(lead.id)}
                  onCheckedChange={() => toggleLeadSelection(lead.id)}
                  aria-label={`Selecionar ${lead.company_name}`}
                  className="bg-background"
                />
              </div>
              <LeadCard
                lead={lead}
                onEdit={handleEdit}
                onDelete={setDeletingLead}
                onUpdate={fetchLeads}
                hasCheckbox
              />
            </div>
          ))}
        </div>
      )}

      {/* Lead Form Modal */}
      <LeadForm
        open={formOpen}
        onOpenChange={setFormOpen}
        lead={editingLead}
        onSuccess={fetchLeads}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingLead} onOpenChange={() => setDeletingLead(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o lead "{deletingLead?.company_name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Leads Selecionados</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover {selectedLeads.size} lead(s) selecionado(s)? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover {selectedLeads.size} Lead(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
