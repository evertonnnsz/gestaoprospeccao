import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bot, CheckCircle2, Loader2, MessageCircle, RefreshCw, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Lead } from '@/types/crm';
import { LeadStatusBadge } from '@/components/leads/LeadStatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  DEFAULT_WHATSAPP_TEMPLATES,
  WhatsAppFollowUpStep,
  WhatsAppLog,
  WhatsAppTemplate,
  getDueFollowUpStep,
  getWhatsAppUrl,
  isLeadEligibleForWhatsAppFollowUp,
  normalizeWhatsAppPhone,
  renderWhatsAppTemplate,
} from '@/lib/utils/whatsapp';
import { generateNextFollowUpFromContact } from '@/lib/utils/followUpDates';

const STEP_LABELS: Record<WhatsAppFollowUpStep, string> = {
  initial: 'Primeira abordagem',
  follow_up_1: 'Follow-up 1',
  follow_up_2: 'Follow-up 2',
  follow_up_3: 'Follow-up 3',
  custom: 'Personalizado',
};

const db = supabase as any;

export default function WhatsAppFollowUps() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Record<string, string>>({});
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [sendingLeadId, setSendingLeadId] = useState<string | null>(null);

  const dueLeads = useMemo(
    () => leads.filter((lead) => isLeadEligibleForWhatsAppFollowUp(lead)),
    [leads]
  );

  const sentTodayLeadIds = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return new Set(
      logs
        .filter((log) => log.status === 'sent' && log.sent_at?.startsWith(today))
        .map((log) => log.lead_id)
    );
  }, [logs]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchData();
    }
  }, [user, isAdmin]);

  useEffect(() => {
    const nextTemplateIds: Record<string, string> = {};
    const nextDrafts: Record<string, string> = {};

    dueLeads.forEach((lead) => {
      const step = getDueFollowUpStep(lead);
      const template = templates.find((item) => item.follow_up_step === step && item.is_active) || templates[0];

      if (template) {
        nextTemplateIds[lead.id] = selectedTemplateIds[lead.id] || template.id;
        const currentTemplate = templates.find((item) => item.id === nextTemplateIds[lead.id]) || template;
        nextDrafts[lead.id] = messageDrafts[lead.id] || renderWhatsAppTemplate(currentTemplate.body, lead);
      }
    });

    setSelectedTemplateIds((current) => ({ ...nextTemplateIds, ...current }));
    setMessageDrafts((current) => ({ ...nextDrafts, ...current }));
  }, [dueLeads.length, templates.length]);

  const fetchData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const [{ data: leadsData, error: leadsError }, { data: templatesData, error: templatesError }, { data: logsData, error: logsError }] =
        await Promise.all([
          supabase.from('leads').select('*').order('created_at', { ascending: false }),
          db.from('whatsapp_message_templates').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
          db.from('whatsapp_message_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
        ]);

      if (leadsError) throw leadsError;
      if (templatesError) throw templatesError;
      if (logsError) throw logsError;

      setLeads((leadsData as Lead[]) || []);
      setLogs((logsData as WhatsAppLog[]) || []);

      if (!templatesData?.length) {
        const templatesToInsert = DEFAULT_WHATSAPP_TEMPLATES.map((template) => ({
          ...template,
          user_id: user.id,
        }));
        const { data: insertedTemplates, error: insertError } = await db
          .from('whatsapp_message_templates')
          .insert(templatesToInsert)
          .select('*');

        if (insertError) throw insertError;
        setTemplates((insertedTemplates as WhatsAppTemplate[]) || []);
      } else {
        setTemplates(templatesData as WhatsAppTemplate[]);
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar follow-ups',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateChange = (lead: Lead, templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;

    setSelectedTemplateIds((current) => ({ ...current, [lead.id]: templateId }));
    setMessageDrafts((current) => ({
      ...current,
      [lead.id]: renderWhatsAppTemplate(template.body, lead),
    }));
  };

  const handleSend = async (lead: Lead) => {
    if (!user || !isAdmin) return;

    const phone = normalizeWhatsAppPhone(lead.whatsapp);
    const message = messageDrafts[lead.id]?.trim();
    const templateId = selectedTemplateIds[lead.id] || null;
    const step = getDueFollowUpStep(lead);

    if (!phone || !message) {
      toast({
        title: 'Mensagem incompleta',
        description: 'Confirme o WhatsApp e a mensagem antes de enviar.',
        variant: 'destructive',
      });
      return;
    }

    setSendingLeadId(lead.id);
    try {
      const { error: logError } = await db.from('whatsapp_message_logs').insert({
        user_id: user.id,
        lead_id: lead.id,
        template_id: templateId,
        follow_up_step: step,
        phone,
        message,
        status: 'sent',
        provider: 'wa.me',
        sent_at: new Date().toISOString(),
      });

      if (logError) throw logError;

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const leadUpdates: Partial<Lead> = {
        last_contact: todayStr,
        status: lead.status === 'lead_coletado' ? 'contato_iniciado' : lead.status,
      };

      if (step === 'follow_up_1') {
        leadUpdates.follow_up_1 = null;
        leadUpdates.follow_up_2 = generateNextFollowUpFromContact(today, 2);
      }

      if (step === 'follow_up_2') {
        leadUpdates.follow_up_2 = null;
        leadUpdates.follow_up_3 = generateNextFollowUpFromContact(today, 3);
      }

      if (step === 'follow_up_3') {
        leadUpdates.follow_up_3 = null;
      }

      const { error: leadError } = await supabase
        .from('leads')
        .update(leadUpdates)
        .eq('id', lead.id);

      if (leadError) throw leadError;

      window.open(getWhatsAppUrl(phone, message), '_blank');

      toast({
        title: 'WhatsApp aberto',
        description: 'O envio foi registrado no histórico do CRM.',
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erro ao registrar envio',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSendingLeadId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold">Acesso negado</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Esta automacao de WhatsApp esta disponivel apenas para administradores.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Follow-ups WhatsApp</h1>
          <p className="text-muted-foreground">
            Leads com follow-up vencido ou programado para hoje.
          </p>
        </div>
        <Button variant="outline" onClick={fetchData} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Pendentes agora</p>
          <p className="text-2xl font-bold">{dueLeads.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Enviados hoje</p>
          <p className="text-2xl font-bold">{sentTodayLeadIds.size}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Modelos ativos</p>
          <p className="text-2xl font-bold">{templates.filter((template) => template.is_active).length}</p>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : dueLeads.length === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto text-success mb-3" />
          <h2 className="font-semibold">Nenhum follow-up pendente</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Quando houver leads com data vencida ou de hoje, eles aparecem aqui.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {dueLeads.map((lead) => {
            const step = getDueFollowUpStep(lead);
            const selectedTemplate = templates.find((template) => template.id === selectedTemplateIds[lead.id]);
            const alreadySentToday = sentTodayLeadIds.has(lead.id);

            return (
              <Card key={lead.id} className="p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold">{lead.company_name}</h2>
                      <LeadStatusBadge status={lead.status} size="sm" />
                      {alreadySentToday && <Badge variant="secondary">Enviado hoje</Badge>}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MessageCircle className="w-4 h-4" />
                      <span>{lead.whatsapp}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Bot className="w-4 h-4" />
                      <span>{STEP_LABELS[step]}</span>
                    </div>
                  </div>
                  <Badge variant="outline">
                    {format(new Date(), "dd/MM", { locale: ptBR })}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <Select
                    value={selectedTemplate?.id || ''}
                    onValueChange={(templateId) => handleTemplateChange(lead, templateId)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates
                        .filter((template) => template.is_active)
                        .map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  <Textarea
                    value={messageDrafts[lead.id] || ''}
                    onChange={(event) =>
                      setMessageDrafts((current) => ({ ...current, [lead.id]: event.target.value }))
                    }
                    rows={5}
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={() => handleSend(lead)}
                    disabled={sendingLeadId === lead.id}
                    className="gap-2"
                  >
                    {sendingLeadId === lead.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Abrir WhatsApp e registrar
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
