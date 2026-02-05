 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
 };
 
 interface SerpApiLocalResult {
   title?: string;
   phone?: string;
   website?: string;
   address?: string;
   rating?: number;
   reviews?: number;
   type?: string;
   place_id?: string;
 }
 
 interface ProspectResult {
   company_name: string;
   whatsapp: string | null;
   website: string | null;
   instagram: string | null;
   segment: string | null;
   description: string | null;
   address?: string | null;
   rating?: number | null;
   reviews?: number | null;
 }
 
 function formatPhoneNumber(phone: string | undefined): string | null {
   if (!phone) return null;
   // Remove all non-digit characters
   const digits = phone.replace(/\D/g, '');
   // Return if it has a valid length
   if (digits.length >= 10 && digits.length <= 13) {
     return digits;
   }
   return null;
 }
 
 function parseLocalResults(results: SerpApiLocalResult[], segment: string): ProspectResult[] {
   const prospects: ProspectResult[] = [];
   const seenNames = new Set<string>();
   const seenPhones = new Set<string>();
 
   for (const result of results) {
     if (!result.title) continue;
 
     const normalizedName = result.title.toLowerCase().trim();
     if (seenNames.has(normalizedName)) continue;
 
     const phone = formatPhoneNumber(result.phone);
     if (phone && seenPhones.has(phone)) continue;
 
     seenNames.add(normalizedName);
     if (phone) seenPhones.add(phone);
 
     prospects.push({
       company_name: result.title,
       whatsapp: phone,
       website: result.website || null,
       instagram: null,
       segment: segment,
       description: result.type || null,
       address: result.address || null,
       rating: result.rating || null,
       reviews: result.reviews || null,
     });
   }
 
   return prospects;
 }
 
 Deno.serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const { niche, state, city, limit = 50, startOffset = 0 } = await req.json();
 
     if (!niche || !state || !city) {
       return new Response(
         JSON.stringify({ success: false, error: 'Nicho, estado e cidade são obrigatórios' }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const apiKey = Deno.env.get('SERPAPI_KEY');
     if (!apiKey) {
       console.error('SERPAPI_KEY not configured');
       return new Response(
         JSON.stringify({ 
           success: false, 
           error: 'Chave da SerpApi não configurada. Por favor, adicione nas configurações.' 
         }),
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const query = `${niche} em ${city}, ${state}, Brasil`;
     console.log(`SerpApi search: "${query}" | limit: ${limit} | startOffset: ${startOffset}`);
 
     const allProspects: ProspectResult[] = [];
     let currentOffset = startOffset;
     const maxPages = Math.ceil(limit / 20);
     let hasMoreResults = true;
 
     // Pagination loop - fetch multiple pages if needed
     for (let page = 0; page < maxPages && hasMoreResults; page++) {
       const serpApiUrl = new URL('https://serpapi.com/search.json');
       serpApiUrl.searchParams.set('engine', 'google_maps');
       serpApiUrl.searchParams.set('q', query);
       serpApiUrl.searchParams.set('hl', 'pt-br');
       serpApiUrl.searchParams.set('start', currentOffset.toString());
       serpApiUrl.searchParams.set('api_key', apiKey);
 
       console.log(`Fetching page ${page + 1}, offset: ${currentOffset}`);
 
       const response = await fetch(serpApiUrl.toString());
       const data = await response.json();
 
       if (!response.ok) {
         console.error('SerpApi error:', data);
         
         // Check for specific error types
         if (data.error?.includes('Invalid API key')) {
           return new Response(
             JSON.stringify({ success: false, error: 'Erro na Chave de API. Verifique suas configurações.' }),
             { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
           );
         }
 
         if (data.error?.includes('rate limit') || data.error?.includes('quota')) {
           return new Response(
             JSON.stringify({ success: false, error: 'Limite de requisições atingido. Tente novamente mais tarde.' }),
             { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
           );
         }
 
         return new Response(
           JSON.stringify({ success: false, error: data.error || `Erro na busca: ${response.status}` }),
           { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
         );
       }
 
       const localResults = data.local_results || [];
       console.log(`Page ${page + 1}: Found ${localResults.length} results`);
 
       if (localResults.length === 0) {
         hasMoreResults = false;
         break;
       }
 
       const pageProspects = parseLocalResults(localResults, niche);
       allProspects.push(...pageProspects);
 
       // Check if there's pagination info
       hasMoreResults = !!data.serpapi_pagination?.next;
       currentOffset += 20;
 
       // Stop if we have enough results
       if (allProspects.length >= limit) {
         break;
       }
 
       // Small delay between requests to avoid rate limiting
       if (page < maxPages - 1 && hasMoreResults) {
         await new Promise(resolve => setTimeout(resolve, 200));
       }
     }
 
     // Trim to the requested limit
     const trimmedProspects = allProspects.slice(0, limit);
 
     console.log(`Total results: ${trimmedProspects.length} | Has more: ${hasMoreResults && allProspects.length >= limit}`);
 
     return new Response(
       JSON.stringify({
         success: true,
         data: trimmedProspects,
         total: trimmedProspects.length,
         hasMore: hasMoreResults && allProspects.length >= limit,
         nextOffset: currentOffset,
       }),
       { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   } catch (error) {
     console.error('Error in serpapi-search:', error);
     const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar leads';
     return new Response(
       JSON.stringify({ success: false, error: errorMessage }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });