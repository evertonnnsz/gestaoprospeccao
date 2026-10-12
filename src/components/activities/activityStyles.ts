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

export const STATUS_STYLES: Record<ActivityStatus, { pill: string; icon: typeof Circle }> = {
  a_fazer: { pill: 'bg-slate-500 text-white', icon: Circle },
  em_andamento: { pill: 'bg-blue-600 text-white', icon: CircleDot },
  concluida: { pill: 'bg-emerald-600 text-white', icon: CheckCircle2 },
};

export const KIND_STYLES: Record<ActivityKind, { badge: string; icon: typeof Circle }> = {
  follow_up_atrasado: { badge: 'bg-red-500/10 text-red-600 dark:text-red-400', icon: AlertTriangle },
  follow_up: { badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', icon: MessageCircle },
  agenda: { badge: 'bg-violet-500/10 text-violet-700 dark:text-violet-400', icon: CalendarDays },
  contrato: { badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', icon: CalendarClock },
  pagamento: { badge: 'bg-orange-500/10 text-orange-700 dark:text-orange-400', icon: DollarSign },
  onboarding: { badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-400', icon: ClipboardCheck },
  manual: { badge: 'bg-slate-500/10 text-slate-700 dark:text-slate-300', icon: UserRound },
};

export const PRIORITY_STYLES: Record<ActivityPriority, string> = {
  urgente: 'text-red-500 fill-red-500',
  alta: 'text-amber-500 fill-amber-500',
  normal: 'text-blue-500 fill-blue-500',
  baixa: 'text-slate-400 fill-slate-400',
};
