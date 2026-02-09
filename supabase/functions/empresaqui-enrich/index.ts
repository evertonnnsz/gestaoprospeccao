const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface EmpresAquiResponse {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  telefone_1?: string;
  telefone_2?: string;
  email?: string;
  atividade_principal?: string;
  cnae_principal?: string;
  cnae_principal_texto?: string;
  situacao_cadastral?: string;
  data_abertura?: string;
  natureza_juridica?: string;
  porte?: string;
  capital_social?: string;
}

function formatCnpj(cnpj: string): string {
  // Remove everything except digits
  return cnpj.replace(/\D/g, '');
}

function buildAddress(data: EmpresAquiResponse): string {
  const parts: string[] = [];
  
  if (data.logradouro) {
    let addr = data.logradouro;
    if (data.numero) addr += `, ${data.numero}`;
    if (data.complemento) addr += ` - ${data.complemento}`;
    parts.push(addr);
  }
  if (data.bairro) parts.push(data.bairro);
  if (data.municipio && data.uf) {
    parts.push(`${data.municipio} - ${data.uf}`);
  } else if (data.municipio) {
    parts.push(data.municipio);
  }
  if (data.cep) parts.push(`CEP: ${data.cep}`);
  
  return parts.join(', ');
}

function formatPhone(phone: string | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10 && digits.length <= 13) {
    return digits;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cnpj } = await req.json();

    if (!cnpj) {
      return new Response(
        JSON.stringify({ success: false, error: 'CNPJ é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = Deno.env.get('EMPRESAQUI_TOKEN');
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token do Empresa Aqui não configurado. Contate o administrador.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanCnpj = formatCnpj(cnpj);
    if (cleanCnpj.length !== 14) {
      return new Response(
        JSON.stringify({ success: false, error: 'CNPJ inválido. Deve conter 14 dígitos.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`EmpresAqui enrichment for CNPJ: ${cleanCnpj}`);

    // Call EmpresAqui API
    const apiUrl = `https://www.empresaqui.com.br/api/${token}/${cleanCnpj}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.error('EmpresAqui API error:', response.status);
      
      if (response.status === 401 || response.status === 403) {
        return new Response(
          JSON.stringify({ success: false, error: 'Token do Empresa Aqui inválido ou expirado.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Limite de requisições excedido. Tente novamente mais tarde.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (response.status === 404) {
        return new Response(
          JSON.stringify({ success: false, error: 'CNPJ não encontrado na base do Empresa Aqui.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: `Erro na API do Empresa Aqui: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data: EmpresAquiResponse = await response.json();

    // Map to our format
    const enrichedData = {
      cnpj: data.cnpj || cleanCnpj,
      razao_social: data.razao_social || null,
      nome_fantasia: data.nome_fantasia || null,
      segmento: data.cnae_principal_texto || data.atividade_principal || null,
      whatsapp: formatPhone(data.telefone_1) || formatPhone(data.telefone_2) || null,
      endereco_completo: buildAddress(data),
      email: data.email || null,
      situacao_cadastral: data.situacao_cadastral || null,
    };

    console.log(`Enrichment successful for CNPJ: ${cleanCnpj}`);

    return new Response(
      JSON.stringify({ success: true, data: enrichedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in empresaqui-enrich:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao consultar Empresa Aqui';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
