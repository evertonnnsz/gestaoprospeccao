import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { empresaAquiApi, EnrichedCompanyData } from '@/lib/api/empresaqui';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Building2, CheckCircle } from 'lucide-react';

interface CnpjEnrichModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnriched: (data: EnrichedCompanyData) => void;
  initialCnpj?: string;
}

export function CnpjEnrichModal({ open, onOpenChange, onEnriched, initialCnpj }: CnpjEnrichModalProps) {
  const { toast } = useToast();
  const [cnpj, setCnpj] = useState(initialCnpj || '');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<EnrichedCompanyData | null>(null);

  const formatCnpjInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  };

  const handleSearch = async () => {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) {
      toast({
        title: 'CNPJ inválido',
        description: 'O CNPJ deve conter 14 dígitos.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    const response = await empresaAquiApi.enrichByCnpj(digits);

    if (!response.success) {
      toast({
        title: 'Erro na consulta',
        description: response.error || 'Não foi possível consultar o CNPJ.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    setResult(response.data || null);
    setIsLoading(false);
  };

  const handleConfirm = () => {
    if (result) {
      onEnriched(result);
      onOpenChange(false);
      setResult(null);
      setCnpj('');
      toast({
        title: 'Dados enriquecidos!',
        description: 'Os dados da empresa foram preenchidos com sucesso.',
      });
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Enriquecer com CNPJ
          </DialogTitle>
          <DialogDescription>
            Informe o CNPJ para buscar dados completos da empresa no Empresa Aqui.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="cnpj-input">CNPJ</Label>
              <Input
                id="cnpj-input"
                value={cnpj}
                onChange={(e) => setCnpj(formatCnpjInput(e.target.value))}
                placeholder="00.000.000/0000-00"
                disabled={isLoading}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleSearch} disabled={isLoading || cnpj.replace(/\D/g, '').length !== 14}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {result && (
            <div className="rounded-lg border p-4 space-y-2 bg-muted/30">
              <div className="flex items-center gap-2 text-primary mb-2">
                <CheckCircle className="w-4 h-4" />
                <span className="font-medium text-sm">Empresa encontrada</span>
              </div>
              <InfoRow label="CNPJ" value={result.cnpj} />
              <InfoRow label="Razão Social" value={result.razao_social} />
              <InfoRow label="Nome Fantasia" value={result.nome_fantasia} />
              <InfoRow label="Segmento" value={result.segmento} />
              <InfoRow label="Telefone" value={result.whatsapp} />
              <InfoRow label="Endereço" value={result.endereco_completo} />
              <InfoRow label="Email" value={result.email} />
              <InfoRow label="Situação" value={result.situacao_cadastral} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          {result && (
            <Button onClick={handleConfirm}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Aplicar Dados
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">{label}:</span>{' '}
      <span className="font-medium">{value}</span>
    </div>
  );
}
