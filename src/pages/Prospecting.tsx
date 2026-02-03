import { useState } from 'react';
import { ProspectSearchForm } from '@/components/prospecting/ProspectSearchForm';
import { ProspectCard } from '@/components/prospecting/ProspectCard';
import { LeadForm } from '@/components/leads/LeadForm';
import { firecrawlApi, ProspectResult } from '@/lib/api/firecrawl';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Lead } from '@/types/crm';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Sparkles, AlertCircle, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Prospecting() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ProspectResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Lead form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Partial<Lead> | null>(null);

  const handleSearch = async (niche: string, location: string) => {
    if (!user) {
      toast({
        title: 'Erro',
        description: 'Você precisa estar logado para buscar leads.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const query = `${niche} ${location}`;
      const response = await firecrawlApi.search(query, { limit: 15 });

      if (!response.success) {
        setError(response.error || 'Erro ao buscar leads');
        setResults([]);
        return;
      }

      // Check for duplicates
      const prospectsWithDuplicates = await firecrawlApi.checkDuplicates(
        response.data || [], 
        user.id
      );

      setResults(prospectsWithDuplicates);

      if (prospectsWithDuplicates.length === 0) {
        toast({
          title: 'Nenhum resultado',
          description: 'Tente ajustar os termos de busca.',
        });
      } else {
        toast({
          title: 'Busca concluída!',
          description: `Encontrados ${prospectsWithDuplicates.length} leads potenciais.`,
        });
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Ocorreu um erro ao buscar leads. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProspect = (prospect: ProspectResult) => {
    // Pre-fill lead form with prospect data
    const leadData: Partial<Lead> = {
      company_name: prospect.company_name,
      whatsapp: prospect.whatsapp || '',
      instagram: prospect.instagram || '',
      segment: prospect.segment || '',
      lead_source: 'Prospecção Inteligente',
      status: 'lead_coletado',
      observations: prospect.description || '',
      approach_date: new Date().toISOString().split('T')[0],
    };

    setSelectedProspect(leadData);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    // Update the saved prospect as existing
    if (selectedProspect) {
      setResults(prev => prev.map(p => 
        p.company_name === selectedProspect.company_name 
          ? { ...p, isExisting: true }
          : p
      ));
    }
    
    toast({
      title: 'Lead salvo com sucesso!',
      description: 'O lead foi adicionado ao sistema e está disponível no Dashboard, Funil e Métricas.',
    });
  };

  const newLeadsCount = results.filter(r => !r.isExisting).length;
  const existingLeadsCount = results.filter(r => r.isExisting).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Prospecção Inteligente</h1>
          <p className="text-muted-foreground">
            Busque empresas na web e capture leads automaticamente
          </p>
        </div>
      </div>

      {/* Search Form */}
      <ProspectSearchForm onSearch={handleSearch} isLoading={isLoading} />

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {hasSearched && !error && (
        <div className="space-y-4">
          {/* Results Summary */}
          {results.length > 0 && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>{results.length} resultados encontrados</span>
              </div>
              {newLeadsCount > 0 && (
                <span className="text-primary font-medium">
                  {newLeadsCount} novos leads
                </span>
              )}
              {existingLeadsCount > 0 && (
                <span className="text-muted-foreground">
                  {existingLeadsCount} já cadastrados
                </span>
              )}
            </div>
          )}

          {/* Results Grid */}
          {results.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((prospect, index) => (
                <ProspectCard
                  key={`${prospect.company_name}-${index}`}
                  prospect={prospect}
                  onSave={handleSaveProspect}
                />
              ))}
            </div>
          ) : !isLoading && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum lead encontrado</h3>
                <p className="text-muted-foreground max-w-md">
                  Tente ajustar os termos de busca. Use palavras-chave mais específicas 
                  ou verifique a ortografia da cidade/estado.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Initial State */}
      {!hasSearched && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="w-12 h-12 text-primary/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Comece sua prospecção</h3>
            <p className="text-muted-foreground max-w-md">
              Digite o nicho de mercado e a localização para encontrar 
              empresas potenciais que podem se tornar seus clientes.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Lead Form Modal */}
      <LeadForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        lead={selectedProspect as Lead}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
