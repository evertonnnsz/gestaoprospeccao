import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive';
  onClick?: () => void;
}

// Ícone neutro por padrão; dourado só no destaque e cores apenas quando têm significado.
const iconStyles = {
  default: 'bg-secondary text-foreground/70',
  primary: 'bg-gold-gradient text-black shadow-[0_6px_18px_-8px_hsl(var(--primary)/0.8)]',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
};

export function StatsCard({ title, value, icon: Icon, trend, variant = 'default', onClick }: StatsCardProps) {
  return (
    <div
      className={cn(
        'gold-rule rounded-xl border bg-card p-5 shadow-sm transition-[transform,box-shadow] duration-300',
        onClick && 'lift cursor-pointer',
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="metric-label">{title}</p>
          <p className="font-display text-3xl font-semibold tracking-tight">{value}</p>
          {trend && (
            <p className={cn('text-sm font-medium', trend.isPositive ? 'text-success' : 'text-destructive')}>
              {trend.isPositive ? '+' : ''}
              {trend.value}%<span className="ml-1 text-muted-foreground">vs mês anterior</span>
            </p>
          )}
        </div>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', iconStyles[variant])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
