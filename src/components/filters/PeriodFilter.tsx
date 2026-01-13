import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Check } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export type PeriodType = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface PeriodFilterProps {
  value: PeriodType;
  onChange: (value: PeriodType) => void;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
}

const periodLabels: Record<PeriodType, string> = {
  today: 'Hoje',
  week: 'Esta Semana',
  month: 'Este Mês',
  year: 'Este Ano',
  all: 'Total',
  custom: 'Personalizado',
};

export function PeriodFilter({ value, onChange, dateRange, onDateRangeChange }: PeriodFilterProps) {
  const [internalDateRange, setInternalDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [tempDateRange, setTempDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  const currentDateRange = dateRange ?? internalDateRange;
  const setDateRange = onDateRangeChange ?? setInternalDateRange;

  const handlePeriodChange = (newValue: string) => {
    onChange(newValue as PeriodType);
    if (newValue === 'custom') {
      setTempDateRange(currentDateRange);
    }
  };

  const handlePopoverOpen = (open: boolean) => {
    if (open) {
      setTempDateRange(currentDateRange);
    }
    setIsPopoverOpen(open);
  };

  const handleApplyDateRange = () => {
    setDateRange(tempDateRange);
    setIsPopoverOpen(false);
  };

  const formatDateRange = () => {
    if (currentDateRange.from && currentDateRange.to) {
      return `${format(currentDateRange.from, 'dd/MM/yy', { locale: ptBR })} - ${format(currentDateRange.to, 'dd/MM/yy', { locale: ptBR })}`;
    }
    if (currentDateRange.from) {
      return `A partir de ${format(currentDateRange.from, 'dd/MM/yy', { locale: ptBR })}`;
    }
    return 'Selecionar datas';
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={handlePeriodChange}>
        <SelectTrigger className="w-[180px]">
          <CalendarIcon className="w-4 h-4 mr-2" />
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

      {value === 'custom' && (
        <Popover open={isPopoverOpen} onOpenChange={handlePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal",
                !currentDateRange.from && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formatDateRange()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={tempDateRange.from}
              selected={{ from: tempDateRange.from, to: tempDateRange.to }}
              onSelect={(range) => setTempDateRange({ from: range?.from, to: range?.to })}
              numberOfMonths={2}
              locale={ptBR}
              className="pointer-events-auto"
            />
            <div className="p-3 border-t flex justify-end">
              <Button 
                size="sm" 
                onClick={handleApplyDateRange}
                disabled={!tempDateRange.from}
              >
                <Check className="w-4 h-4 mr-2" />
                Aplicar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export function filterByPeriod<T extends { approach_date?: string | null }>(
  items: T[],
  period: PeriodType,
  dateRange?: DateRange
): T[] {
  if (period === 'all') return items;

  const getItemDate = (item: T): Date | null => {
    // Usa approach_date (data de cadastro/abordagem do lead)
    if (item.approach_date) {
      return new Date(item.approach_date + 'T00:00:00');
    }
    return null;
  };

  if (period === 'custom' && dateRange) {
    return items.filter((item) => {
      const itemDate = getItemDate(item);
      if (!itemDate) return false;
      
      if (dateRange.from && dateRange.to) {
        const startOfRange = new Date(dateRange.from);
        startOfRange.setHours(0, 0, 0, 0);
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        return itemDate >= startOfRange && itemDate <= endOfDay;
      }
      if (dateRange.from) {
        const startOfRange = new Date(dateRange.from);
        startOfRange.setHours(0, 0, 0, 0);
        return itemDate >= startOfRange;
      }
      return true;
    });
  }

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
    const itemDate = getItemDate(item);
    if (!itemDate) return false;
    return itemDate >= startDate;
  });
}
