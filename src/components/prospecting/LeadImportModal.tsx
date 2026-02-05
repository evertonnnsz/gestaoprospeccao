import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, FileSpreadsheet, ArrowRight, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const NO_MAPPING_VALUE = '__none__';

export interface ImportedLead {
  company_name: string;
  contact_name?: string;
  whatsapp?: string;
  instagram?: string;
  segment?: string;
  observations?: string;
  isDuplicate?: boolean;
  isSelected?: boolean;
}

interface ColumnMapping {
  company_name: string;
  contact_name: string;
  whatsapp: string;
  instagram: string;
  segment: string;
  observations: string;
}

interface LeadImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinueToPreview: (leads: ImportedLead[]) => void;
}

const SYSTEM_FIELDS = [
  { key: 'company_name', label: 'Empresa', required: true },
  { key: 'contact_name', label: 'Nome do Contato', required: false },
  { key: 'whatsapp', label: 'WhatsApp', required: false },
  { key: 'instagram', label: 'Instagram', required: false },
  { key: 'segment', label: 'Segmento', required: false },
  { key: 'observations', label: 'Observações', required: false },
] as const;

export function LeadImportModal({ 
  open, 
  onOpenChange, 
  onContinueToPreview 
}: LeadImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    company_name: '',
    contact_name: '',
    whatsapp: '',
    instagram: '',
    segment: '',
    observations: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const resetState = useCallback(() => {
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMapping({
      company_name: '',
      contact_name: '',
      whatsapp: '',
      instagram: '',
      segment: '',
      observations: '',
    });
    setError(null);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExtension)) {
      setError('Formato de arquivo não suportado. Use .xlsx, .xls ou .csv');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as string[][];

      if (data.length < 2) {
        setError('O arquivo deve conter pelo menos uma linha de cabeçalho e uma linha de dados.');
        return;
      }

      const fileHeaders = (data[0] || []).map(h => String(h || '').trim()).filter(Boolean);
      const fileRows = data.slice(1).filter(row => row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ''));

      if (fileHeaders.length === 0) {
        setError('Não foi possível identificar as colunas do arquivo.');
        return;
      }

      setFile(selectedFile);
      setHeaders(fileHeaders);
      setRows(fileRows);

      // Auto-map columns based on common names
      const autoMapping: ColumnMapping = {
        company_name: '',
        contact_name: '',
        whatsapp: '',
        instagram: '',
        segment: '',
        observations: '',
      };

      const lowerHeaders = fileHeaders.map(h => h.toLowerCase());
      
      // Auto-detect company name
      const companyMatches = ['empresa', 'company', 'nome da empresa', 'razao social', 'nome'];
      for (const match of companyMatches) {
        const idx = lowerHeaders.findIndex(h => h.includes(match));
        if (idx !== -1) {
          autoMapping.company_name = fileHeaders[idx];
          break;
        }
      }

      // Auto-detect contact name
      const contactMatches = ['contato', 'contact', 'nome do contato', 'responsavel'];
      for (const match of contactMatches) {
        const idx = lowerHeaders.findIndex(h => h.includes(match));
        if (idx !== -1) {
          autoMapping.contact_name = fileHeaders[idx];
          break;
        }
      }

      // Auto-detect WhatsApp
      const phoneMatches = ['whatsapp', 'telefone', 'phone', 'celular', 'fone'];
      for (const match of phoneMatches) {
        const idx = lowerHeaders.findIndex(h => h.includes(match));
        if (idx !== -1) {
          autoMapping.whatsapp = fileHeaders[idx];
          break;
        }
      }

      // Auto-detect Instagram
      const instaMatches = ['instagram', 'insta', '@'];
      for (const match of instaMatches) {
        const idx = lowerHeaders.findIndex(h => h.includes(match));
        if (idx !== -1) {
          autoMapping.instagram = fileHeaders[idx];
          break;
        }
      }

      // Auto-detect Segment
      const segmentMatches = ['segmento', 'segment', 'nicho', 'setor', 'ramo'];
      for (const match of segmentMatches) {
        const idx = lowerHeaders.findIndex(h => h.includes(match));
        if (idx !== -1) {
          autoMapping.segment = fileHeaders[idx];
          break;
        }
      }

      // Auto-detect Observations
      const obsMatches = ['observa', 'obs', 'notas', 'notes', 'descri'];
      for (const match of obsMatches) {
        const idx = lowerHeaders.findIndex(h => h.includes(match));
        if (idx !== -1) {
          autoMapping.observations = fileHeaders[idx];
          break;
        }
      }

      setMapping(autoMapping);
    } catch (err) {
      console.error('Error parsing file:', err);
      setError('Erro ao ler o arquivo. Verifique se o formato está correto.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const input = document.createElement('input');
      input.type = 'file';
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(droppedFile);
      input.files = dataTransfer.files;
      
      handleFileChange({ target: input } as React.ChangeEvent<HTMLInputElement>);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setMapping(prev => ({ 
      ...prev, 
      [field]: value === NO_MAPPING_VALUE ? '' : value 
    }));
  };

  const handleContinue = () => {
    if (!mapping.company_name) {
      setError('O campo "Empresa" é obrigatório. Por favor, mapeie-o.');
      return;
    }

    const leads: ImportedLead[] = rows.map(row => {
      const getValueByHeader = (header: string): string => {
        if (!header) return '';
        const idx = headers.indexOf(header);
        return idx !== -1 ? String(row[idx] || '').trim() : '';
      };

      return {
        company_name: getValueByHeader(mapping.company_name),
        contact_name: getValueByHeader(mapping.contact_name) || undefined,
        whatsapp: getValueByHeader(mapping.whatsapp) || undefined,
        instagram: getValueByHeader(mapping.instagram) || undefined,
        segment: getValueByHeader(mapping.segment) || undefined,
        observations: getValueByHeader(mapping.observations) || undefined,
      };
    }).filter(lead => lead.company_name); // Filter out rows without company name

    if (leads.length === 0) {
      setError('Nenhum lead válido encontrado. Verifique o mapeamento das colunas.');
      return;
    }

    onContinueToPreview(leads);
    resetState();
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Importar Lista de Leads
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step 1: File Upload */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              1. Selecione o arquivo
            </Label>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
            >
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                disabled={isProcessing}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                {file ? (
                  <div className="space-y-1">
                    <p className="font-medium text-primary">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {rows.length} linhas encontradas
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="font-medium">
                      {isProcessing ? 'Processando...' : 'Arraste ou clique para selecionar'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Suporta: .xlsx, .xls, .csv
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Step 2: Column Mapping */}
          {headers.length > 0 && (
            <div className="space-y-4">
              <Label className="text-sm font-medium">
                2. Mapeie as colunas do seu arquivo
              </Label>
              <div className="grid gap-4">
                {SYSTEM_FIELDS.map(field => (
                  <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
                    <Label className="text-sm">
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Select
                      value={mapping[field.key as keyof ColumnMapping] || NO_MAPPING_VALUE}
                      onValueChange={(value) => handleMappingChange(field.key as keyof ColumnMapping, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_MAPPING_VALUE}>Não mapear</SelectItem>
                        {headers.map((header, idx) => (
                          <SelectItem key={idx} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button 
              onClick={handleContinue}
              disabled={headers.length === 0 || !mapping.company_name}
            >
              Continuar para Triagem
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
