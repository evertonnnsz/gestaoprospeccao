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
  created_at: string;
  updated_at: string;
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
