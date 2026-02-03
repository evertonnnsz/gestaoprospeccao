const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SearchResult {
  title: string;
  url: string;
  description?: string;
  markdown?: string;
}

interface ExtractedBusiness {
  company_name: string;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  segment: string | null;
  description: string | null;
}

function extractPhoneNumber(text: string): string | null {
  // Match various phone formats including Brazilian numbers
  const phonePatterns = [
    /\+?55\s*\(?0?\d{2}\)?\s*9?\d{4}[-.\s]?\d{4}/g,
    /\(?0?\d{2}\)?\s*9?\d{4}[-.\s]?\d{4}/g,
    /\d{2}\s*9?\d{4}[-.\s]?\d{4}/g,
    /\(\d{2,3}\)\s*\d{4,5}[-.\s]?\d{4}/g,
    /\d{10,11}/g,
  ];

  for (const pattern of phonePatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      // Clean and return the first valid phone number
      const cleanPhone = matches[0].replace(/\D/g, '');
      if (cleanPhone.length >= 10 && cleanPhone.length <= 13) {
        return cleanPhone;
      }
    }
  }
  return null;
}

function extractInstagram(text: string): string | null {
  const patterns = [
    /@([a-zA-Z0-9_.]{1,30})/g,
    /instagram\.com\/([a-zA-Z0-9_.]{1,30})/gi,
    /ig:\s*@?([a-zA-Z0-9_.]{1,30})/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && !['instagram', 'facebook', 'twitter', 'youtube'].includes(match[1].toLowerCase())) {
        return `@${match[1]}`;
      }
    }
  }
  return null;
}

function parseSearchResults(results: SearchResult[], query: string): ExtractedBusiness[] {
  const businesses: ExtractedBusiness[] = [];
  const seenNames = new Set<string>();

  for (const result of results) {
    // Extract company name from title (usually the first part before | or -)
    let companyName = result.title
      .split(/[|\-–—]/)[0]
      .replace(/Google Maps/gi, '')
      .replace(/Maps/gi, '')
      .trim();

    // Skip if company name is empty or too generic
    if (!companyName || companyName.length < 3 || seenNames.has(companyName.toLowerCase())) {
      continue;
    }

    seenNames.add(companyName.toLowerCase());

    const fullText = `${result.title} ${result.description || ''} ${result.markdown || ''}`;
    
    const business: ExtractedBusiness = {
      company_name: companyName,
      whatsapp: extractPhoneNumber(fullText),
      website: result.url && !result.url.includes('google.com') ? result.url : null,
      instagram: extractInstagram(fullText),
      segment: query.split(' ')[0] || null, // Use the first word of query as segment hint
      description: result.description?.substring(0, 200) || null,
    };

    businesses.push(business);
  }

  return businesses;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, options } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ success: false, error: 'Query é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Conector Firecrawl não configurado. Por favor, configure nas configurações.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build optimized search query for finding businesses
    const searchQuery = `${query} contato telefone whatsapp`;
    const limit = options?.limit || 15;

    console.log('Searching for:', searchQuery);

    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: limit,
        lang: 'pt-br',
        country: 'br',
        scrapeOptions: {
          formats: ['markdown'],
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Erro na busca: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and extract business data from search results
    const results = data.data || [];
    const businesses = parseSearchResults(results, query);

    console.log(`Found ${businesses.length} businesses`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: businesses,
        total: businesses.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in firecrawl-search:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar leads';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
