export type LeadStatus = 
  | 'lead_coletado'
  | 'contato_iniciado'
  | 'visualizou_nao_respondeu'
  | 'interesse_demonstrado'
  | 'agendou_reuniao'
  | 'reuniao_realizada'
  | 'proposta_enviada'
  | 'em_negociacao'
  | 'fechado'
  | 'sem_interesse'
  | 'lead_perdido';

export interface Lead {
  id: string;
  user_id: string;
  approach_date: string;
  company_name: string;
  contact_name: string | null;
  whatsapp: string | null;
  instagram: string | null;
  status: LeadStatus;
  observations: string | null;
  lead_source: string | null;
  segment: string | null;
  follow_up_1: string | null;
  follow_up_2: string | null;
  follow_up_3: string | null;
  last_contact: string | null;
  next_action: string | null;
  responded: boolean | null;
  cnpj: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  endereco_completo: string | null;
  created_at: string;
  updated_at: string;
}

export type MonthlyPaymentStatus = 'paid' | 'overdue' | 'pending';

export interface Client {
  id: string;
  user_id: string;
  lead_id: string;
  project_value: number | null;
  project_start_date: string | null;
  payment_due_date: string | null;
  contract_url: string | null;
  services: string | null;
  contract_duration_months: number | null;
  notes: string | null;
  monthly_payment_status: MonthlyPaymentStatus | null;
  created_at: string;
  updated_at: string;
  lead?: Lead;
}

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  company_name: string | null;
  company_logo_url: string | null;
  theme_color: string;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'user';
}

export const STATUS_LABELS: Record<LeadStatus, string> = {
  lead_coletado: 'Lead Coletado',
  contato_iniciado: 'Contato Iniciado',
  visualizou_nao_respondeu: 'Visualizou e Não Respondeu',
  interesse_demonstrado: 'Interesse Demonstrado',
  agendou_reuniao: 'Agendou Reunião',
  reuniao_realizada: 'Reunião Realizada',
  proposta_enviada: 'Proposta Enviada',
  em_negociacao: 'Em Negociação',
  fechado: 'Fechado',
  sem_interesse: 'Sem Interesse',
  lead_perdido: 'Lead Perdido',
};

export const STATUS_ORDER: LeadStatus[] = [
  'lead_coletado',
  'contato_iniciado',
  'visualizou_nao_respondeu',
  'interesse_demonstrado',
  'agendou_reuniao',
  'reuniao_realizada',
  'proposta_enviada',
  'em_negociacao',
  'fechado',
  'sem_interesse',
  'lead_perdido',
];

// Origens de leads padronizadas para metrificação
export const LEAD_SOURCES = [
  'Tráfego',
  'WhatsApp',
  'Instagram',
  'PaP',
  'Cold Call',
] as const;

export type LeadSource = typeof LEAD_SOURCES[number];

// Staging Lead types
export interface StagingLead {
  id: string;
  user_id: string;
  company_name: string;
  contact_name: string | null;
  whatsapp: string | null;
  instagram: string | null;
  segment: string | null;
  observations: string | null;
  cnpj: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  endereco_completo: string | null;
  is_reviewed: boolean;
  has_validation_errors: boolean;
  is_duplicate: boolean;
  duplicate_lead_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const validateStagingLead = (lead: StagingLead): ValidationResult => {
  const errors: string[] = [];

  // Validate company name
  if (!lead.company_name?.trim()) {
    errors.push('Nome da empresa é obrigatório');
  }

  // Validate phone (Brazilian format: 10-11 digits)
  if (lead.whatsapp) {
    const digits = lead.whatsapp.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 11) {
      errors.push('Telefone com formato inválido (esperado 10-11 dígitos)');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
