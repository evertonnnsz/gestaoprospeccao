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

const STATUS_AWARE_MESSAGES: Partial<Record<Lead['status'], Partial<Record<WhatsAppFollowUpStep, string>>>> = {
  lead_coletado: {
    follow_up_1:
      'Oi {{contact_name}}, passando para retomar meu contato com a {{company_name}}. Faz sentido eu te mostrar uma ideia simples para atrair mais clientes?',
    follow_up_2:
      'Oi {{contact_name}}, tentei falar com voce antes. Se captar mais oportunidades for prioridade na {{company_name}}, posso te explicar em poucos minutos.',
    follow_up_3:
      'Oi {{contact_name}}, vou encerrar meus contatos por aqui para nao insistir demais. Se quiser ver uma estrategia para a {{company_name}}, fico a disposicao.',
  },
  contato_iniciado: {
    follow_up_1:
      'Oi {{contact_name}}, queria dar continuidade ao nosso contato sobre a {{company_name}}. Posso te mostrar rapidamente como podemos gerar mais oportunidades?',
    follow_up_2:
      'Oi {{contact_name}}, passando para nao deixar nossa conversa esfriar. Faz sentido avancarmos com uma conversa rapida sobre a {{company_name}}?',
    follow_up_3:
      'Oi {{contact_name}}, ultimo retorno meu por enquanto. Se ainda fizer sentido falar sobre crescimento comercial da {{company_name}}, me chama por aqui.',
  },
  visualizou_nao_respondeu: {
    follow_up_1:
      'Oi {{contact_name}}, vi que minha mensagem pode ter passado em meio a correria. Posso te explicar em poucos minutos uma ideia para a {{company_name}}?',
    follow_up_2:
      'Oi {{contact_name}}, passando de novo porque acredito que a {{company_name}} pode aproveitar melhor novos contatos comerciais. Podemos falar rapidamente?',
    follow_up_3:
      'Oi {{contact_name}}, vou evitar insistir. Se quiser retomar depois uma ideia para captar mais clientes para a {{company_name}}, fico a disposicao.',
  },
  interesse_demonstrado: {
    follow_up_1:
      'Oi {{contact_name}}, como voce demonstrou interesse, queria dar o proximo passo e agendar uma conversa rapida sobre a {{company_name}}. Qual horario fica melhor?',
    follow_up_2:
      'Oi {{contact_name}}, passando para seguirmos com aquilo que conversamos sobre a {{company_name}}. Podemos marcar uma reuniao curta para eu te mostrar o plano?',
    follow_up_3:
      'Oi {{contact_name}}, ultimo toque meu para tentarmos evoluir esse interesse da {{company_name}}. Faz sentido agendarmos uma conversa ainda esta semana?',
  },
  reuniao_realizada: {
    follow_up_1:
      'Oi {{contact_name}}, obrigado pela reuniao sobre a {{company_name}}. Quer que eu organize os proximos passos para avancarmos com a proposta?',
    follow_up_2:
      'Oi {{contact_name}}, passando para saber se ficou alguma duvida depois da nossa conversa sobre a {{company_name}} e se podemos seguir para a proxima etapa.',
    follow_up_3:
      'Oi {{contact_name}}, fechando meu acompanhamento da reuniao por aqui. Se fizer sentido seguir com a {{company_name}}, me avisa que eu preparo o proximo passo.',
  },
  proposta_enviada: {
    follow_up_1:
      'Oi {{contact_name}}, passando para saber se conseguiu avaliar a proposta que enviei para a {{company_name}}. Ficou alguma duvida que eu possa esclarecer?',
    follow_up_2:
      'Oi {{contact_name}}, queria retomar a proposta da {{company_name}}. Faz sentido conversarmos rapidamente para ajustar algum ponto e seguir?',
    follow_up_3:
      'Oi {{contact_name}}, ultimo retorno meu sobre a proposta da {{company_name}} por enquanto. Se ainda fizer sentido avancar, posso te ajudar com os proximos passos.',
  },
  em_negociacao: {
    follow_up_1:
      'Oi {{contact_name}}, passando para seguirmos com a negociacao da {{company_name}}. Tem algum ponto que voce queira ajustar para avancarmos?',
    follow_up_2:
      'Oi {{contact_name}}, queria destravar a proxima etapa da negociacao com a {{company_name}}. Podemos alinhar rapidamente o que falta?',
    follow_up_3:
      'Oi {{contact_name}}, vou deixar meu ultimo retorno sobre a negociacao da {{company_name}} por aqui. Se quiser seguir, consigo te apoiar nos proximos passos.',
  },
};

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

export function renderStatusAwareWhatsAppMessage(
  lead: Lead,
  step: WhatsAppFollowUpStep,
  fallbackTemplate: string
): string {
  const statusTemplate = STATUS_AWARE_MESSAGES[lead.status]?.[step];
  return renderWhatsAppTemplate(statusTemplate || fallbackTemplate, lead);
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
  if (['agendou_reuniao', 'fechado', 'sem_interesse', 'lead_perdido'].includes(lead.status)) return false;

  const todayStr = today.toISOString().split('T')[0];
  return [lead.follow_up_1, lead.follow_up_2, lead.follow_up_3].some((date) => date === todayStr);
}
