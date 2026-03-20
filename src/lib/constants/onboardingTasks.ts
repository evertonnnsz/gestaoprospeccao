export interface OnboardingTaskTemplate {
  task_order: string;
  task_name: string;
  platform: 'geral' | 'google_ads' | 'meta_ads' | 'site';
}

export const DEFAULT_ONBOARDING_TASKS: OnboardingTaskTemplate[] = [
  { task_order: '0.0', task_name: 'Reunião de Kickoff', platform: 'geral' },
  { task_order: '1.0', task_name: 'Formulário de Onboarding', platform: 'geral' },
  { task_order: '1.1', task_name: 'Perfil no ChatGPT', platform: 'geral' },
  { task_order: '1.2', task_name: 'Google Drive', platform: 'geral' },
  { task_order: '5.0', task_name: 'Criar Dashboard', platform: 'geral' },
  { task_order: '2.0', task_name: 'Acesso à Ferramenta Google Ads', platform: 'google_ads' },
  { task_order: '2.1', task_name: 'Criar TAG do Google Ads', platform: 'google_ads' },
  { task_order: '2.2', task_name: 'Criar Palavras Chaves', platform: 'google_ads' },
  { task_order: '2.3', task_name: 'Criar Públicos Google Ads', platform: 'google_ads' },
  { task_order: '2.4', task_name: 'Subir Primeira Campanha Google Ads', platform: 'google_ads' },
  { task_order: '3.0', task_name: 'Acesso à Ferramenta Meta Ads', platform: 'meta_ads' },
  { task_order: '3.1', task_name: 'Criar Pixel', platform: 'meta_ads' },
  { task_order: '3.2', task_name: 'Criar Públicos Meta Ads', platform: 'meta_ads' },
  { task_order: '3.3', task_name: 'Solicitar Conteúdos', platform: 'meta_ads' },
  { task_order: '3.4', task_name: 'Subir Primeira Campanha Meta Ads', platform: 'meta_ads' },
  { task_order: '4.0', task_name: 'Acesso ao Site', platform: 'site' },
  { task_order: '4.1', task_name: 'Criar GA4', platform: 'site' },
  { task_order: '4.2', task_name: 'Criar GTM', platform: 'site' },
  { task_order: '4.3', task_name: 'Instalar as TAGs do GTM no Site', platform: 'site' },
  { task_order: '4.4', task_name: 'Configurar Pixel e TAGs no GTM', platform: 'site' },
  { task_order: '4.5', task_name: 'Criar Landing Pages', platform: 'site' },
];

export const PLATFORM_LABELS: Record<string, string> = {
  geral: 'Geral',
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  site: 'Site',
};

export const PLATFORM_COLORS: Record<string, string> = {
  geral: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  google_ads: 'bg-red-500/20 text-red-400 border-red-500/30',
  meta_ads: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  site: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};
