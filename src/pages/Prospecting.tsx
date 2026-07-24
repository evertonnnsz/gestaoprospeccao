import { useState, useEffect } from 'react';
import { ProspectSearchForm, SearchParams } from '@/components/prospecting/ProspectSearchForm';
import { ProspectCard } from '@/components/prospecting/ProspectCard';
import { LeadForm } from '@/components/leads/LeadForm';
import { LeadImportModal } from '@/components/prospecting/LeadImportModal';
import { StagingArea } from '@/components/prospecting/StagingArea';
import { serpApi, ProspectResult } from '@/lib/api/serpapi';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Lead } from '@/types/crm';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, Sparkles, AlertCircle, Users, Loader2, ChevronDown, MapPin, FileUp } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

export default function Prospecting() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [results, setResults] = useState<ProspectResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentSearchParams, setCurrentSearchParams] = useState<SearchParams | null>(null);
  const [nextOffset, setNextOffset] = useState(0);
  
  // Lead form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Partial<Lead> | null>(null);

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [stagingKey, setStagingKey] = useState(0); // Key to force refresh StagingArea

  const handleSearch = async (params: SearchParams) => {
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
    setResults([]);
    setCurrentSearchParams(params);
     setNextOffset(0);

    try {
       const response = await serpApi.search(params);

      if (!response.success) {
         // Show user-friendly error messages
         if (response.error?.includes('Chave da SerpApi')) {
           setError('Chave da API não configurada. Contate o administrador.');
         } else if (response.error?.includes('Chave de API')) {
           setError('Erro na Chave de API. Verifique suas configurações.');
         } else if (response.error?.includes('Limite de requisições')) {
           setError('Limite de requisições atingido. Tente novamente mais tarde.');
         } else {
           setError(response.error || 'Erro ao buscar leads');
         }
        setResults([]);
        setHasMore(false);
        return;
      }

      // Check for duplicates
       const prospectsWithDuplicates = await serpApi.checkDuplicates(
        response.data || [], 
        user.id
      );

      setResults(prospectsWithDuplicates);
      setHasMore(response.hasMore || false);
       setNextOffset(response.nextOffset || 0);

      if (prospectsWithDuplicates.length === 0) {
         setError('Nenhum resultado encontrado para esta região. Tente ampliar o nicho ou verificar a ortografia.');
      } else {
        toast({
          title: 'Busca concluída!',
           description: `Encontrados ${prospectsWithDuplicates.length} leads do Google Maps.`,
        });
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Ocorreu um erro ao buscar leads. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!user || !currentSearchParams || isLoadingMore) return;

    setIsLoadingMore(true);

    try {
       const response = await serpApi.loadMore(currentSearchParams, nextOffset);

      if (!response.success) {
        toast({
          title: 'Erro',
          description: response.error || 'Erro ao carregar mais resultados',
          variant: 'destructive',
        });
        return;
      }

      // Check for duplicates in new results
       const newProspects = await serpApi.checkDuplicates(
        response.data || [], 
        user.id
      );

      // Deduplicate against existing results
       const deduplicatedResults = serpApi.deduplicateResults(results, newProspects);
      const newCount = deduplicatedResults.length - results.length;

      setResults(deduplicatedResults);
      setHasMore(response.hasMore || false);
       setNextOffset(response.nextOffset || nextOffset);

      toast({
        title: 'Mais resultados carregados!',
        description: `Adicionados ${newCount} novos leads.`,
      });
    } catch (err) {
      console.error('Load more error:', err);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao carregar mais resultados.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingMore(false);
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

  const handleImportComplete = () => {
    // Force refresh of StagingArea by changing its key
    setStagingKey(prev => prev + 1);
  };

  const newLeadsCount = results.filter(r => !r.isExisting).length;
  const existingLeadsCount = results.filter(r => r.isExisting).length;

  return (
    <div className="app-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <MapPin className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Prospecção Inteligente</h1>
            <p className="text-muted-foreground">
              Busque empresas no Google Maps e capture leads automaticamente
            </p>
          </div>
        </div>
        
        <Button onClick={() => setShowImportModal(true)}>
          <FileUp className="w-4 h-4 mr-2" />
          Importar Lista Externa
        </Button>
      </div>

      {/* Search Form */}
      <ProspectSearchForm onSearch={handleSearch} isLoading={isLoading} />

      {/* Staging Area - Sala de Espera */}
      <StagingArea key={stagingKey} />

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-9 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {hasSearched && !error && !isLoading && (
        <div className="space-y-4">
          {/* Results Summary - Prominent Counter */}
          {results.length > 0 && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-4">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">{results.length}</p>
                      <p className="text-sm text-muted-foreground">Total de Leads Encontrados</p>
                    </div>
                  </div>
                  
                  <div className="h-10 w-px bg-border hidden sm:block" />
                  
                  {newLeadsCount > 0 && (
                    <div>
                      <p className="text-xl font-semibold text-primary">{newLeadsCount}</p>
                      <p className="text-sm text-muted-foreground">Novos leads</p>
                    </div>
                  )}
                  
                  {existingLeadsCount > 0 && (
                    <div>
                      <p className="text-xl font-semibold text-muted-foreground">{existingLeadsCount}</p>
                      <p className="text-sm text-muted-foreground">Já cadastrados</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results Grid */}
          {results.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.map((prospect, index) => (
                  <ProspectCard
                    key={`${prospect.company_name}-${index}`}
                    prospect={prospect}
                    onSave={handleSaveProspect}
                  />
                ))}
              </div>

              {/* Load More Button */}
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="min-w-[200px]"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Carregando...
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-2" />
                        Carregar Mais Resultados
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum lead encontrado</h3>
                <p className="text-muted-foreground max-w-md">
                  Tente ajustar os termos de busca. Use palavras-chave mais específicas 
                  ou verifique a ortografia da cidade.
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
             <MapPin className="w-12 h-12 text-primary/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Comece sua prospecção</h3>
            <p className="text-muted-foreground max-w-md">
              Selecione o nicho de mercado, estado e cidade para encontrar 
               empresas no Google Maps que podem se tornar seus clientes.
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

      {/* Import Modal */}
      <LeadImportModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
}
