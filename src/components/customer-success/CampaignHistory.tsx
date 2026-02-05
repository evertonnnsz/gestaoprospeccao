 import { useState } from 'react';
 import { useMutation } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
 import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
 import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
 import { Skeleton } from '@/components/ui/skeleton';
 import { toast } from '@/hooks/use-toast';
 import { Pencil, Trash2, History, Loader2 } from 'lucide-react';
 import { CampaignForm } from './CampaignForm';
 import { format } from 'date-fns';
 import { ptBR } from 'date-fns/locale';
 
 interface Campaign {
   id: string;
   platform: string;
   campaign_name: string | null;
   period_start: string;
   period_end: string;
   investment: number;
   impressions: number;
   clicks: number;
   conversations_started: number;
   leads_generated: number;
   source: string;
   created_at: string;
 }
 
 interface CampaignHistoryProps {
   clientId: string;
   campaigns: Campaign[];
   isLoading: boolean;
   onUpdate: () => void;
 }
 
 export function CampaignHistory({ clientId, campaigns, isLoading, onUpdate }: CampaignHistoryProps) {
   const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
   const [deletingId, setDeletingId] = useState<string | null>(null);
 
   const deleteMutation = useMutation({
     mutationFn: async (id: string) => {
       const { error } = await supabase
         .from('campanhas_anuncios')
         .delete()
         .eq('id', id);
       if (error) throw error;
     },
     onSuccess: () => {
       toast({ title: 'Lançamento excluído!' });
       setDeletingId(null);
       onUpdate();
     },
     onError: (error) => {
       toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
     },
   });
 
   if (isLoading) {
     return (
       <Card>
         <CardHeader>
           <Skeleton className="h-6 w-48" />
         </CardHeader>
         <CardContent>
           <Skeleton className="h-64 w-full" />
         </CardContent>
       </Card>
     );
   }
 
   if (campaigns.length === 0) {
     return null;
   }
 
   const formatDate = (date: string) => {
     try {
       return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR });
     } catch {
       return date;
     }
   };
 
   return (
     <>
       <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <History className="w-5 h-5" />
             Histórico de Lançamentos
           </CardTitle>
           <CardDescription>
             {campaigns.length} lançamento(s) registrado(s)
           </CardDescription>
         </CardHeader>
         <CardContent>
           <div className="overflow-x-auto">
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Plataforma</TableHead>
                   <TableHead>Campanha</TableHead>
                   <TableHead>Período</TableHead>
                   <TableHead className="text-right">Investimento</TableHead>
                   <TableHead className="text-right">Impressões</TableHead>
                   <TableHead className="text-right">Cliques</TableHead>
                   <TableHead className="text-right">Conversas</TableHead>
                   <TableHead className="text-right">Leads</TableHead>
                   <TableHead>Origem</TableHead>
                   <TableHead className="text-right">Ações</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {campaigns.map((campaign) => (
                   <TableRow key={campaign.id}>
                     <TableCell>
                       <Badge variant={campaign.platform === 'meta_ads' ? 'default' : 'secondary'}>
                         {campaign.platform === 'meta_ads' ? 'Meta Ads' : 'Google Ads'}
                       </Badge>
                     </TableCell>
                     <TableCell className="font-medium">
                       {campaign.campaign_name || '-'}
                     </TableCell>
                     <TableCell className="whitespace-nowrap">
                       {formatDate(campaign.period_start)} - {formatDate(campaign.period_end)}
                     </TableCell>
                     <TableCell className="text-right">
                       R$ {Number(campaign.investment).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                     </TableCell>
                     <TableCell className="text-right">
                       {campaign.impressions.toLocaleString()}
                     </TableCell>
                     <TableCell className="text-right">
                       {campaign.clicks.toLocaleString()}
                     </TableCell>
                     <TableCell className="text-right">
                       {campaign.conversations_started}
                     </TableCell>
                     <TableCell className="text-right">
                       {campaign.leads_generated}
                     </TableCell>
                     <TableCell>
                       <Badge variant="outline">
                         {campaign.source === 'import' ? 'Importado' : 'Manual'}
                       </Badge>
                     </TableCell>
                     <TableCell className="text-right">
                       <div className="flex justify-end gap-1">
                         <Button
                           variant="ghost"
                           size="icon"
                           onClick={() => setEditingCampaign(campaign)}
                         >
                           <Pencil className="w-4 h-4" />
                         </Button>
                         <AlertDialog>
                           <AlertDialogTrigger asChild>
                             <Button variant="ghost" size="icon" className="text-destructive">
                               <Trash2 className="w-4 h-4" />
                             </Button>
                           </AlertDialogTrigger>
                           <AlertDialogContent>
                             <AlertDialogHeader>
                               <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
                               <AlertDialogDescription>
                                 Esta ação não pode ser desfeita. O lançamento será removido permanentemente.
                               </AlertDialogDescription>
                             </AlertDialogHeader>
                             <AlertDialogFooter>
                               <AlertDialogCancel>Cancelar</AlertDialogCancel>
                               <AlertDialogAction
                                 onClick={() => deleteMutation.mutate(campaign.id)}
                                 className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                               >
                                 {deleteMutation.isPending ? (
                                   <Loader2 className="w-4 h-4 animate-spin" />
                                 ) : 'Excluir'}
                               </AlertDialogAction>
                             </AlertDialogFooter>
                           </AlertDialogContent>
                         </AlertDialog>
                       </div>
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
           </div>
         </CardContent>
       </Card>
 
       {/* Edit Dialog */}
       <Dialog open={!!editingCampaign} onOpenChange={() => setEditingCampaign(null)}>
         <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle>Editar Lançamento</DialogTitle>
           </DialogHeader>
           {editingCampaign && (
             <CampaignForm
               clientId={clientId}
               campaign={editingCampaign}
               onSuccess={() => {
                 setEditingCampaign(null);
                 onUpdate();
               }}
               onCancel={() => setEditingCampaign(null)}
             />
           )}
         </DialogContent>
       </Dialog>
     </>
   );
 }