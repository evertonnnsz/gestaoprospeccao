 import { supabase } from '@/integrations/supabase/client';
 
 export interface ProspectResult {
   company_name: string;
   whatsapp: string | null;
   website: string | null;
   instagram: string | null;
   segment: string | null;
   description: string | null;
   address?: string | null;
   rating?: number | null;
   reviews?: number | null;
   isExisting?: boolean;
 }
 
 export interface SearchParams {
   niche: string;
   state: string;
   city: string;
   limit?: number;
   startOffset?: number;
 }
 
 interface SerpApiSearchResponse {
   success: boolean;
   error?: string;
   data?: ProspectResult[];
   total?: number;
   hasMore?: boolean;
   nextOffset?: number;
 }
 
 export const serpApi = {
   async search(params: SearchParams): Promise<SerpApiSearchResponse> {
     try {
       const { data, error } = await supabase.functions.invoke('serpapi-search', {
         body: {
           niche: params.niche,
           state: params.state,
           city: params.city,
           limit: params.limit || 50,
           startOffset: params.startOffset || 0,
         },
       });
 
       if (error) {
         console.error('SerpApi search error:', error);
         return { success: false, error: error.message };
       }
 
       return data as SerpApiSearchResponse;
     } catch (error) {
       console.error('Error calling serpapi-search:', error);
       return {
         success: false,
         error: error instanceof Error ? error.message : 'Erro ao buscar leads',
       };
     }
   },
 
   async loadMore(params: SearchParams, currentOffset: number): Promise<SerpApiSearchResponse> {
     return this.search({ ...params, startOffset: currentOffset });
   },
 
   async checkDuplicates(prospects: ProspectResult[], userId: string): Promise<ProspectResult[]> {
     try {
       const { data: existingLeads, error } = await supabase
         .from('leads')
         .select('company_name, whatsapp')
         .eq('user_id', userId);
 
       if (error) {
         console.error('Error checking duplicates:', error);
         return prospects;
       }
 
       const existingNames = new Set(
         existingLeads?.map(l => l.company_name.toLowerCase().trim()) || []
       );
 
       const existingPhones = new Set(
         existingLeads
           ?.filter(l => l.whatsapp)
           .map(l => l.whatsapp?.replace(/\D/g, '')) || []
       );
 
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
 
   deduplicateResults(existing: ProspectResult[], newResults: ProspectResult[]): ProspectResult[] {
     const existingNames = new Set(existing.map(p => p.company_name.toLowerCase().trim()));
     const existingPhones = new Set(
       existing.filter(p => p.whatsapp).map(p => p.whatsapp?.replace(/\D/g, ''))
     );
 
     const unique = newResults.filter(prospect => {
       const nameExists = existingNames.has(prospect.company_name.toLowerCase().trim());
       const phoneExists = prospect.whatsapp && existingPhones.has(prospect.whatsapp.replace(/\D/g, ''));
       return !nameExists && !phoneExists;
     });
 
     return [...existing, ...unique];
   },
 };