import { memo, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Lead, LeadStatus, STATUS_LABELS, STATUS_ORDER, LEAD_SOURCES } from '@/types/crm';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Building2, User, Phone, Instagram, Calendar, MessageSquare, MessageCircle, FileText, MapPin } from 'lucide-react';
import { generateFollowUpDates } from '@/lib/utils/followUpDates';
import { upsertStoredMeeting } from '@/lib/fatureOS';

interface LeadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  onSuccess: () => void;
}

type LeadFormDefaults = {
  company_name: string;
  contact_name: string;
  whatsapp: string;
  instagram: string;
  status: LeadStatus;
  observations: string;
  lead_source: string;
  segment: string;
  follow_up_1: string;
  follow_up_2: string;
  follow_up_3: string;
  last_contact: string;
  next_action: string;
  meeting_date: string;
  meeting_time: string;
  meeting_notes: string;
  approach_date: string;
  responded: boolean;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  endereco_completo: string;
};

const todayISO = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildDefaults = (lead?: Lead | null): LeadFormDefaults => {
  const isEditing = !!lead?.id;
  const followUps = !isEditing ? generateFollowUpDates() : null;

  if (lead) {
    return {
      company_name: lead.company_name || '',
      contact_name: lead.contact_name || '',
      whatsapp: lead.whatsapp || '',
      instagram: lead.instagram || '',
      status: lead.status || 'lead_coletado',
      observations: lead.observations || '',
      lead_source: lead.lead_source || '',
      segment: lead.segment || '',
      follow_up_1: lead.follow_up_1 || followUps?.follow_up_1 || '',
      follow_up_2: lead.follow_up_2 || followUps?.follow_up_2 || '',
      follow_up_3: lead.follow_up_3 || followUps?.follow_up_3 || '',
      last_contact: lead.last_contact || '',
      next_action: lead.next_action || '',
      meeting_date: lead.meeting_date || '',
      meeting_time: lead.meeting_time || '',
      meeting_notes: lead.meeting_notes || '',
      approach_date: lead.approach_date || todayISO(),
      responded: lead.responded || false,
      cnpj: lead.cnpj || '',
      razao_social: lead.razao_social || '',
      nome_fantasia: lead.nome_fantasia || '',
      endereco_completo: lead.endereco_completo || '',
    };
  }

  const newLeadFollowUps = generateFollowUpDates();
  return {
    company_name: '',
    contact_name: '',
    whatsapp: '',
    instagram: '',
    status: 'lead_coletado',
    observations: '',
    lead_source: '',
    segment: '',
    follow_up_1: newLeadFollowUps.follow_up_1,
    follow_up_2: newLeadFollowUps.follow_up_2,
    follow_up_3: newLeadFollowUps.follow_up_3,
    last_contact: '',
    next_action: '',
    meeting_date: '',
    meeting_time: '',
    meeting_notes: '',
    approach_date: todayISO(),
    responded: false,
    cnpj: '',
    razao_social: '',
    nome_fantasia: '',
    endereco_completo: '',
  };
};

const readText = (form: FormData, key: keyof LeadFormDefaults) => String(form.get(key) || '');
const nullable = (value: string) => value.trim() || null;

function LeadFormComponent({ open, onOpenChange, lead, onSuccess }: LeadFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [defaults, setDefaults] = useState<LeadFormDefaults>(() => buildDefaults(lead));
  const [status, setStatus] = useState<LeadStatus>(defaults.status);
  const [leadSource, setLeadSource] = useState(defaults.lead_source);
  const [responded, setResponded] = useState(defaults.responded);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    const nextDefaults = buildDefaults(lead);
    setDefaults(nextDefaults);
    setStatus(nextDefaults.status);
    setLeadSource(nextDefaults.lead_source);
    setResponded(nextDefaults.responded);
    setFormKey((key) => key + 1);
  }, [lead, open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    const form = new FormData(event.currentTarget);
    setLoading(true);

    const meetingDate = readText(form, 'meeting_date');
    const payload = {
      user_id: user.id,
      company_name: readText(form, 'company_name'),
      contact_name: nullable(readText(form, 'contact_name')),
      whatsapp: nullable(readText(form, 'whatsapp')),
      instagram: nullable(readText(form, 'instagram')),
      status,
      observations: nullable(readText(form, 'observations')),
      lead_source: nullable(leadSource),
      segment: nullable(readText(form, 'segment')),
      follow_up_1: nullable(readText(form, 'follow_up_1')),
      follow_up_2: nullable(readText(form, 'follow_up_2')),
      follow_up_3: nullable(readText(form, 'follow_up_3')),
      last_contact: nullable(readText(form, 'last_contact')),
      next_action: nullable(readText(form, 'next_action')),
      meeting_date: status === 'agendou_reuniao' || meetingDate ? nullable(meetingDate) : null,
      meeting_time: status === 'agendou_reuniao' || meetingDate ? nullable(readText(form, 'meeting_time')) : null,
      meeting_notes: status === 'agendou_reuniao' || meetingDate ? nullable(readText(form, 'meeting_notes')) : null,
      approach_date: nullable(readText(form, 'approach_date')),
      responded,
      cnpj: nullable(readText(form, 'cnpj')),
      razao_social: nullable(readText(form, 'razao_social')),
      nome_fantasia: nullable(readText(form, 'nome_fantasia')),
      endereco_completo: nullable(readText(form, 'endereco_completo')),
    };

    try {
      let savedLeadId = lead?.id;

      if (lead?.id) {
        const { error } = await supabase.from('leads').update(payload).eq('id', lead.id);
        if (error) throw error;
        toast({ title: 'Lead atualizado!', description: 'As informações foram salvas com sucesso.' });
      } else {
        const { error } = await supabase.from('leads').insert(payload);
        if (error) throw error;
        savedLeadId = `local-${Date.now()}`;
        toast({ title: 'Lead criado!', description: 'O novo lead foi adicionado com sucesso.' });
      }

      if (savedLeadId && meetingDate) {
        upsertStoredMeeting({
          leadId: savedLeadId,
          companyName: payload.company_name,
          date: meetingDate,
          time: nullable(readText(form, 'meeting_time')) || undefined,
          notes: nullable(readText(form, 'meeting_notes')) || undefined,
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

        <form key={formKey} onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Empresa *</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="company_name" name="company_name" className="pl-10" defaultValue={defaults.company_name} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="approach_date">Data do Cadastro</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="approach_date" name="approach_date" type="date" className="pl-10" defaultValue={defaults.approach_date} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_name">Nome do Contato</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="contact_name" name="contact_name" className="pl-10" defaultValue={defaults.contact_name} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="whatsapp" name="whatsapp" className="pl-10" placeholder="+55 11 99999-9999" defaultValue={defaults.whatsapp} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <div className="relative">
                <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="instagram" name="instagram" className="pl-10" placeholder="@usuario" defaultValue={defaults.instagram} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as LeadStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((statusOption) => (
                    <SelectItem key={statusOption} value={statusOption}>
                      {STATUS_LABELS[statusOption]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {status === 'agendou_reuniao' && (
              <div className="md:col-span-2 rounded-lg border border-warning/30 bg-warning/5 p-4 space-y-4">
                <Label className="flex items-center gap-2 text-base font-semibold">
                  <Calendar className="w-4 h-4 text-warning" />
                  Reunião comercial
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="meeting_date">Data da reunião</Label>
                    <Input id="meeting_date" name="meeting_date" type="date" defaultValue={defaults.meeting_date} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="meeting_time">Horário</Label>
                    <Input id="meeting_time" name="meeting_time" type="time" defaultValue={defaults.meeting_time} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meeting_notes">Observações da reunião</Label>
                  <Textarea
                    id="meeting_notes"
                    name="meeting_notes"
                    rows={2}
                    placeholder="Ex: Diagnóstico inicial, reunião pelo Google Meet, alinhar proposta..."
                    defaultValue={defaults.meeting_notes}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="lead_source">Origem do Lead</Label>
              <Select value={leadSource || undefined} onValueChange={setLeadSource}>
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

            <div className="space-y-2">
              <Label htmlFor="segment">Segmento</Label>
              <Input id="segment" name="segment" placeholder="Ex: Tecnologia, Saúde, Varejo" defaultValue={defaults.segment} />
            </div>
          </div>

          <div className="space-y-4">
            <Label className="flex items-center gap-2 text-base font-semibold">
              <FileText className="w-4 h-4" />
              Dados Empresariais
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input id="cnpj" name="cnpj" placeholder="00.000.000/0000-00" defaultValue={defaults.cnpj} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="razao_social">Razão Social</Label>
                <Input id="razao_social" name="razao_social" placeholder="Nome jurídico da empresa" defaultValue={defaults.razao_social} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                <Input id="nome_fantasia" name="nome_fantasia" placeholder="Nome comercial" defaultValue={defaults.nome_fantasia} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="endereco_completo" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Endereço Completo
              </Label>
              <Textarea
                id="endereco_completo"
                name="endereco_completo"
                rows={2}
                placeholder="Logradouro, nº, bairro, cidade - UF, CEP"
                defaultValue={defaults.endereco_completo}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="next_action">Próxima Ação</Label>
            <Input id="next_action" name="next_action" placeholder="Ex: Enviar proposta, Ligar" defaultValue={defaults.next_action} />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Follow-ups
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="follow_up_1" className="text-xs text-muted-foreground">Follow-up 1</Label>
                <Input id="follow_up_1" name="follow_up_1" type="date" defaultValue={defaults.follow_up_1} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="follow_up_2" className="text-xs text-muted-foreground">Follow-up 2</Label>
                <Input id="follow_up_2" name="follow_up_2" type="date" defaultValue={defaults.follow_up_2} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="follow_up_3" className="text-xs text-muted-foreground">Follow-up 3</Label>
                <Input id="follow_up_3" name="follow_up_3" type="date" defaultValue={defaults.follow_up_3} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="last_contact">Último Contato</Label>
            <Input id="last_contact" name="last_contact" type="date" defaultValue={defaults.last_contact} />
          </div>

          <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
            <Checkbox id="responded" checked={responded} onCheckedChange={(checked) => setResponded(checked === true)} />
            <Label htmlFor="responded" className="flex items-center gap-2 cursor-pointer">
              <MessageCircle className="w-4 h-4 text-success" />
              Lead respondeu a mensagem
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observations" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Observações
            </Label>
            <Textarea id="observations" name="observations" rows={4} placeholder="Anotações sobre o lead..." defaultValue={defaults.observations} />
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
