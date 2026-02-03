import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Phone, Globe, Instagram, FileText, UserPlus, CheckCircle2 } from 'lucide-react';
import { ProspectResult } from '@/lib/api/firecrawl';

interface ProspectCardProps {
  prospect: ProspectResult;
  onSave: (prospect: ProspectResult) => void;
}

export function ProspectCard({ prospect, onSave }: ProspectCardProps) {
  return (
    <Card className={prospect.isExisting ? 'border-muted bg-muted/30' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary shrink-0" />
            <h3 className="font-semibold text-lg line-clamp-1">{prospect.company_name}</h3>
          </div>
          {prospect.isExisting && (
            <Badge variant="secondary" className="shrink-0">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Já Cadastrado
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {prospect.segment && (
          <Badge variant="outline" className="text-xs">
            {prospect.segment}
          </Badge>
        )}

        {prospect.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {prospect.description}
          </p>
        )}

        <div className="space-y-2 text-sm">
          {prospect.whatsapp && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-4 h-4 shrink-0" />
              <span className="truncate">{prospect.whatsapp}</span>
            </div>
          )}

          {prospect.website && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Globe className="w-4 h-4 shrink-0" />
              <a 
                href={prospect.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="truncate hover:text-primary hover:underline"
              >
                {prospect.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            </div>
          )}

          {prospect.instagram && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Instagram className="w-4 h-4 shrink-0" />
              <span className="truncate">{prospect.instagram}</span>
            </div>
          )}

          {!prospect.whatsapp && !prospect.website && !prospect.instagram && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="w-4 h-4" />
              <span className="text-xs italic">Sem informações de contato</span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter>
        <Button 
          onClick={() => onSave(prospect)} 
          className="w-full"
          variant={prospect.isExisting ? 'outline' : 'default'}
          disabled={prospect.isExisting}
        >
          {prospect.isExisting ? (
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
  );
}
