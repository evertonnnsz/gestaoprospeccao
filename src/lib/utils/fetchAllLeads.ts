import { supabase } from '@/integrations/supabase/client';
import type { Lead } from '@/types/crm';

const PAGE_SIZE = 1000;

export async function fetchAllLeads() {
  const allLeads: Lead[] = [];
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const pageData = ((data as Lead[]) || []);
    allLeads.push(...pageData);

    if (pageData.length < PAGE_SIZE) break;
    page += 1;
  }

  return allLeads;
}

export async function fetchLeadCount() {
  const { count, error } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true });

  if (error) throw error;
  return count || 0;
}
