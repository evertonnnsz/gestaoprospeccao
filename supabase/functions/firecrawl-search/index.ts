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

// Query variations to get more diverse results
const QUERY_VARIATIONS = [
  // Base query focused on Google Maps
  (niche: string, city: string, state: string) => 
    `"${niche}" "${city}" "${state}" site:google.com/maps`,
  // Query with contact keywords
  (niche: string, city: string, state: string) => 
    `${niche} ${city} ${state} telefone whatsapp contato`,
  // Query for business listings
  (niche: string, city: string, state: string) => 
    `"${niche}" em "${city}" ${state} endereço telefone`,
  // Google My Business focused
  (niche: string, city: string, state: string) => 
    `${niche} perto de ${city} ${state} avaliações`,
  // Social media focused
  (niche: string, city: string, state: string) => 
    `${niche} ${city} ${state} instagram @`,
];

function extractPhoneNumber(text: string): string | null {
  // Match various phone formats including Brazilian numbers
  const phonePatterns = [
    // Brazilian mobile with country code
    /\+?55\s*\(?0?\d{2}\)?\s*9\d{4}[-.\s]?\d{4}/g,
    // Brazilian landline with country code
    /\+?55\s*\(?0?\d{2}\)?\s*[2-5]\d{3}[-.\s]?\d{4}/g,
    // Mobile without country code
    /\(?0?\d{2}\)?\s*9\d{4}[-.\s]?\d{4}/g,
    // Landline without country code
    /\(?0?\d{2}\)?\s*[2-5]\d{3}[-.\s]?\d{4}/g,
    // General format with area code
    /\(\d{2,3}\)\s*\d{4,5}[-.\s]?\d{4}/g,
    // Simple 10-11 digit sequence
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
    // Direct @username
    /@([a-zA-Z0-9_.]{3,30})(?![a-zA-Z0-9_.])/g,
    // Instagram URL
    /instagram\.com\/([a-zA-Z0-9_.]{3,30})/gi,
    // IG: prefix
    /ig:\s*@?([a-zA-Z0-9_.]{3,30})/gi,
    // Instagram: prefix
    /instagram:\s*@?([a-zA-Z0-9_.]{3,30})/gi,
  ];

  const excludeList = ['instagram', 'facebook', 'twitter', 'youtube', 'linkedin', 'google', 'gmail', 'hotmail', 'email'];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const username = match[1]?.toLowerCase();
      if (username && !excludeList.includes(username) && username.length >= 3) {
        return `@${match[1]}`;
      }
    }
  }
  return null;
}

function extractWebsite(url: string, text: string): string | null {
  // First check if the URL itself is a business website (not Google, social media, etc.)
  const excludeDomains = ['google.com', 'facebook.com', 'instagram.com', 'twitter.com', 'youtube.com', 'linkedin.com', 'yelp.com'];
  
  if (url && !excludeDomains.some(d => url.includes(d))) {
    try {
      const urlObj = new URL(url);
      return urlObj.origin;
    } catch {
      // Invalid URL, continue to text extraction
    }
  }

  // Try to extract website from text
  const websitePattern = /(?:www\.|https?:\/\/)([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2})?)/gi;
  const matches = text.matchAll(websitePattern);
  
  for (const match of matches) {
    const domain = match[1]?.toLowerCase();
    if (domain && !excludeDomains.some(d => domain.includes(d))) {
      return `https://${domain}`;
    }
  }
  
  return null;
}

function parseSearchResults(results: SearchResult[], niche: string): ExtractedBusiness[] {
  const businesses: ExtractedBusiness[] = [];
  const seenNames = new Set<string>();
  const seenPhones = new Set<string>();

  for (const result of results) {
    // Extract company name from title (usually the first part before | or -)
    let companyName = result.title
      .split(/[|\-–—·]/)[0]
      .replace(/Google Maps/gi, '')
      .replace(/Maps/gi, '')
      .replace(/\s*-\s*Pesquisar/gi, '')
      .replace(/\s*\(\d+\)/g, '') // Remove rating counts like (123)
      .trim();

    // Skip if company name is empty, too short, or too generic
    if (!companyName || companyName.length < 3) {
      continue;
    }

    const normalizedName = companyName.toLowerCase().trim();
    
    // Skip duplicates
    if (seenNames.has(normalizedName)) {
      continue;
    }

    const fullText = `${result.title} ${result.description || ''} ${result.markdown || ''}`;
    const phone = extractPhoneNumber(fullText);
    
    // Skip if we already have this phone number
    if (phone && seenPhones.has(phone)) {
      continue;
    }

    seenNames.add(normalizedName);
    if (phone) {
      seenPhones.add(phone);
    }
    
    const business: ExtractedBusiness = {
      company_name: companyName,
      whatsapp: phone,
      website: extractWebsite(result.url, fullText),
      instagram: extractInstagram(fullText),
      segment: niche,
      description: result.description?.substring(0, 250) || null,
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
    const { niche, state, city, limit = 50, searchVariation = 0 } = await req.json();

    if (!niche || !state || !city) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nicho, estado e cidade são obrigatórios' }),
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

    // Select query variation (cycle through available variations)
    const variationIndex = searchVariation % QUERY_VARIATIONS.length;
    const queryBuilder = QUERY_VARIATIONS[variationIndex];
    const searchQuery = queryBuilder(niche, city, state);

    console.log(`Searching (variation ${variationIndex}):`, searchQuery);

    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: Math.min(limit, 100), // API max is typically 100
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
    const businesses = parseSearchResults(results, niche);

    console.log(`Found ${businesses.length} businesses from ${results.length} results`);

    // Determine if there might be more results with different queries
    const hasMore = searchVariation < QUERY_VARIATIONS.length - 1;

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: businesses,
        total: businesses.length,
        hasMore,
        searchVariation: variationIndex,
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
