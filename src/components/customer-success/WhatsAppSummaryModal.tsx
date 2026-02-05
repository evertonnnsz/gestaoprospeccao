 import { useState, useMemo, useEffect } from 'react';
 import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Textarea } from '@/components/ui/textarea';
 import { Phone, MessageCircle, AlertCircle } from 'lucide-react';
 import { format } from 'date-fns';
 import { ptBR } from 'date-fns/locale';
 
 interface WhatsAppSummaryModalProps {
   isOpen: boolean;
   onClose: () => void;
   clientName: string;
   clientPhone: string | null;
   metrics: {
     investment: number;
     impressions: number;
     clicks: number;
     conversations: number;
     leads: number;
     ctr: number;
     cpc: number;
     cpl: number;
     customMetrics: Array<{ name: string; value: number }>;
   };
   periodStart: string;
   periodEnd: string;
 }
 
 const formatCurrency = (value: number): string => {
   return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
 };
 
 const formatNumber = (value: number): string => {
   return value.toLocaleString('pt-BR');
 };
 
 const formatWhatsAppUrl = (phone: string, message: string): string => {
  // Remove TODOS os caracteres que não são dígitos (mais robusto)
  const cleanPhone = phone.replace(/\D/g, '');
   
   // Adiciona codigo do Brasil se nao tiver
   const finalPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
   
   // Codifica a mensagem para URL
   const encodedMessage = encodeURIComponent(message);
   
   return `https://wa.me/${finalPhone}?text=${encodedMessage}`;
 };
 
 const buildDynamicMessage = (
   clientName: string,
   metrics: WhatsAppSummaryModalProps['metrics'],
   periodStart: string,
   periodEnd: string
 ): string => {
   const lines: string[] = [];
   
   // Saudação
   const formattedStart = format(new Date(periodStart), 'dd/MM/yyyy', { locale: ptBR });
   const formattedEnd = format(new Date(periodEnd), 'dd/MM/yyyy', { locale: ptBR });
   
   lines.push(`Olá, ${clientName}! 👋`);
   lines.push('');
   lines.push(`Segue o resumo de performance personalizado das suas campanhas (${formattedStart} a ${formattedEnd}):`);
   lines.push('');
   
   // Métricas dinâmicas - só inclui se > 0
   if (metrics.investment > 0) {
     lines.push(`💰 Investimento: R$ ${formatCurrency(metrics.investment)}`);
   }
   
   if (metrics.impressions > 0) {
     lines.push(`👁️ Impressões: ${formatNumber(metrics.impressions)}`);
   }
   
   if (metrics.clicks > 0) {
     lines.push(`🖱️ Cliques: ${formatNumber(metrics.clicks)}`);
   }
   
   if (metrics.conversations > 0) {
     lines.push(`💬 Conversas Iniciadas: ${formatNumber(metrics.conversations)}`);
   }
   
   if (metrics.leads > 0) {
     lines.push(`📈 Leads Gerados: ${formatNumber(metrics.leads)}`);
   }
   
   if (metrics.ctr > 0) {
     lines.push(`📊 CTR: ${metrics.ctr.toFixed(2)}%`);
   }
   
   if (metrics.cpc > 0) {
     lines.push(`🎯 CPC: R$ ${formatCurrency(metrics.cpc)}`);
   }
   
   if (metrics.cpl > 0) {
     lines.push(`💎 CPL: R$ ${formatCurrency(metrics.cpl)}`);
   }
   
   // Métricas customizadas
   const customEmojis = ['⭐', '📌', '🔥', '✨', '💡', '🎨', '📊', '🏆'];
   metrics.customMetrics.forEach((metric, index) => {
     if (metric.value > 0) {
       const emoji = customEmojis[index % customEmojis.length];
       // Determina se o valor parece ser monetário (nome contém R$, Custo, Valor, etc)
       const isMonetary = /custo|valor|invest|r\$|preço|gasto/i.test(metric.name);
       const formattedValue = isMonetary 
         ? `R$ ${formatCurrency(metric.value)}`
         : formatNumber(metric.value);
       lines.push(`${emoji} ${metric.name}: ${formattedValue}`);
     }
   });
   
   lines.push('');
   lines.push('Estes são os indicadores que estamos acompanhando de perto para o seu negócio. Qualquer dúvida, estou aqui! 👊');
   
   return lines.join('\n');
 };
 
 export function WhatsAppSummaryModal({
   isOpen,
   onClose,
   clientName,
   clientPhone,
   metrics,
   periodStart,
   periodEnd,
 }: WhatsAppSummaryModalProps) {
   const initialMessage = useMemo(() => {
     return buildDynamicMessage(clientName, metrics, periodStart, periodEnd);
   }, [clientName, metrics, periodStart, periodEnd]);
   
   const [message, setMessage] = useState(initialMessage);
   
   // Reset message when modal opens with new data
   useEffect(() => {
     if (isOpen) {
       setMessage(initialMessage);
     }
   }, [isOpen, initialMessage]);
   
   const handleSend = () => {
     if (!clientPhone) return;
     
     const url = formatWhatsAppUrl(clientPhone, message);
     window.open(url, '_blank');
     onClose();
   };
   
   const formattedPhone = clientPhone 
     ? clientPhone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 $2 $3-$4')
     : 'Não cadastrado';
   
   return (
     <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
       <DialogContent className="sm:max-w-lg">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <MessageCircle className="w-5 h-5 text-green-600" />
             Enviar Resumo via WhatsApp
           </DialogTitle>
           <DialogDescription>
             Revise e edite a mensagem antes de enviar
           </DialogDescription>
         </DialogHeader>
         
         <div className="space-y-4">
           {/* Phone display */}
           <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
             <Phone className="w-4 h-4 text-muted-foreground" />
             <span className="text-sm">
               <span className="text-muted-foreground">Número: </span>
               <span className="font-medium">{formattedPhone}</span>
             </span>
           </div>
           
           {!clientPhone && (
             <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
               <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
               <p className="text-sm">
                 Este cliente não possui WhatsApp cadastrado. Atualize o cadastro do lead para habilitar o envio.
               </p>
             </div>
           )}
           
           {/* Editable message */}
           <div>
             <Textarea
               value={message}
               onChange={(e) => setMessage(e.target.value)}
               className="min-h-[250px] font-mono text-sm"
               placeholder="Mensagem..."
             />
             <p className="text-xs text-muted-foreground mt-2">
               ⚠️ Você pode editar a mensagem antes de enviar
             </p>
           </div>
         </div>
         
         <DialogFooter className="gap-2 sm:gap-0">
           <Button variant="outline" onClick={onClose}>
             Cancelar
           </Button>
           <Button 
             onClick={handleSend} 
             disabled={!clientPhone}
             className="bg-green-600 hover:bg-green-700"
           >
             <MessageCircle className="w-4 h-4 mr-2" />
             Confirmar e Abrir WhatsApp
           </Button>
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 }