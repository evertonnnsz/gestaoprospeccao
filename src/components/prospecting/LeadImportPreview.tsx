import { useState, useEffect, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  Check, 
  Save, 
  Loader2,
  Users,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { ImportedLead } from './LeadImportModal';

interface LeadImportPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: ImportedLead[];
  onSuccess: () => void;
}

interface LeadWithStatus extends ImportedLead {
  id: string;
  isDuplicate: boolean;
  isSelected: boolean;
  isSaved: boolean;
}

const formatPhone = (phone: string): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

export function LeadImportPreview({ 
  open, 
  onOpenChange, 
  leads: rawLeads,
  onSuccess 
}: LeadImportPreviewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<LeadWithStatus[]>([]);
  const [isChecking, setIsChecking] = useState(true);

  // Check duplicates when modal opens
  useEffect(() => {
    if (!open || !user || rawLeads.length === 0) return;

    const checkDuplicates = async () => {
      setIsChecking(true);
      
      try {
        const { data: existingLeads } = await supabase
          .from('leads')
          .select('company_name, whatsapp')
          .eq('user_id', user.id);

        const existingNames = new Set(
          existingLeads?.map(l => l.company_name.toLowerCase().trim()) || []
        );
        
        const existingPhones = new Set(
          existingLeads?.filter(l => l.whatsapp)
            .map(l => l.whatsapp?.replace(/\D/g, '')) || []
        );

        const leadsWithStatus: LeadWithStatus[] = rawLeads.map((lead, index) => {
          const isDuplicate = 
            existingNames.has(lead.company_name.toLowerCase().trim()) ||
            (lead.whatsapp ? existingPhones.has(lead.whatsapp.replace(/\D/g, '')) : false);

          return {
            ...lead,
            id: `import-${index}`,
            isDuplicate,
            isSelected: !isDuplicate,
            isSaved: false,
          };
        });

        setLeads(leadsWithStatus);
      } catch (error) {
        console.error('Error checking duplicates:', error);
        // If error, assume no duplicates
        setLeads(rawLeads.map((lead, index) => ({
          ...lead,
          id: `import-${index}`,
          isDuplicate: false,
          isSelected: true,
          isSaved: false,
        })));
      } finally {
        setIsChecking(false);
      }
    };

    checkDuplicates();
  }, [open, rawLeads, user]);

  const stats = useMemo(() => {
    const newLeads = leads.filter(l => !l.isDuplicate && !l.isSaved);
    const duplicates = leads.filter(l => l.isDuplicate);
    const saved = leads.filter(l => l.isSaved);
    const selected = leads.filter(l => l.isSelected && !l.isSaved);
    return { newLeads: newLeads.length, duplicates: duplicates.length, saved: saved.length, selected: selected.length };
  }, [leads]);

  const toggleSelectAll = () => {
    const newLeadsAllSelected = leads
      .filter(l => !l.isDuplicate && !l.isSaved)
      .every(l => l.isSelected);

    setLeads(prev => prev.map(lead => ({
      ...lead,
      isSelected: lead.isDuplicate || lead.isSaved ? lead.isSelected : !newLeadsAllSelected,
    })));
  };

  const toggleLead = (id: string) => {
    setLeads(prev => prev.map(lead => 
      lead.id === id ? { ...lead, isSelected: !lead.isSelected } : lead
    ));
  };

  const saveLeadsMutation = useMutation({
    mutationFn: async (leadsToSave: LeadWithStatus[]) => {
      if (!user) throw new Error('Usuário não autenticado');

      const records = leadsToSave.map(lead => ({
        user_id: user.id,
        company_name: lead.company_name,
        contact_name: lead.contact_name || null,
        whatsapp: lead.whatsapp || null,
        instagram: lead.instagram || null,
        segment: lead.segment || null,
        observations: lead.observations || null,
        status: 'lead_coletado' as const,
        lead_source: 'Importação de Lista',
        approach_date: new Date().toISOString().split('T')[0],
      }));

      const { error } = await supabase.from('leads').insert(records);
      if (error) throw error;
      
      return { count: records.length, ids: leadsToSave.map(l => l.id) };
    },
    onSuccess: ({ count, ids }) => {
      setLeads(prev => prev.map(lead => 
        ids.includes(lead.id) ? { ...lead, isSaved: true, isSelected: false } : lead
      ));
      
      toast({
        title: 'Importação concluída!',
        description: `${count} lead(s) importado(s) com sucesso.`,
      });
    },
    onError: (error) => {
      console.error('Error saving leads:', error);
      toast({
        title: 'Erro ao importar',
        description: 'Ocorreu um erro ao salvar os leads. Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  const handleSaveIndividual = (lead: LeadWithStatus) => {
    saveLeadsMutation.mutate([lead]);
  };

  const handleSaveSelected = () => {
    const selected = leads.filter(l => l.isSelected && !l.isSaved);
    if (selected.length === 0) {
      toast({
        title: 'Nenhum lead selecionado',
        description: 'Selecione pelo menos um lead para importar.',
        variant: 'destructive',
      });
      return;
    }
    saveLeadsMutation.mutate(selected);
  };

  const handleClose = () => {
    if (stats.saved > 0) {
      onSuccess();
    }
    setLeads([]);
    onOpenChange(false);
  };

  const allNewSelected = leads
    .filter(l => !l.isDuplicate && !l.isSaved)
    .every(l => l.isSelected);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Triagem de Leads Importados
          </DialogTitle>
        </DialogHeader>

        {isChecking ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Verificando duplicatas...</span>
          </div>
        ) : (
          <>
            {/* Stats and Select All */}
            <div className="flex flex-wrap items-center justify-between gap-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allNewSelected && stats.newLeads > 0}
                  onCheckedChange={toggleSelectAll}
                  disabled={stats.newLeads === 0}
                />
                <span className="text-sm font-medium">Selecionar todos novos</span>
              </div>
              
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="secondary" className="gap-1">
                  <Check className="w-3 h-3" />
                  Novos: {stats.newLeads}
                </Badge>
                <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300 bg-amber-50">
                  <AlertTriangle className="w-3 h-3" />
                  Duplicados: {stats.duplicates}
                </Badge>
                {stats.saved > 0 && (
                  <Badge variant="default" className="gap-1 bg-green-600">
                    <Check className="w-3 h-3" />
                    Salvos: {stats.saved}
                  </Badge>
                )}
              </div>
            </div>

            {/* Table */}
            <ScrollArea className="flex-1 min-h-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead className="w-28">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map(lead => (
                    <TableRow 
                      key={lead.id}
                      className={
                        lead.isSaved 
                          ? 'bg-green-50 dark:bg-green-950/20' 
                          : lead.isDuplicate 
                            ? 'bg-amber-50 dark:bg-amber-950/20' 
                            : ''
                      }
                    >
                      <TableCell>
                        {lead.isSaved ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : lead.isDuplicate ? (
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        ) : (
                          <Checkbox
                            checked={lead.isSelected}
                            onCheckedChange={() => toggleLead(lead.id)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {lead.company_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {lead.contact_name || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {lead.whatsapp ? formatPhone(lead.whatsapp) : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {lead.segment || '-'}
                      </TableCell>
                      <TableCell>
                        {lead.isSaved ? (
                          <Badge variant="default" className="bg-green-600">
                            Salvo
                          </Badge>
                        ) : lead.isDuplicate ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">
                            Existe
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSaveIndividual(lead)}
                            disabled={saveLeadsMutation.isPending}
                          >
                            <Save className="w-3 h-3 mr-1" />
                            Salvar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Legend and Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>Leads em amarelo possivelmente já estão cadastrados</span>
              </div>
              
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleClose}>
                  {stats.saved > 0 ? 'Concluir' : 'Cancelar'}
                </Button>
                <Button 
                  onClick={handleSaveSelected}
                  disabled={stats.selected === 0 || saveLeadsMutation.isPending}
                >
                  {saveLeadsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Salvar Selecionados ({stats.selected})
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
