import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Client, Lead } from '@/types/crm';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Upload, FileText, X } from 'lucide-react';

interface ClientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  lead?: Lead | null;
  onSuccess: () => void;
}

// Formata número para moeda brasileira (1400.50 -> "1.400,50")
const formatCurrency = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value.replace(/\./g, '').replace(',', '.')) : value;
  if (isNaN(num)) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Converte string formatada para número (1.400,50 -> 1400.50)
const parseCurrency = (value: string): number | null => {
  if (!value) return null;
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

// Formata input de moeda enquanto digita
const handleCurrencyInput = (value: string): string => {
  // Remove tudo que não seja número
  const numbers = value.replace(/\D/g, '');
  if (!numbers) return '';
  
  // Converte para centavos
  const cents = parseInt(numbers, 10);
  const reais = cents / 100;
  
  return reais.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export function ClientForm({ open, onOpenChange, client, lead, onSuccess }: ClientFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    project_value: '',
    project_start_date: '',
    payment_due_date: '',
    contract_url: '',
    services: '',
    contract_duration_months: '',
    notes: '',
  });

  useEffect(() => {
    if (client) {
      setFormData({
        project_value: client.project_value ? formatCurrency(client.project_value) : '',
        project_start_date: client.project_start_date || '',
        payment_due_date: client.payment_due_date || '',
        contract_url: client.contract_url || '',
        services: client.services || '',
        contract_duration_months: client.contract_duration_months?.toString() || '',
        notes: client.notes || '',
      });
    } else {
      setFormData({
        project_value: '',
        project_start_date: '',
        payment_due_date: '',
        contract_url: '',
        services: '',
        contract_duration_months: '',
        notes: '',
      });
    }
  }, [client, open]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.type !== 'application/pdf') {
      toast({
        title: 'Erro',
        description: 'Apenas arquivos PDF são permitidos.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const fileName = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('contracts')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('contracts')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, contract_url: publicUrl }));
      
      toast({
        title: 'Sucesso',
        description: 'Contrato enviado com sucesso!',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar arquivo',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !lead) return;

    setLoading(true);
    try {
      const clientData = {
        user_id: user.id,
        lead_id: lead.id,
        project_value: parseCurrency(formData.project_value),
        project_start_date: formData.project_start_date || null,
        payment_due_date: formData.payment_due_date || null,
        contract_url: formData.contract_url || null,
        services: formData.services || null,
        contract_duration_months: formData.contract_duration_months ? parseInt(formData.contract_duration_months) : null,
        notes: formData.notes || null,
      };

      if (client) {
        const { error } = await supabase
          .from('clients')
          .update(clientData)
          .eq('id', client.id);

        if (error) throw error;
        toast({ title: 'Cliente atualizado com sucesso!' });
      } else {
        const { error } = await supabase
          .from('clients')
          .insert(clientData);

        if (error) throw error;
        toast({ title: 'Cliente cadastrado com sucesso!' });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar cliente',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {client ? 'Editar Cliente' : 'Cadastrar Cliente'}
          </DialogTitle>
        </DialogHeader>

        {lead && (
          <div className="bg-muted/50 p-3 rounded-lg mb-4">
            <p className="text-sm font-medium">{lead.company_name}</p>
            {lead.contact_name && (
              <p className="text-sm text-muted-foreground">{lead.contact_name}</p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project_value">Valor do Projeto (R$)</Label>
              <Input
                id="project_value"
                type="text"
                inputMode="numeric"
                placeholder="0,00"
                value={formData.project_value}
                onChange={(e) => setFormData(prev => ({ ...prev, project_value: handleCurrencyInput(e.target.value) }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contract_duration_months">Duração (meses)</Label>
              <Input
                id="contract_duration_months"
                type="number"
                placeholder="12"
                value={formData.contract_duration_months}
                onChange={(e) => setFormData(prev => ({ ...prev, contract_duration_months: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project_start_date">Início do Projeto</Label>
              <Input
                id="project_start_date"
                type="date"
                value={formData.project_start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, project_start_date: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_due_date">Vencimento Pagamento</Label>
              <Input
                id="payment_due_date"
                type="date"
                value={formData.payment_due_date}
                onChange={(e) => setFormData(prev => ({ ...prev, payment_due_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="services">Serviços Prestados</Label>
            <Textarea
              id="services"
              placeholder="Descreva os serviços..."
              value={formData.services}
              onChange={(e) => setFormData(prev => ({ ...prev, services: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Contrato (PDF)</Label>
            {formData.contract_url ? (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <FileText className="w-5 h-5 text-primary" />
                <a
                  href={formData.contract_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex-1 truncate"
                >
                  Contrato anexado
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setFormData(prev => ({ ...prev, contract_url: '' }))}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                  id="contract-upload"
                />
                <Label
                  htmlFor="contract-upload"
                  className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary transition-colors"
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      <span>Clique para enviar o contrato</span>
                    </>
                  )}
                </Label>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Observações adicionais..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {client ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
