import { cn } from '@/lib/utils';
import { LeadStatus, STATUS_LABELS } from '@/types/crm';

interface LeadStatusBadgeProps {
  status: LeadStatus;
  size?: 'sm' | 'md';
}

const statusStyles: Record<LeadStatus, string> = {
  lead_coletado: 'bg-muted text-muted-foreground border-border',
  contato_iniciado: 'bg-primary/10 text-primary border-primary/20',
  visualizou_nao_respondeu: 'bg-warning/10 text-warning border-warning/20',
  interesse_demonstrado: 'bg-success/10 text-success border-success/20',
  agendou_reuniao: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  reuniao_realizada: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  proposta_enviada: 'bg-primary/10 text-primary border-primary/20',
  em_negociacao: 'bg-warning/10 text-warning border-warning/20',
  fechado: 'bg-success text-success-foreground',
  sem_interesse: 'bg-muted text-muted-foreground border-border',
  lead_perdido: 'bg-destructive/10 text-destructive border-destructive/20',
};

export function LeadStatusBadge({ status, size = 'md' }: LeadStatusBadgeProps) {
  return (
    <span 
      className={cn(
        "inline-flex items-center rounded-full font-medium border",
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
        statusStyles[status]
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
