import { supabase } from '@/integrations/supabase/client';

const DEFAULT_PAGE_SIZE = 1000;
const db = supabase as any;

export async function fetchAllRows<T>(
  table: string,
  options: {
    select?: string;
    orderBy?: string;
    ascending?: boolean;
    pageSize?: number;
  } = {}
): Promise<T[]> {
  const select = options.select || '*';
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const rows: T[] = [];
  let from = 0;

  while (true) {
    let query = db
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);

    if (options.orderBy) {
      query = query.order(options.orderBy, { ascending: options.ascending ?? false });
    }

    const { data, error } = await query;
    if (error) throw error;

    const page = (data || []) as T[];
    rows.push(...page);

    if (page.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}
