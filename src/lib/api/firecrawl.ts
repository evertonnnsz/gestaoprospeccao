import { supabase } from '@/integrations/supabase/client';

export interface ProspectResult {
  company_name: string;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  segment: string | null;
  description: string | null;
  isExisting?: boolean;
}

interface FirecrawlSearchResponse {
  success: boolean;
  error?: string;
  data?: ProspectResult[];
  total?: number;
}

interface SearchOptions {
  limit?: number;
}

export const firecrawlApi = {
  async search(query: string, options?: SearchOptions): Promise<FirecrawlSearchResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('firecrawl-search', {
        body: { query, options },
      });

      if (error) {
        console.error('Firecrawl search error:', error);
        return { success: false, error: error.message };
      }

      return data as FirecrawlSearchResponse;
    } catch (error) {
      console.error('Error calling firecrawl-search:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro ao buscar leads' 
      };
    }
  },

  async checkDuplicates(prospects: ProspectResult[], userId: string): Promise<ProspectResult[]> {
    try {
      // Get all existing leads for this user
      const { data: existingLeads, error } = await supabase
        .from('leads')
        .select('company_name, whatsapp')
        .eq('user_id', userId);

      if (error) {
        console.error('Error checking duplicates:', error);
        return prospects;
      }

      // Create a Set for faster lookup
      const existingNames = new Set(
        existingLeads?.map(l => l.company_name.toLowerCase().trim()) || []
      );
      
      const existingPhones = new Set(
        existingLeads
          ?.filter(l => l.whatsapp)
          .map(l => l.whatsapp?.replace(/\D/g, '')) || []
      );

      // Mark prospects as existing if they match
      return prospects.map(prospect => {
        const nameMatch = existingNames.has(prospect.company_name.toLowerCase().trim());
        const phoneMatch = prospect.whatsapp && existingPhones.has(prospect.whatsapp.replace(/\D/g, ''));
        
        return {
          ...prospect,
          isExisting: nameMatch || !!phoneMatch,
        };
      });
    } catch (error) {
      console.error('Error in checkDuplicates:', error);
      return prospects;
    }
  },
};
