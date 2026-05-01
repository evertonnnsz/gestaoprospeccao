import { PeriodType, DateRange } from '@/components/filters/PeriodFilter';

export interface PeriodRange {
  start: Date | null;
  end: Date | null;
}

export function getPeriodRange(period: PeriodType, dateRange?: DateRange): PeriodRange {
  if (period === 'all') return { start: null, end: null };

  if (period === 'custom') {
    const start = dateRange?.from ? new Date(dateRange.from) : null;
    const end = dateRange?.to ? new Date(dateRange.to) : null;
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = startOfDay;

  switch (period) {
    case 'today':
      start = startOfDay;
      break;
    case 'week': {
      const dayOfWeek = now.getDay();
      start = new Date(startOfDay);
      start.setDate(start.getDate() - dayOfWeek);
      break;
    }
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
  }

  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function isInRange(date: Date | null, range: PeriodRange): boolean {
  if (!date) return false;
  if (range.start && date < range.start) return false;
  if (range.end && date > range.end) return false;
  return true;
}

export function filterByRange<T>(
  items: T[],
  range: PeriodRange,
  getDate: (item: T) => string | null | undefined,
): T[] {
  if (!range.start && !range.end) return items;
  return items.filter((item) => {
    const raw = getDate(item);
    if (!raw) return false;
    // ISO date (YYYY-MM-DD) -> local midnight; full ISO -> as is
    const d = raw.length === 10 ? new Date(raw + 'T00:00:00') : new Date(raw);
    if (isNaN(d.getTime())) return false;
    return isInRange(d, range);
  });
}