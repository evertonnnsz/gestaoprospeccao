import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Lead, LeadStatus, STATUS_LABELS, STATUS_ORDER } from '@/types/crm';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Building2, User, Phone, Instagram, Calendar, MessageSquare } from 'lucide-react';

interface LeadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  onSuccess: () => void;
}

export function LeadForm({ open, onOpenChange, lead, onSuccess }: LeadFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    whatsapp: '',
    instagram: '',
    status: 'lead_coletado' as LeadStatus,
    observations: '',
    lead_source: '',
    segment: '',
    follow_up_1: '',
    follow_up_2: '',
    follow_up_3: '',
    last_contact: '',
    next_action: '',
    approach_date: new Date().toISOString().split('T')[0],
  });

  // Sync form data when lead prop changes
  useEffect(() => {
    if (lead) {
      setFormData({
        company_name: lead.company_name || '',
        contact_name: lead.contact_name || '',
        whatsapp: lead.whatsapp || '',
        instagram: lead.instagram || '',
        status: lead.status || 'lead_coletado',
        observations: lead.observations || '',
        lead_source: lead.lead_source || '',
        segment: lead.segment || '',
        follow_up_1: lead.follow_up_1 || '',
        follow_up_2: lead.follow_up_2 || '',
        follow_up_3: lead.follow_up_3 || '',
        last_contact: lead.last_contact || '',
        next_action: lead.next_action || '',
        approach_date: lead.approach_date || new Date().toISOString().split('T')[0],
      });
    } else {
      setFormData({
        company_name: '',
        contact_name: '',
        whatsapp: '',
        instagram: '',
        status: 'lead_coletado',
        observations: '',
        lead_source: '',
        segment: '',
        follow_up_1: '',
        follow_up_2: '',
        follow_up_3: '',
        last_contact: '',
        next_action: '',
        approach_date: new Date().toISOString().split('T')[0],
      });
    }
  }, [lead]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    const payload = {
      ...formData,
      user_id: user.id,
      follow_up_1: formData.follow_up_1 || null,
      follow_up_2: formData.follow_up_2 || null,
      follow_up_3: formData.follow_up_3 || null,
      last_contact: formData.last_contact || null,
      approach_date: formData.approach_date || null,
    };

    try {
      if (lead) {
        const { error } = await supabase
          .from('leads')
          .update(payload)
          .eq('id', lead.id);
        
        if (error) throw error;
        
        toast({
          title: 'Lead atualizado!',
          description: 'As informações foram salvas com sucesso.',
        });
      } else {
        const { error } = await supabase
          .from('leads')
          .insert(payload);
        
        if (error) throw error;
        
        toast({
          title: 'Lead criado!',
          description: 'O novo lead foi adicionado com sucesso.',
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? 'Editar Lead' : 'Novo Lead'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="company_name">Empresa *</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="company_name"
                  className="pl-10"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Approach Date */}
            <div className="space-y-2">
              <Label htmlFor="approach_date">Data do Cadastro</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="approach_date"
                  type="date"
                  className="pl-10"
                  value={formData.approach_date}
                  onChange={(e) => setFormData({ ...formData, approach_date: e.target.value })}
                />
              </div>
            </div>

            {/* Contact Name */}
            <div className="space-y-2">
              <Label htmlFor="contact_name">Nome do Contato</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="contact_name"
                  className="pl-10"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                />
              </div>
            </div>

            {/* WhatsApp */}
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="whatsapp"
                  className="pl-10"
                  placeholder="+55 11 99999-9999"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                />
              </div>
            </div>

            {/* Instagram */}
            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <div className="relative">
                <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="instagram"
                  className="pl-10"
                  placeholder="@usuario"
                  value={formData.instagram}
                  onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => setFormData({ ...formData, status: value as LeadStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lead Source */}
            <div className="space-y-2">
              <Label htmlFor="lead_source">Origem do Lead</Label>
              <Input
                id="lead_source"
                placeholder="Ex: LinkedIn, Indicação, Site"
                value={formData.lead_source}
                onChange={(e) => setFormData({ ...formData, lead_source: e.target.value })}
              />
            </div>

            {/* Segment */}
            <div className="space-y-2">
              <Label htmlFor="segment">Segmento</Label>
              <Input
                id="segment"
                placeholder="Ex: Tecnologia, Saúde, Varejo"
                value={formData.segment}
                onChange={(e) => setFormData({ ...formData, segment: e.target.value })}
              />
            </div>

            {/* Next Action */}
            <div className="space-y-2">
              <Label htmlFor="next_action">Próxima Ação</Label>
              <Input
                id="next_action"
                placeholder="Ex: Enviar proposta, Ligar"
                value={formData.next_action}
                onChange={(e) => setFormData({ ...formData, next_action: e.target.value })}
              />
            </div>
          </div>

          {/* Follow-ups */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Follow-ups
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="follow_up_1" className="text-xs text-muted-foreground">Follow-up 1</Label>
                <Input
                  id="follow_up_1"
                  type="date"
                  value={formData.follow_up_1}
                  onChange={(e) => setFormData({ ...formData, follow_up_1: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="follow_up_2" className="text-xs text-muted-foreground">Follow-up 2</Label>
                <Input
                  id="follow_up_2"
                  type="date"
                  value={formData.follow_up_2}
                  onChange={(e) => setFormData({ ...formData, follow_up_2: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="follow_up_3" className="text-xs text-muted-foreground">Follow-up 3</Label>
                <Input
                  id="follow_up_3"
                  type="date"
                  value={formData.follow_up_3}
                  onChange={(e) => setFormData({ ...formData, follow_up_3: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Last Contact */}
          <div className="space-y-2">
            <Label htmlFor="last_contact">Último Contato</Label>
            <Input
              id="last_contact"
              type="date"
              value={formData.last_contact}
              onChange={(e) => setFormData({ ...formData, last_contact: e.target.value })}
            />
          </div>

          {/* Observations */}
          <div className="space-y-2">
            <Label htmlFor="observations" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Observações
            </Label>
            <Textarea
              id="observations"
              rows={4}
              placeholder="Anotações sobre o lead..."
              value={formData.observations}
              onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : lead ? 'Atualizar' : 'Criar Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
