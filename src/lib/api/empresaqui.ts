import { supabase } from '@/integrations/supabase/client';

export interface EnrichedCompanyData {
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  segmento: string | null;
  whatsapp: string | null;
  endereco_completo: string | null;
  email: string | null;
  situacao_cadastral: string | null;
}

interface EnrichResponse {
  success: boolean;
  error?: string;
  data?: EnrichedCompanyData;
}

export const empresaAquiApi = {
  async enrichByCnpj(cnpj: string): Promise<EnrichResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('empresaqui-enrich', {
        body: { cnpj },
      });

      if (error) {
        console.error('EmpresAqui enrich error:', error);
        return { success: false, error: error.message };
      }

      return data as EnrichResponse;
    } catch (error) {
      console.error('Error calling empresaqui-enrich:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao consultar dados da empresa',
      };
    }
  },
};
