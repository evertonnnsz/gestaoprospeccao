import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Circle,
  CircleDot,
  ClipboardCheck,
  DollarSign,
  MessageCircle,
  UserRound,
} from 'lucide-react';
import type { ActivityKind, ActivityPriority, ActivityStatus } from '@/hooks/useDailyActivities';

// Paleta da marca: neutros + dourado; vermelho/laranja só para atraso e vencimento.
export const STATUS_STYLES: Record<ActivityStatus, { pill: string; icon: typeof Circle }> = {
  a_fazer: { pill: 'bg-secondary text-secondary-foreground border border-border', icon: Circle },
  em_andamento: { pill: 'bg-primary text-primary-foreground', icon: CircleDot },
  concluida: { pill: 'bg-foreground text-background', icon: CheckCircle2 },
};

export const KIND_STYLES: Record<ActivityKind, { badge: string; icon: typeof Circle }> = {
  follow_up_atrasado: { badge: 'bg-destructive/10 text-destructive', icon: AlertTriangle },
  follow_up: { badge: 'bg-accent text-accent-foreground', icon: MessageCircle },
  agenda: { badge: 'bg-secondary text-secondary-foreground', icon: CalendarDays },
  contrato: { badge: 'bg-warning/10 text-warning', icon: CalendarClock },
  pagamento: { badge: 'bg-warning/10 text-warning', icon: DollarSign },
  onboarding: { badge: 'bg-secondary text-secondary-foreground', icon: ClipboardCheck },
  manual: { badge: 'bg-muted text-muted-foreground', icon: UserRound },
};

export const PRIORITY_STYLES: Record<ActivityPriority, string> = {
  urgente: 'text-destructive fill-destructive',
  alta: 'text-warning fill-warning',
  normal: 'text-primary fill-primary',
  baixa: 'text-muted-foreground fill-muted-foreground',
};
