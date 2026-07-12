import { memo, useCallback, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Lead, LeadStatus, STATUS_LABELS, STATUS_ORDER } from '@/types/crm';
import { LEAD_SOURCES } from '@/types/crm';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Building2, User, Phone, Instagram, Calendar, MessageSquare, MessageCircle, FileText, MapPin } from 'lucide-react';
import { generateFollowUpDates } from '@/lib/utils/followUpDates';

interface LeadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  onSuccess: () => void;
}

function LeadFormComponent({ open, onOpenChange, lead, onSuccess }: LeadFormProps) {
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
    meeting_date: '',
    meeting_time: '',
    meeting_notes: '',
    approach_date: new Date().toISOString().split('T')[0],
    responded: false,
    cnpj: '',
    razao_social: '',
    nome_fantasia: '',
    endereco_completo: '',
  });

  const getDefaultFormData = () => {
    const followUps = generateFollowUpDates();
    return {
      company_name: '',
      contact_name: '',
      whatsapp: '',
      instagram: '',
      status: 'lead_coletado' as LeadStatus,
      observations: '',
      lead_source: '',
      segment: '',
      follow_up_1: followUps.follow_up_1,
      follow_up_2: followUps.follow_up_2,
      follow_up_3: followUps.follow_up_3,
      last_contact: '',
      next_action: '',
      meeting_date: '',
      meeting_time: '',
      meeting_notes: '',
      approach_date: new Date().toISOString().split('T')[0],
      responded: false,
      cnpj: '',
      razao_social: '',
      nome_fantasia: '',
      endereco_completo: '',
    };
  };

  const updateFormField = useCallback((field: string, value: string | boolean | LeadStatus) => {
    setFormData((current) => ({ ...current, [field]: value }));
  }, []);

  // Reset form when dialog opens or lead prop changes
  useEffect(() => {
    if (open) {
      if (lead) {
        const isEditing = !!lead.id;
        const followUps = !isEditing ? generateFollowUpDates() : null;
        setFormData({
          company_name: lead.company_name || '',
          contact_name: lead.contact_name || '',
          whatsapp: lead.whatsapp || '',
          instagram: lead.instagram || '',
          status: lead.status || 'lead_coletado',
          observations: lead.observations || '',
          lead_source: lead.lead_source || '',
          segment: lead.segment || '',
          follow_up_1: lead.follow_up_1 || (followUps?.follow_up_1 ?? ''),
          follow_up_2: lead.follow_up_2 || (followUps?.follow_up_2 ?? ''),
          follow_up_3: lead.follow_up_3 || (followUps?.follow_up_3 ?? ''),
          last_contact: lead.last_contact || '',
          next_action: lead.next_action || '',
          meeting_date: lead.meeting_date || '',
          meeting_time: lead.meeting_time || '',
          meeting_notes: lead.meeting_notes || '',
          approach_date: lead.approach_date || new Date().toISOString().split('T')[0],
          responded: lead.responded || false,
          cnpj: lead.cnpj || '',
          razao_social: lead.razao_social || '',
          nome_fantasia: lead.nome_fantasia || '',
          endereco_completo: lead.endereco_completo || '',
        });
      } else {
        setFormData(getDefaultFormData());
      }
    }
  }, [open, lead]);

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
      meeting_date: formData.status === 'agendou_reuniao' ? formData.meeting_date || null : null,
      meeting_time: formData.status === 'agendou_reuniao' ? formData.meeting_time || null : null,
      meeting_notes: formData.status === 'agendou_reuniao' ? formData.meeting_notes || null : null,
      approach_date: formData.approach_date || null,
      responded: formData.responded,
      cnpj: formData.cnpj || null,
      razao_social: formData.razao_social || null,
      nome_fantasia: formData.nome_fantasia || null,
      endereco_completo: formData.endereco_completo || null,
    };

    try {
      if (lead?.id) {
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
          <DialogTitle>{lead?.id ? 'Editar Lead' : 'Novo Lead'}</DialogTitle>
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
                  onChange={(e) => updateFormField('company_name', e.target.value)}
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
                  onChange={(e) => updateFormField('approach_date', e.target.value)}
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
                  onChange={(e) => updateFormField('contact_name', e.target.value)}
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
                  onChange={(e) => updateFormField('whatsapp', e.target.value)}
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
                  onChange={(e) => updateFormField('instagram', e.target.value)}
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => updateFormField('status', value as LeadStatus)}
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

            {formData.status === 'agendou_reuniao' && (
              <div className="md:col-span-2 rounded-lg border border-warning/30 bg-warning/5 p-4 space-y-4">
                <Label className="flex items-center gap-2 text-base font-semibold">
                  <Calendar className="w-4 h-4 text-warning" />
                  Reunião comercial
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="meeting_date">Data da reunião</Label>
                    <Input
                      id="meeting_date"
                      type="date"
                      value={formData.meeting_date}
                      onChange={(e) => updateFormField('meeting_date', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="meeting_time">Horário</Label>
                    <Input
                      id="meeting_time"
                      type="time"
                      value={formData.meeting_time}
                      onChange={(e) => updateFormField('meeting_time', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meeting_notes">Observações da reunião</Label>
                  <Textarea
                    id="meeting_notes"
                    rows={2}
                    placeholder="Ex: Diagnóstico inicial, reunião pelo Google Meet, alinhar proposta..."
                    value={formData.meeting_notes}
                    onChange={(e) => updateFormField('meeting_notes', e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Lead Source */}
            <div className="space-y-2">
              <Label htmlFor="lead_source">Origem do Lead</Label>
              <Select
                value={formData.lead_source || undefined}
                onValueChange={(value) => updateFormField('lead_source', value)}
              >
                <SelectTrigger id="lead_source">
                  <SelectValue placeholder="Selecione a origem" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Segment */}
            <div className="space-y-2">
              <Label htmlFor="segment">Segmento</Label>
              <Input
                id="segment"
                placeholder="Ex: Tecnologia, Saúde, Varejo"
                value={formData.segment}
                onChange={(e) => updateFormField('segment', e.target.value)}
              />
          </div>

          {/* Dados Empresariais */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2 text-base font-semibold">
              <FileText className="w-4 h-4" />
              Dados Empresariais
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  placeholder="00.000.000/0000-00"
                  value={formData.cnpj}
                  onChange={(e) => updateFormField('cnpj', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="razao_social">Razão Social</Label>
                <Input
                  id="razao_social"
                  placeholder="Nome jurídico da empresa"
                  value={formData.razao_social}
                  onChange={(e) => updateFormField('razao_social', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                <Input
                  id="nome_fantasia"
                  placeholder="Nome comercial"
                  value={formData.nome_fantasia}
                  onChange={(e) => updateFormField('nome_fantasia', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="endereco_completo" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Endereço Completo
              </Label>
              <Textarea
                id="endereco_completo"
                rows={2}
                placeholder="Logradouro, nº, bairro, cidade - UF, CEP"
                value={formData.endereco_completo}
                onChange={(e) => updateFormField('endereco_completo', e.target.value)}
              />
            </div>
          </div>

            {/* Next Action */}
            <div className="space-y-2">
              <Label htmlFor="next_action">Próxima Ação</Label>
              <Input
                id="next_action"
                placeholder="Ex: Enviar proposta, Ligar"
                value={formData.next_action}
                onChange={(e) => updateFormField('next_action', e.target.value)}
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
                  onChange={(e) => updateFormField('follow_up_1', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="follow_up_2" className="text-xs text-muted-foreground">Follow-up 2</Label>
                <Input
                  id="follow_up_2"
                  type="date"
                  value={formData.follow_up_2}
                  onChange={(e) => updateFormField('follow_up_2', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="follow_up_3" className="text-xs text-muted-foreground">Follow-up 3</Label>
                <Input
                  id="follow_up_3"
                  type="date"
                  value={formData.follow_up_3}
                  onChange={(e) => updateFormField('follow_up_3', e.target.value)}
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
              onChange={(e) => updateFormField('last_contact', e.target.value)}
            />
          </div>

          {/* Responded Checkbox */}
          <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
            <Checkbox
              id="responded"
              checked={formData.responded}
              onCheckedChange={(checked) => updateFormField('responded', checked === true)}
            />
            <Label htmlFor="responded" className="flex items-center gap-2 cursor-pointer">
              <MessageCircle className="w-4 h-4 text-success" />
              Lead respondeu a mensagem
            </Label>
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
              onChange={(e) => updateFormField('observations', e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : lead?.id ? 'Atualizar' : 'Criar Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export const LeadForm = memo(LeadFormComponent);
