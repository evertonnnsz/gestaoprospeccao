import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from 'lucide-react';

export type PeriodType = 'today' | 'week' | 'month' | 'year' | 'all';

interface PeriodFilterProps {
  value: PeriodType;
  onChange: (value: PeriodType) => void;
}

const periodLabels: Record<PeriodType, string> = {
  today: 'Hoje',
  week: 'Esta Semana',
  month: 'Este Mês',
  year: 'Este Ano',
  all: 'Total',
};

export function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PeriodType)}>
      <SelectTrigger className="w-[180px]">
        <Calendar className="w-4 h-4 mr-2" />
        <SelectValue placeholder="Selecionar período" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(periodLabels).map(([key, label]) => (
          <SelectItem key={key} value={key}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function filterByPeriod<T extends { created_at: string | null }>(
  items: T[],
  period: PeriodType
): T[] {
  if (period === 'all') return items;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let startDate: Date;
  
  switch (period) {
    case 'today':
      startDate = startOfDay;
      break;
    case 'week':
      const dayOfWeek = now.getDay();
      startDate = new Date(startOfDay);
      startDate.setDate(startDate.getDate() - dayOfWeek);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      return items;
  }

  return items.filter((item) => {
    if (!item.created_at) return false;
    const itemDate = new Date(item.created_at);
    return itemDate >= startDate;
  });
}
