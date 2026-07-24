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

const variantStyles = {
  default: 'bg-card',
  primary: 'bg-card border-primary/20',
  success: 'bg-card border-success/20',
  warning: 'bg-card border-warning/20',
  destructive: 'bg-card border-destructive/20',
};

const iconStyles = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
};

export function StatsCard({ title, value, icon: Icon, trend, variant = 'default', onClick }: StatsCardProps) {
  return (
    <div 
      className={cn(
        "rounded-xl p-6 shadow-sm border border-border/50 transition-all hover:shadow-md animate-fade-in",
        variantStyles[variant],
        onClick && "cursor-pointer hover:-translate-y-0.5"
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="metric-label">{title}</p>
          <p className="text-3xl font-semibold tracking-normal">{value}</p>
          {trend && (
            <p className={cn(
              "text-sm font-medium",
              trend.isPositive ? "text-success" : "text-destructive"
            )}>
              {trend.isPositive ? '+' : ''}{trend.value}%
              <span className="text-muted-foreground ml-1">vs mês anterior</span>
            </p>
          )}
        </div>
        <div className={cn("w-11 h-11 rounded-lg flex items-center justify-center", iconStyles[variant])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
