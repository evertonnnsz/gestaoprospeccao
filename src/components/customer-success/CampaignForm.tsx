 import { useState } from 'react';
 import { useMutation } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Textarea } from '@/components/ui/textarea';
 import { toast } from '@/hooks/use-toast';
 import { Loader2, Save } from 'lucide-react';
 
 interface CampaignFormProps {
   clientId: string;
   campaign?: any;
   onSuccess: () => void;
   onCancel?: () => void;
 }
 
 type AdPlatform = 'meta_ads' | 'google_ads';
 
 export function CampaignForm({ clientId, campaign, onSuccess, onCancel }: CampaignFormProps) {
   const { user } = useAuth();
   const isEditing = !!campaign;
 
   const [formData, setFormData] = useState({
     platform: (campaign?.platform as AdPlatform) || 'meta_ads' as AdPlatform,
     campaign_name: campaign?.campaign_name || '',
     period_start: campaign?.period_start || new Date().toISOString().split('T')[0],
     period_end: campaign?.period_end || new Date().toISOString().split('T')[0],
     investment: campaign?.investment?.toString() || '',
     impressions: campaign?.impressions?.toString() || '',
     clicks: campaign?.clicks?.toString() || '',
     conversations_started: campaign?.conversations_started?.toString() || '',
     leads_generated: campaign?.leads_generated?.toString() || '',
     notes: campaign?.notes || '',
   });
 
   const mutation = useMutation({
     mutationFn: async (data: typeof formData) => {
       const payload = {
         user_id: user?.id,
         client_id: clientId,
         platform: data.platform,
         campaign_name: data.campaign_name || null,
         period_start: data.period_start,
         period_end: data.period_end,
         investment: parseFloat(data.investment) || 0,
         impressions: parseInt(data.impressions) || 0,
         clicks: parseInt(data.clicks) || 0,
         conversations_started: parseInt(data.conversations_started) || 0,
         leads_generated: parseInt(data.leads_generated) || 0,
         notes: data.notes || null,
         source: 'manual',
       };
 
       if (isEditing) {
         const { error } = await supabase
           .from('campanhas_anuncios')
           .update(payload)
           .eq('id', campaign.id);
         if (error) throw error;
       } else {
         const { error } = await supabase
           .from('campanhas_anuncios')
           .insert(payload);
         if (error) throw error;
       }
     },
     onSuccess: () => {
       toast({
         title: isEditing ? 'Campanha atualizada!' : 'Campanha registrada!',
         description: 'Os dados foram salvos com sucesso.',
       });
       if (!isEditing) {
         setFormData({
           platform: 'meta_ads',
           campaign_name: '',
           period_start: new Date().toISOString().split('T')[0],
           period_end: new Date().toISOString().split('T')[0],
           investment: '',
           impressions: '',
           clicks: '',
           conversations_started: '',
           leads_generated: '',
           notes: '',
         });
       }
       onSuccess();
     },
     onError: (error) => {
       toast({
         title: 'Erro ao salvar',
         description: error.message,
         variant: 'destructive',
       });
     },
   });
 
   const handleSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     mutation.mutate(formData);
   };
 
   return (
     <form onSubmit={handleSubmit} className="space-y-6">
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
         {/* Platform */}
         <div className="space-y-2">
           <Label htmlFor="platform">Plataforma *</Label>
           <Select 
             value={formData.platform} 
             onValueChange={(value: AdPlatform) => setFormData({ ...formData, platform: value })}
           >
             <SelectTrigger id="platform">
               <SelectValue />
             </SelectTrigger>
             <SelectContent className="bg-background border shadow-lg z-50">
               <SelectItem value="meta_ads">Meta Ads (Facebook/Instagram)</SelectItem>
               <SelectItem value="google_ads">Google Ads</SelectItem>
             </SelectContent>
           </Select>
         </div>
 
         {/* Campaign Name */}
         <div className="space-y-2">
           <Label htmlFor="campaign_name">Nome da Campanha</Label>
           <Input
             id="campaign_name"
             placeholder="Ex: Black Friday 2024"
             value={formData.campaign_name}
             onChange={(e) => setFormData({ ...formData, campaign_name: e.target.value })}
           />
         </div>
 
         {/* Period Start */}
         <div className="space-y-2">
           <Label htmlFor="period_start">Período Início *</Label>
           <Input
             id="period_start"
             type="date"
             value={formData.period_start}
             onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
             required
           />
         </div>
 
         {/* Period End */}
         <div className="space-y-2">
           <Label htmlFor="period_end">Período Fim *</Label>
           <Input
             id="period_end"
             type="date"
             value={formData.period_end}
             onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
             required
           />
         </div>
 
         {/* Investment */}
         <div className="space-y-2">
           <Label htmlFor="investment">Investimento (R$) *</Label>
           <Input
             id="investment"
             type="number"
             step="0.01"
             min="0"
             placeholder="0,00"
             value={formData.investment}
             onChange={(e) => setFormData({ ...formData, investment: e.target.value })}
             required
           />
         </div>
 
         {/* Impressions */}
         <div className="space-y-2">
           <Label htmlFor="impressions">Impressões</Label>
           <Input
             id="impressions"
             type="number"
             min="0"
             placeholder="0"
             value={formData.impressions}
             onChange={(e) => setFormData({ ...formData, impressions: e.target.value })}
           />
         </div>
 
         {/* Clicks */}
         <div className="space-y-2">
           <Label htmlFor="clicks">Cliques</Label>
           <Input
             id="clicks"
             type="number"
             min="0"
             placeholder="0"
             value={formData.clicks}
             onChange={(e) => setFormData({ ...formData, clicks: e.target.value })}
           />
         </div>
 
         {/* Conversations Started */}
         <div className="space-y-2">
           <Label htmlFor="conversations_started">Conversas Iniciadas</Label>
           <Input
             id="conversations_started"
             type="number"
             min="0"
             placeholder="0"
             value={formData.conversations_started}
             onChange={(e) => setFormData({ ...formData, conversations_started: e.target.value })}
           />
         </div>
 
         {/* Leads Generated */}
         <div className="space-y-2">
           <Label htmlFor="leads_generated">Leads na Plataforma</Label>
           <Input
             id="leads_generated"
             type="number"
             min="0"
             placeholder="0"
             value={formData.leads_generated}
             onChange={(e) => setFormData({ ...formData, leads_generated: e.target.value })}
           />
         </div>
       </div>
 
       {/* Notes */}
       <div className="space-y-2">
         <Label htmlFor="notes">Observações</Label>
         <Textarea
           id="notes"
           placeholder="Notas adicionais sobre a campanha..."
           value={formData.notes}
           onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
           rows={3}
         />
       </div>
 
       {/* Actions */}
       <div className="flex gap-3">
         <Button type="submit" disabled={mutation.isPending}>
           {mutation.isPending ? (
             <Loader2 className="w-4 h-4 mr-2 animate-spin" />
           ) : (
             <Save className="w-4 h-4 mr-2" />
           )}
           {isEditing ? 'Atualizar' : 'Salvar Lançamento'}
         </Button>
         {onCancel && (
           <Button type="button" variant="outline" onClick={onCancel}>
             Cancelar
           </Button>
         )}
       </div>
     </form>
   );
 }