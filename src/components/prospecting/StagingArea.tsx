import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { StagingLead, validateStagingLead } from '@/types/crm';
import { StagingLeadEditModal } from './StagingLeadEditModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Clock,
  CheckCircle,
  AlertTriangle,
  Copy,
  Pencil,
  Trash2,
  Send,
  Eye,
  RefreshCw,
} from 'lucide-react';

interface StagingAreaProps {
  onLeadApproved?: () => void;
}

export function StagingArea({ onLeadApproved }: StagingAreaProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stagingLeads, setStagingLeads] = useState<StagingLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingLead, setEditingLead] = useState<StagingLead | null>(null);
  const [showBulkApproveDialog, setShowBulkApproveDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchStagingLeads = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('staging_leads')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Validate each lead
      const leadsWithValidation = (data || []).map(lead => {
        const validation = validateStagingLead(lead as StagingLead);
        return {
          ...lead,
          has_validation_errors: !validation.isValid,
        } as StagingLead;
      });

      setStagingLeads(leadsWithValidation);
    } catch (err) {
      console.error('Error fetching staging leads:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os leads em espera.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStagingLeads();
  }, [user]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === stagingLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(stagingLeads.map(l => l.id)));
    }
  };

  const handleApproveOne = async (lead: StagingLead) => {
    if (!user) return;

    const validation = validateStagingLead(lead);
    if (!validation.isValid) {
      toast({
        title: 'Erro de Validação',
        description: validation.errors.join(', '),
        variant: 'destructive',
      });
      return;
    }

    if (lead.is_duplicate) {
      toast({
        title: 'Lead Duplicado',
        description: 'Este lead já existe na base. Edite ou exclua-o.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Insert into leads
      const { error: insertError } = await supabase.from('leads').insert({
        user_id: user.id,
        company_name: lead.company_name,
        contact_name: lead.contact_name,
        whatsapp: lead.whatsapp,
        instagram: lead.instagram,
        segment: lead.segment,
        observations: lead.observations,
        status: 'lead_coletado',
        lead_source: 'Importação de Lista',
        approach_date: new Date().toISOString().split('T')[0],
      });

      if (insertError) throw insertError;

      // Delete from staging
      const { error: deleteError } = await supabase
        .from('staging_leads')
        .delete()
        .eq('id', lead.id);

      if (deleteError) throw deleteError;

      setStagingLeads(prev => prev.filter(l => l.id !== lead.id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });

      toast({
        title: 'Lead Aprovado!',
        description: `${lead.company_name} foi adicionado aos leads.`,
      });

      onLeadApproved?.();
    } catch (err) {
      console.error('Error approving lead:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível aprovar o lead.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkApprove = async () => {
    if (!user || selectedIds.size === 0) return;

    setIsProcessing(true);

    const selectedLeads = stagingLeads.filter(l => selectedIds.has(l.id));
    const validLeads = selectedLeads.filter(l => {
      const validation = validateStagingLead(l);
      return validation.isValid && !l.is_duplicate;
    });

    if (validLeads.length === 0) {
      toast({
        title: 'Nenhum lead válido',
        description: 'Todos os leads selecionados têm erros ou são duplicados.',
        variant: 'destructive',
      });
      setIsProcessing(false);
      setShowBulkApproveDialog(false);
      return;
    }

    try {
      // Insert all valid leads
      const leadsToInsert = validLeads.map(lead => ({
        user_id: user.id,
        company_name: lead.company_name,
        contact_name: lead.contact_name,
        whatsapp: lead.whatsapp,
        instagram: lead.instagram,
        segment: lead.segment,
        observations: lead.observations,
        status: 'lead_coletado' as const,
        lead_source: 'Importação de Lista',
        approach_date: new Date().toISOString().split('T')[0],
      }));

      const { error: insertError } = await supabase
        .from('leads')
        .insert(leadsToInsert);

      if (insertError) throw insertError;

      // Delete from staging
      const idsToDelete = validLeads.map(l => l.id);
      const { error: deleteError } = await supabase
        .from('staging_leads')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) throw deleteError;

      setStagingLeads(prev => prev.filter(l => !idsToDelete.includes(l.id)));
      setSelectedIds(new Set());

      const skippedCount = selectedLeads.length - validLeads.length;
      toast({
        title: 'Leads Aprovados!',
        description: `${validLeads.length} leads foram adicionados.${skippedCount > 0 ? ` ${skippedCount} ignorados por erros ou duplicatas.` : ''}`,
      });

      onLeadApproved?.();
    } catch (err) {
      console.error('Error bulk approving leads:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível aprovar os leads.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setShowBulkApproveDialog(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!user || selectedIds.size === 0) return;

    setIsProcessing(true);

    try {
      const { error } = await supabase
        .from('staging_leads')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      setStagingLeads(prev => prev.filter(l => !selectedIds.has(l.id)));
      setSelectedIds(new Set());

      toast({
        title: 'Leads Excluídos',
        description: `${selectedIds.size} leads foram removidos da sala de espera.`,
      });
    } catch (err) {
      console.error('Error deleting leads:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir os leads.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleEditSave = async (updatedLead: StagingLead) => {
    try {
      const { error } = await supabase
        .from('staging_leads')
        .update({
          company_name: updatedLead.company_name,
          contact_name: updatedLead.contact_name,
          whatsapp: updatedLead.whatsapp,
          instagram: updatedLead.instagram,
          segment: updatedLead.segment,
          observations: updatedLead.observations,
          is_reviewed: true,
        })
        .eq('id', updatedLead.id);

      if (error) throw error;

      // Re-fetch to update validation status
      await fetchStagingLeads();

      toast({
        title: 'Lead Atualizado',
        description: 'As alterações foram salvas.',
      });
    } catch (err) {
      console.error('Error updating lead:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as alterações.',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (lead: StagingLead) => {
    if (lead.is_duplicate) {
      return (
        <Badge variant="destructive" className="gap-1">
          <Copy className="w-3 h-3" />
          Duplicado
        </Badge>
      );
    }
    if (lead.has_validation_errors) {
      return (
        <Badge variant="outline" className="gap-1 border-destructive text-destructive">
          <AlertTriangle className="w-3 h-3" />
          Erro
        </Badge>
      );
    }
    if (lead.is_reviewed) {
      return (
        <Badge variant="outline" className="gap-1 border-primary text-primary">
          <CheckCircle className="w-3 h-3" />
          Revisado
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="w-3 h-3" />
        Aguardando
      </Badge>
    );
  };

  if (stagingLeads.length === 0 && !isLoading) {
    return null;
  }

  const pendingCount = stagingLeads.filter(l => !l.is_reviewed).length;
  const reviewedCount = stagingLeads.filter(l => l.is_reviewed).length;
  const duplicateCount = stagingLeads.filter(l => l.is_duplicate).length;

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Sala de Espera
              </CardTitle>
              <Badge variant="secondary">
                {stagingLeads.length} leads
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchStagingLeads}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-2">
            <span>Aguardando: {pendingCount}</span>
            <span>Revisados: {reviewedCount}</span>
            {duplicateCount > 0 && (
              <span className="text-destructive">Duplicados: {duplicateCount}</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.size === stagingLeads.length && stagingLeads.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Segmento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stagingLeads.map(lead => {
                      const validation = validateStagingLead(lead);
                      const hasPhoneError = lead.whatsapp && validation.errors.some(e => e.includes('Telefone'));

                      return (
                        <TableRow
                          key={lead.id}
                          className={lead.has_validation_errors ? 'bg-destructive/5' : undefined}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(lead.id)}
                              onCheckedChange={() => toggleSelection(lead.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {lead.company_name}
                          </TableCell>
                          <TableCell className={hasPhoneError ? 'text-destructive' : ''}>
                            {lead.whatsapp || '-'}
                            {hasPhoneError && (
                              <AlertTriangle className="w-3 h-3 inline ml-1" />
                            )}
                          </TableCell>
                          <TableCell>{lead.segment || '-'}</TableCell>
                          <TableCell>{getStatusBadge(lead)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingLead(lead)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              {lead.is_duplicate ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Ver lead existente"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleApproveOne(lead)}
                                  disabled={isProcessing || lead.has_validation_errors}
                                  title="Aprovar e enviar para leads"
                                >
                                  <Send className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Bulk Actions */}
              {selectedIds.size > 0 && (
                <div className="flex flex-wrap gap-3 pt-4 border-t mt-4">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowBulkDeleteDialog(true)}
                    disabled={isProcessing}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir Selecionados ({selectedIds.size})
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowBulkApproveDialog(true)}
                    disabled={isProcessing}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Enviar Selecionados para Leads ({selectedIds.size})
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <StagingLeadEditModal
        lead={editingLead}
        onClose={() => setEditingLead(null)}
        onSave={handleEditSave}
        onApprove={handleApproveOne}
      />

      {/* Bulk Approve Dialog */}
      <AlertDialog open={showBulkApproveDialog} onOpenChange={setShowBulkApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar {selectedIds.size} leads?</AlertDialogTitle>
            <AlertDialogDescription>
              Você conferiu todos os dados dos leads selecionados?
              <br />
              <br />
              <strong>Importante:</strong> Leads com erros de validação ou marcados como duplicados serão ignorados automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkApprove} disabled={isProcessing}>
              {isProcessing ? 'Processando...' : 'Sim, Aprovar Todos'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} leads?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Os leads selecionados serão removidos permanentemente da sala de espera.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
