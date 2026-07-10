import { Lead } from '@/types/crm';

export type WhatsAppFollowUpStep =
  | 'initial'
  | 'follow_up_1'
  | 'follow_up_2'
  | 'follow_up_3'
  | 'custom';

export interface WhatsAppTemplate {
  id: string;
  user_id: string;
  name: string;
  follow_up_step: WhatsAppFollowUpStep;
  body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppLog {
  id: string;
  user_id: string;
  lead_id: string;
  template_id: string | null;
  follow_up_step: WhatsAppFollowUpStep;
  phone: string;
  message: string;
  status: 'draft' | 'sent' | 'failed';
  provider: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export const DEFAULT_WHATSAPP_TEMPLATES: Array<Pick<WhatsAppTemplate, 'name' | 'follow_up_step' | 'body'>> = [
  {
    name: 'Primeira abordagem',
    follow_up_step: 'initial',
    body:
      'Oi {{contact_name}}, tudo bem? Aqui e Everton. Vi a {{company_name}} e acredito que posso te ajudar a gerar mais oportunidades comerciais. Podemos conversar rapidamente?',
  },
  {
    name: 'Follow-up 1',
    follow_up_step: 'follow_up_1',
    body:
      'Oi {{contact_name}}, passando para retomar meu contato sobre a {{company_name}}. Faz sentido eu te mostrar uma ideia simples para atrair mais clientes?',
  },
  {
    name: 'Follow-up 2',
    follow_up_step: 'follow_up_2',
    body:
      'Oi {{contact_name}}, tentei falar com voce antes. Se aumentar o volume de interessados for prioridade na {{company_name}}, posso te explicar em poucos minutos.',
  },
  {
    name: 'Follow-up 3',
    follow_up_step: 'follow_up_3',
    body:
      'Oi {{contact_name}}, vou encerrar meus contatos por aqui para nao insistir demais. Se quiser ver uma estrategia para a {{company_name}}, fico a disposicao.',
  },
];

export function normalizeWhatsAppPhone(phone: string | null): string {
  const digits = (phone || '').replace(/\D/g, '');

  if (!digits) return '';
  if (digits.startsWith('55')) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;

  return digits;
}

export function getLeadFirstName(lead: Lead): string {
  const fallback = lead.company_name || 'tudo bem';
  const name = lead.contact_name?.trim() || fallback;
  return name.split(/\s+/)[0] || fallback;
}

export function renderWhatsAppTemplate(template: string, lead: Lead): string {
  const values: Record<string, string> = {
    company_name: lead.company_name || '',
    contact_name: getLeadFirstName(lead),
    full_contact_name: lead.contact_name || '',
    segment: lead.segment || '',
    next_action: lead.next_action || '',
    instagram: lead.instagram || '',
  };

  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? '');
}

export function getWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function getDueFollowUpStep(lead: Lead, today = new Date()): WhatsAppFollowUpStep {
  const todayStr = today.toISOString().split('T')[0];

  if (lead.follow_up_1 === todayStr) return 'follow_up_1';
  if (lead.follow_up_2 === todayStr) return 'follow_up_2';
  if (lead.follow_up_3 === todayStr) return 'follow_up_3';

  return 'initial';
}

export function isLeadEligibleForWhatsAppFollowUp(lead: Lead, today = new Date()): boolean {
  if (!normalizeWhatsAppPhone(lead.whatsapp)) return false;
  if (lead.responded) return false;
  if (['fechado', 'sem_interesse', 'lead_perdido'].includes(lead.status)) return false;

  const todayStr = today.toISOString().split('T')[0];
  return [lead.follow_up_1, lead.follow_up_2, lead.follow_up_3].some((date) => date === todayStr);
}
