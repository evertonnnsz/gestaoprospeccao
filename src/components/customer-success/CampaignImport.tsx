 import { useState, useRef } from 'react';
 import { useMutation } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Card, CardContent } from '@/components/ui/card';
 import { toast } from '@/hooks/use-toast';
 import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
 
 interface CampaignImportProps {
   clientId: string;
   onSuccess: () => void;
 }
 
 type AdPlatform = 'meta_ads' | 'google_ads';
 
 interface ParsedRow {
   campaign_name?: string;
   period_start: string;
   period_end: string;
   investment: number;
   impressions: number;
   clicks: number;
   conversations_started: number;
   leads_generated: number;
 }
 
 export function CampaignImport({ clientId, onSuccess }: CampaignImportProps) {
   const { user } = useAuth();
   const fileInputRef = useRef<HTMLInputElement>(null);
   const [platform, setPlatform] = useState<AdPlatform>('meta_ads');
   const [file, setFile] = useState<File | null>(null);
   const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
   const [error, setError] = useState<string>('');
 
   const parseCSV = (text: string): ParsedRow[] => {
     const lines = text.trim().split('\n');
     if (lines.length < 2) throw new Error('Arquivo vazio ou sem dados');
 
     const headers = lines[0].toLowerCase().split(/[,;]/).map(h => h.trim());
     const rows: ParsedRow[] = [];
 
     for (let i = 1; i < lines.length; i++) {
       const values = lines[i].split(/[,;]/).map(v => v.trim().replace(/"/g, ''));
       if (values.length < 2) continue;
 
       const getCol = (possibleNames: string[]) => {
         const idx = headers.findIndex(h => possibleNames.some(n => h.includes(n)));
         return idx >= 0 ? values[idx] : '';
       };
 
       const parseNum = (val: string) => {
         const cleaned = val.replace(/[R$\s.]/g, '').replace(',', '.');
         return parseFloat(cleaned) || 0;
       };
 
       const parseDate = (val: string) => {
         if (!val) return new Date().toISOString().split('T')[0];
         // Try different date formats
         const parts = val.split(/[\/\-]/);
         if (parts.length === 3) {
           if (parts[0].length === 4) return val; // YYYY-MM-DD
           return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`; // DD/MM/YYYY
         }
         return new Date().toISOString().split('T')[0];
       };
 
       rows.push({
         campaign_name: getCol(['campanha', 'campaign', 'nome']),
         period_start: parseDate(getCol(['inicio', 'start', 'data_inicio', 'de'])),
         period_end: parseDate(getCol(['fim', 'end', 'data_fim', 'até', 'ate'])),
         investment: parseNum(getCol(['investimento', 'gasto', 'spent', 'custo', 'valor'])),
         impressions: parseInt(getCol(['impressoes', 'impressions', 'alcance'])) || 0,
         clicks: parseInt(getCol(['cliques', 'clicks', 'click'])) || 0,
         conversations_started: parseInt(getCol(['conversas', 'conversations', 'mensagens'])) || 0,
         leads_generated: parseInt(getCol(['leads', 'cadastros', 'conversoes'])) || 0,
       });
     }
 
     return rows.filter(r => r.investment > 0 || r.impressions > 0);
   };
 
   const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const selectedFile = e.target.files?.[0];
     if (!selectedFile) return;
 
     setFile(selectedFile);
     setError('');
     setParsedData([]);
 
     try {
       const text = await selectedFile.text();
       const data = parseCSV(text);
       if (data.length === 0) {
         throw new Error('Nenhum dado válido encontrado no arquivo');
       }
       setParsedData(data);
     } catch (err: any) {
       setError(err.message);
     }
   };
 
   const importMutation = useMutation({
     mutationFn: async () => {
       const records = parsedData.map(row => ({
         user_id: user?.id,
         client_id: clientId,
         platform,
         campaign_name: row.campaign_name || null,
         period_start: row.period_start,
         period_end: row.period_end,
         investment: row.investment,
         impressions: row.impressions,
         clicks: row.clicks,
         conversations_started: row.conversations_started,
         leads_generated: row.leads_generated,
         source: 'import',
       }));
 
       const { error } = await supabase
         .from('campanhas_anuncios')
         .insert(records);
 
       if (error) throw error;
       return records.length;
     },
     onSuccess: (count) => {
       toast({
         title: 'Importação concluída!',
         description: `${count} registro(s) importado(s) com sucesso.`,
       });
       setFile(null);
       setParsedData([]);
       if (fileInputRef.current) fileInputRef.current.value = '';
       onSuccess();
     },
     onError: (error) => {
       toast({
         title: 'Erro na importação',
         description: error.message,
         variant: 'destructive',
       });
     },
   });
 
   return (
     <div className="space-y-6">
       {/* Platform Selection */}
       <div className="space-y-2 max-w-xs">
         <Label htmlFor="import-platform">Plataforma *</Label>
         <Select value={platform} onValueChange={(v: AdPlatform) => setPlatform(v)}>
           <SelectTrigger id="import-platform">
             <SelectValue />
           </SelectTrigger>
           <SelectContent className="bg-background border shadow-lg z-50">
             <SelectItem value="meta_ads">Meta Ads (Facebook/Instagram)</SelectItem>
             <SelectItem value="google_ads">Google Ads</SelectItem>
           </SelectContent>
         </Select>
       </div>
 
       {/* File Upload */}
       <div className="space-y-2">
         <Label>Arquivo CSV/Excel</Label>
         <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
           <input
             ref={fileInputRef}
             type="file"
             accept=".csv,.xlsx,.xls"
             onChange={handleFileChange}
             className="hidden"
             id="file-upload"
           />
           <label htmlFor="file-upload" className="cursor-pointer">
             <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
             <p className="text-sm text-muted-foreground mb-2">
               Arraste um arquivo ou clique para selecionar
             </p>
             <p className="text-xs text-muted-foreground">
               Suporta CSV e Excel com colunas: Campanha, Investimento, Impressões, Cliques, Conversas, Leads
             </p>
           </label>
         </div>
       </div>
 
       {/* File Info */}
       {file && (
         <Card>
           <CardContent className="pt-4">
             <div className="flex items-center gap-3">
               <FileSpreadsheet className="w-8 h-8 text-primary" />
               <div className="flex-1">
                 <p className="font-medium">{file.name}</p>
                 <p className="text-sm text-muted-foreground">
                   {(file.size / 1024).toFixed(1)} KB
                 </p>
               </div>
               {parsedData.length > 0 && (
                 <div className="flex items-center gap-2 text-success">
                   <CheckCircle2 className="w-5 h-5" />
                   <span className="text-sm font-medium">{parsedData.length} registros</span>
                 </div>
               )}
             </div>
           </CardContent>
         </Card>
       )}
 
       {/* Error */}
       {error && (
         <div className="flex items-center gap-2 text-destructive">
           <AlertCircle className="w-5 h-5" />
           <span className="text-sm">{error}</span>
         </div>
       )}
 
       {/* Preview */}
       {parsedData.length > 0 && (
         <div className="space-y-3">
           <h4 className="font-medium">Pré-visualização dos dados:</h4>
           <div className="overflow-x-auto">
             <table className="w-full text-sm border rounded-lg">
               <thead className="bg-muted">
                 <tr>
                   <th className="px-3 py-2 text-left">Campanha</th>
                   <th className="px-3 py-2 text-left">Período</th>
                   <th className="px-3 py-2 text-right">Investimento</th>
                   <th className="px-3 py-2 text-right">Impressões</th>
                   <th className="px-3 py-2 text-right">Cliques</th>
                   <th className="px-3 py-2 text-right">Conversas</th>
                   <th className="px-3 py-2 text-right">Leads</th>
                 </tr>
               </thead>
               <tbody>
                 {parsedData.slice(0, 5).map((row, i) => (
                   <tr key={i} className="border-t">
                     <td className="px-3 py-2">{row.campaign_name || '-'}</td>
                     <td className="px-3 py-2">{row.period_start} a {row.period_end}</td>
                     <td className="px-3 py-2 text-right">R$ {row.investment.toFixed(2)}</td>
                     <td className="px-3 py-2 text-right">{row.impressions.toLocaleString()}</td>
                     <td className="px-3 py-2 text-right">{row.clicks.toLocaleString()}</td>
                     <td className="px-3 py-2 text-right">{row.conversations_started}</td>
                     <td className="px-3 py-2 text-right">{row.leads_generated}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
             {parsedData.length > 5 && (
               <p className="text-sm text-muted-foreground mt-2">
                 ... e mais {parsedData.length - 5} registro(s)
               </p>
             )}
           </div>
         </div>
       )}
 
       {/* Import Button */}
       <Button 
         onClick={() => importMutation.mutate()}
         disabled={parsedData.length === 0 || importMutation.isPending}
       >
         {importMutation.isPending ? (
           <Loader2 className="w-4 h-4 mr-2 animate-spin" />
         ) : (
           <Upload className="w-4 h-4 mr-2" />
         )}
         Importar {parsedData.length > 0 ? `${parsedData.length} Registro(s)` : 'Dados'}
       </Button>
     </div>
   );
 }