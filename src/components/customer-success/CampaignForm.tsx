 import { useState } from 'react';
 import { useMutation } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
 import { toast } from '@/hooks/use-toast';
import { Loader2, Save, Plus, X } from 'lucide-react';
 
 interface CampaignFormProps {
   clientId: string;
   campaign?: any;
   onSuccess: () => void;
   onCancel?: () => void;
 }
 
 type AdPlatform = 'meta_ads' | 'google_ads';
 
type MetricKey = 'impressions' | 'clicks' | 'conversations_started' | 'leads_generated';

interface MetricConfig {
  key: MetricKey;
  label: string;
  placeholder: string;
}

const AVAILABLE_METRICS: MetricConfig[] = [
  { key: 'impressions', label: 'Impressões', placeholder: '0' },
  { key: 'clicks', label: 'Cliques', placeholder: '0' },
  { key: 'conversations_started', label: 'Conversas Iniciadas', placeholder: '0' },
  { key: 'leads_generated', label: 'Leads na Plataforma', placeholder: '0' },
];

 export function CampaignForm({ clientId, campaign, onSuccess, onCancel }: CampaignFormProps) {
   const { user } = useAuth();
   const isEditing = !!campaign;
 
  // Determine which metrics to show initially based on existing campaign data
  const getInitialActiveMetrics = (): MetricKey[] => {
    if (!campaign) return ['impressions', 'clicks']; // Default metrics for new campaigns
    const active: MetricKey[] = [];
    if (campaign.impressions > 0) active.push('impressions');
    if (campaign.clicks > 0) active.push('clicks');
    if (campaign.conversations_started > 0) active.push('conversations_started');
    if (campaign.leads_generated > 0) active.push('leads_generated');
    return active.length > 0 ? active : ['impressions', 'clicks'];
  };

  const [activeMetrics, setActiveMetrics] = useState<MetricKey[]>(getInitialActiveMetrics);
  const [showMetricSelector, setShowMetricSelector] = useState(false);

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
 
  const toggleMetric = (metricKey: MetricKey) => {
    setActiveMetrics(prev => {
      if (prev.includes(metricKey)) {
        // Remove metric and clear its value
        setFormData(fd => ({ ...fd, [metricKey]: '' }));
        return prev.filter(k => k !== metricKey);
      }
      return [...prev, metricKey];
    });
  };

  const removeMetric = (metricKey: MetricKey) => {
    setActiveMetrics(prev => prev.filter(k => k !== metricKey));
    setFormData(fd => ({ ...fd, [metricKey]: '' }));
  };

  const inactiveMetrics = AVAILABLE_METRICS.filter(m => !activeMetrics.includes(m.key));

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
        setActiveMetrics(['impressions', 'clicks']);
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
 
      {/* Dynamic Metrics Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">Métricas</Label>
          {inactiveMetrics.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowMetricSelector(!showMetricSelector)}
              className="gap-1"
            >
              <Plus className="w-4 h-4" />
              Adicionar Métrica
            </Button>
          )}
        </div>
 
        {/* Metric Selector Dropdown */}
        {showMetricSelector && inactiveMetrics.length > 0 && (
          <div className="p-3 border border-border rounded-lg bg-muted/30 space-y-2">
            <p className="text-sm text-muted-foreground mb-2">Selecione as métricas que deseja adicionar:</p>
            <div className="flex flex-wrap gap-2">
              {inactiveMetrics.map((metric) => (
                <Button
                  key={metric.key}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    toggleMetric(metric.key);
                    if (inactiveMetrics.length === 1) {
                      setShowMetricSelector(false);
                    }
                  }}
                  className="gap-1"
                >
                  <Plus className="w-3 h-3" />
                  {metric.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Active Metrics Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AVAILABLE_METRICS.filter(m => activeMetrics.includes(m.key)).map((metric) => (
            <div key={metric.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={metric.key}>{metric.label}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeMetric(metric.key)}
                  title={`Remover ${metric.label}`}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
              <Input
                id={metric.key}
                type="number"
                min="0"
                placeholder={metric.placeholder}
                value={formData[metric.key]}
                onChange={(e) => setFormData({ ...formData, [metric.key]: e.target.value })}
              />
            </div>
          ))}
         </div>
 
        {activeMetrics.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
            Nenhuma métrica selecionada. Clique em "Adicionar Métrica" para escolher quais campos usar.
          </p>
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