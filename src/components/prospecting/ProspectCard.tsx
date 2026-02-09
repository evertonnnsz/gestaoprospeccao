import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Phone, Globe, Instagram, FileText, UserPlus, CheckCircle2, Search } from 'lucide-react';
import { ProspectResult } from '@/lib/api/serpapi';
import { CnpjEnrichModal } from './CnpjEnrichModal';
import { EnrichedCompanyData } from '@/lib/api/empresaqui';

interface ProspectCardProps {
  prospect: ProspectResult;
  onSave: (prospect: ProspectResult) => void;
}

export function ProspectCard({ prospect, onSave }: ProspectCardProps) {
  const [showEnrich, setShowEnrich] = useState(false);
  const [enrichedProspect, setEnrichedProspect] = useState<ProspectResult>(prospect);

  const handleEnriched = (data: EnrichedCompanyData) => {
    const updated: ProspectResult = {
      ...enrichedProspect,
      company_name: data.nome_fantasia || enrichedProspect.company_name,
      whatsapp: data.whatsapp || enrichedProspect.whatsapp,
      segment: data.segmento || enrichedProspect.segment,
      description: data.razao_social || enrichedProspect.description,
      address: data.endereco_completo || enrichedProspect.address,
    };
    setEnrichedProspect(updated);
  };

  const current = enrichedProspect;

  return (
    <>
      <Card className={current.isExisting ? 'border-muted bg-muted/30' : ''}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary shrink-0" />
              <h3 className="font-semibold text-lg line-clamp-1">{current.company_name}</h3>
            </div>
            {current.isExisting && (
              <Badge variant="secondary" className="shrink-0">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Já Cadastrado
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {current.segment && (
            <Badge variant="outline" className="text-xs">
              {current.segment}
            </Badge>
          )}

          {current.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {current.description}
            </p>
          )}

          <div className="space-y-2 text-sm">
            {current.whatsapp && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-4 h-4 shrink-0" />
                <span className="truncate">{current.whatsapp}</span>
              </div>
            )}

            {current.website && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe className="w-4 h-4 shrink-0" />
                <a 
                  href={current.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="truncate hover:text-primary hover:underline"
                >
                  {current.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
              </div>
            )}

            {current.instagram && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Instagram className="w-4 h-4 shrink-0" />
                <span className="truncate">{current.instagram}</span>
              </div>
            )}

            {!current.whatsapp && !current.website && !current.instagram && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="w-4 h-4" />
                <span className="text-xs italic">Sem informações de contato</span>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowEnrich(true)}
          >
            <Search className="w-4 h-4 mr-2" />
            Enriquecer com CNPJ
          </Button>
          <Button 
            onClick={() => onSave(current)} 
            className="w-full"
            variant={current.isExisting ? 'outline' : 'default'}
            disabled={current.isExisting}
          >
            {current.isExisting ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Já Existe no Sistema
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Salvar Lead
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      <CnpjEnrichModal
        open={showEnrich}
        onOpenChange={setShowEnrich}
        onEnriched={handleEnriched}
      />
    </>
  );
}
