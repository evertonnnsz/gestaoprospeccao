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
import { Loader2, Save, Plus, X } from 'lucide-react';
 
 interface CampaignFormProps {
   clientId: string;
   campaign?: any;
   onSuccess: () => void;
   onCancel?: () => void;
 }
 
 type AdPlatform = 'meta_ads' | 'google_ads';
 
interface CustomMetric {
  id: string;
  name: string;
  value: string;
}

 export function CampaignForm({ clientId, campaign, onSuccess, onCancel }: CampaignFormProps) {
   const { user } = useAuth();
   const isEditing = !!campaign;
 
  // Initialize custom metrics from campaign data
  const getInitialCustomMetrics = (): CustomMetric[] => {
    if (campaign?.custom_metrics && Array.isArray(campaign.custom_metrics)) {
      return campaign.custom_metrics.map((m: any, index: number) => ({
        id: `existing-${index}`,
        name: m.name || '',
        value: m.value?.toString() || '',
      }));
    }
    return [];
  };

  const [customMetrics, setCustomMetrics] = useState<CustomMetric[]>(getInitialCustomMetrics);

   const [formData, setFormData] = useState({
     platform: (campaign?.platform as AdPlatform) || 'meta_ads' as AdPlatform,
     campaign_name: campaign?.campaign_name || '',
     period_start: campaign?.period_start || new Date().toISOString().split('T')[0],
     period_end: campaign?.period_end || new Date().toISOString().split('T')[0],
     investment: campaign?.investment?.toString() || '',
     notes: campaign?.notes || '',
   });
 
  const addCustomMetric = () => {
    const newMetric: CustomMetric = {
      id: `new-${Date.now()}`,
      name: '',
      value: '',
    };
    setCustomMetrics([...customMetrics, newMetric]);
  };

  const removeCustomMetric = (id: string) => {
    setCustomMetrics(customMetrics.filter(m => m.id !== id));
  };

  const updateCustomMetric = (id: string, field: 'name' | 'value', newValue: string) => {
    setCustomMetrics(customMetrics.map(m => 
      m.id === id ? { ...m, [field]: newValue } : m
    ));
  };

   const mutation = useMutation({
     mutationFn: async (data: typeof formData) => {
      // Filter out metrics without names and convert to storage format
      const metricsToSave = customMetrics
        .filter(m => m.name.trim() !== '')
        .map(m => ({
          name: m.name.trim(),
          value: parseFloat(m.value) || 0,
        }));

       const payload = {
         user_id: user?.id,
         client_id: clientId,
         platform: data.platform,
         campaign_name: data.campaign_name || null,
         period_start: data.period_start,
         period_end: data.period_end,
         investment: parseFloat(data.investment) || 0,
        impressions: 0,
        clicks: 0,
        conversations_started: 0,
        leads_generated: 0,
        custom_metrics: metricsToSave,
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
           notes: '',
         });
        setCustomMetrics([]);
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
      </div>
 
      {/* Custom Metrics Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-medium">Métricas Personalizadas</Label>
            <p className="text-sm text-muted-foreground">Adicione as métricas que deseja acompanhar</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCustomMetric}
            className="gap-1"
          >
            <Plus className="w-4 h-4" />
            Adicionar Métrica
          </Button>
        </div>
 
        {/* Custom Metrics List */}
        <div className="space-y-3">
          {customMetrics.map((metric, index) => (
            <div key={metric.id} className="flex items-start gap-3 p-3 border border-border rounded-lg bg-muted/20">
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="Nome da métrica (ex: Alcance, CPM, Vendas...)"
                  value={metric.name}
                  onChange={(e) => updateCustomMetric(metric.id, 'name', e.target.value)}
                />
              </div>
              <div className="w-32 space-y-2">
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="Valor"
                  value={metric.value}
                  onChange={(e) => updateCustomMetric(metric.id, 'value', e.target.value)}
                />
              </div>
              <div className="pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeCustomMetric(metric.id)}
                  title="Remover métrica"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
         </div>
 
        {customMetrics.length === 0 && (
          <div className="text-center py-6 border border-dashed border-border rounded-lg">
            <p className="text-sm text-muted-foreground">
              Nenhuma métrica adicionada ainda.
            </p>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={addCustomMetric}
              className="mt-2"
            >
              <Plus className="w-4 h-4 mr-1" />
              Adicionar primeira métrica
            </Button>
          </div>
        )}
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