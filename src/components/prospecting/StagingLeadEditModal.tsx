import { useState, useEffect } from 'react';
import { StagingLead, validateStagingLead } from '@/types/crm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Copy, Send, Save } from 'lucide-react';

interface StagingLeadEditModalProps {
  lead: StagingLead | null;
  onClose: () => void;
  onSave: (lead: StagingLead) => Promise<void>;
  onApprove: (lead: StagingLead) => Promise<void>;
}

export function StagingLeadEditModal({
  lead,
  onClose,
  onSave,
  onApprove,
}: StagingLeadEditModalProps) {
  const [formData, setFormData] = useState<Partial<StagingLead>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    if (lead) {
      setFormData({
        company_name: lead.company_name,
        contact_name: lead.contact_name || '',
        whatsapp: lead.whatsapp || '',
        instagram: lead.instagram || '',
        segment: lead.segment || '',
        observations: lead.observations || '',
        cnpj: lead.cnpj || '',
        razao_social: lead.razao_social || '',
        nome_fantasia: lead.nome_fantasia || '',
        endereco_completo: lead.endereco_completo || '',
      });
    }
  }, [lead]);

  if (!lead) return null;

  const currentLead: StagingLead = {
    ...lead,
    ...formData,
  } as StagingLead;

  const validation = validateStagingLead(currentLead);
  const fieldErrors: Record<string, string> = {};
  
  validation.errors.forEach(error => {
    if (error.includes('Telefone')) {
      fieldErrors.whatsapp = error;
    } else if (error.includes('empresa')) {
      fieldErrors.company_name = error;
    }
  });

  const handleChange = (field: keyof StagingLead, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(currentLead);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!validation.isValid) return;
    
    setIsApproving(true);
    try {
      await onApprove(currentLead);
      onClose();
    } finally {
      setIsApproving(false);
    }
  };

  const isProcessing = isSaving || isApproving;

  return (
    <Dialog open={!!lead} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Revisar Lead: {lead.company_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Duplicate Warning */}
          {lead.is_duplicate && (
            <Alert variant="destructive">
              <Copy className="h-4 w-4" />
              <AlertDescription>
                <strong>Atenção:</strong> Este lead pode ser uma duplicata.
                <br />
                <Button variant="link" className="p-0 h-auto text-destructive underline">
                  Ver Lead Existente
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Validation Errors Summary */}
          {!validation.isValid && !lead.is_duplicate && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Corrija os erros destacados antes de aprovar.
              </AlertDescription>
            </Alert>
          )}

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">
                Empresa <span className="text-destructive">*</span>
              </Label>
              <Input
                id="company_name"
                value={formData.company_name || ''}
                onChange={(e) => handleChange('company_name', e.target.value)}
                className={fieldErrors.company_name ? 'border-destructive' : ''}
              />
              {fieldErrors.company_name && (
                <p className="text-sm text-destructive">{fieldErrors.company_name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_name">Nome do Contato</Label>
              <Input
                id="contact_name"
                value={formData.contact_name || ''}
                onChange={(e) => handleChange('contact_name', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                value={formData.whatsapp || ''}
                onChange={(e) => handleChange('whatsapp', e.target.value)}
                className={fieldErrors.whatsapp ? 'border-destructive' : ''}
                placeholder="(XX) XXXXX-XXXX"
              />
              {fieldErrors.whatsapp && (
                <p className="text-sm text-destructive">{fieldErrors.whatsapp}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input
                id="instagram"
                value={formData.instagram || ''}
                onChange={(e) => handleChange('instagram', e.target.value)}
                placeholder="@usuario"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="segment">Segmento</Label>
              <Input
                id="segment"
                value={formData.segment || ''}
                onChange={(e) => handleChange('segment', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={formData.cnpj || ''}
                onChange={(e) => handleChange('cnpj', e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="razao_social">Razão Social</Label>
              <Input
                id="razao_social"
                value={formData.razao_social || ''}
                onChange={(e) => handleChange('razao_social', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
              <Input
                id="nome_fantasia"
                value={formData.nome_fantasia || ''}
                onChange={(e) => handleChange('nome_fantasia', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endereco_completo">Endereço Completo</Label>
              <Textarea
                id="endereco_completo"
                value={formData.endereco_completo || ''}
                onChange={(e) => handleChange('endereco_completo', e.target.value)}
                rows={2}
                placeholder="Logradouro, nº, bairro, cidade - UF, CEP"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observations">Observações</Label>
              <Textarea
                id="observations"
                value={formData.observations || ''}
                onChange={(e) => handleChange('observations', e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button
            variant="secondary"
            onClick={handleSave}
            disabled={isProcessing}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
          {!lead.is_duplicate && (
            <Button
              onClick={handleApprove}
              disabled={isProcessing || !validation.isValid}
            >
              <Send className="w-4 h-4 mr-2" />
              {isApproving ? 'Aprovando...' : 'Aprovar e Enviar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
