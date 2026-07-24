 import { useState } from 'react';
 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Button } from '@/components/ui/button';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { toast } from '@/hooks/use-toast';
 import { Users, Upload, PenLine, TrendingUp, FileDown, Loader2 } from 'lucide-react';
 import { CampaignForm } from '@/components/customer-success/CampaignForm';
 import { CampaignImport } from '@/components/customer-success/CampaignImport';
 import { PerformanceDashboard } from '@/components/customer-success/PerformanceDashboard';
 import { CampaignHistory } from '@/components/customer-success/CampaignHistory';
 import type { Client } from '@/types/crm';
 
 export default function CustomerSuccess() {
   const { user } = useAuth();
   const queryClient = useQueryClient();
   const [selectedClientId, setSelectedClientId] = useState<string>('');
   const [activeTab, setActiveTab] = useState<string>('manual');
 
   // Fetch active clients (with lead data)
   const { data: clients = [], isLoading: isLoadingClients } = useQuery({
     queryKey: ['active-clients', user?.id],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('clients')
         .select(`
           *,
          lead:leads(company_name, contact_name, whatsapp)
         `)
         .eq('user_id', user?.id || '')
         .order('created_at', { ascending: false });
 
       if (error) throw error;
      return data as unknown as (Client & { lead: { company_name: string; contact_name: string | null; whatsapp: string | null } })[];
     },
     enabled: !!user?.id,
   });
 
   // Fetch campaigns for selected client
   const { data: campaigns = [], isLoading: isLoadingCampaigns } = useQuery({
     queryKey: ['campanhas-anuncios', selectedClientId],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('campanhas_anuncios')
         .select('*')
         .eq('client_id', selectedClientId)
         .order('period_start', { ascending: false });
 
       if (error) throw error;
       return data;
     },
     enabled: !!selectedClientId,
   });
 
   // Get selected client data
   const selectedClient = clients.find(c => c.id === selectedClientId);
 
   return (
     <div className="app-page">
       {/* Header */}
       <div>
         <h1 className="text-3xl font-bold">Sucesso do Cliente</h1>
         <p className="text-muted-foreground mt-1">
           Gerencie e apresente a performance de anúncios para seus clientes
         </p>
       </div>
 
       {/* Client Selector */}
       <Card>
         <CardHeader className="pb-4">
           <CardTitle className="text-lg flex items-center gap-2">
             <Users className="w-5 h-5" />
             Selecionar Cliente
           </CardTitle>
           <CardDescription>
             Escolha um cliente ativo para visualizar ou inserir dados de campanhas
           </CardDescription>
         </CardHeader>
         <CardContent>
           <Select value={selectedClientId} onValueChange={setSelectedClientId}>
             <SelectTrigger className="w-full md:w-96">
               <SelectValue placeholder="Selecione um cliente..." />
             </SelectTrigger>
             <SelectContent className="bg-background border shadow-lg z-50">
               {isLoadingClients ? (
                 <div className="p-4 text-center text-muted-foreground">
                   <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                 </div>
               ) : clients.length === 0 ? (
                 <div className="p-4 text-center text-muted-foreground">
                   Nenhum cliente ativo encontrado
                 </div>
               ) : (
                 clients.map((client) => (
                   <SelectItem key={client.id} value={client.id}>
                     {client.lead?.company_name || 'Cliente sem nome'} 
                     {client.lead?.contact_name && ` - ${client.lead.contact_name}`}
                   </SelectItem>
                 ))
               )}
             </SelectContent>
           </Select>
         </CardContent>
       </Card>
 
       {/* Data Entry Section - Only shown when client is selected */}
       {selectedClientId && (
         <>
           <Card>
             <CardHeader className="pb-4">
               <CardTitle className="text-lg flex items-center gap-2">
                 <TrendingUp className="w-5 h-5" />
                 Entrada de Dados - {selectedClient?.lead?.company_name}
               </CardTitle>
               <CardDescription>
                 Importe uma planilha ou insira os dados manualmente
               </CardDescription>
             </CardHeader>
             <CardContent>
               <Tabs value={activeTab} onValueChange={setActiveTab}>
                 <TabsList className="grid w-full grid-cols-2 max-w-md">
                   <TabsTrigger value="manual" className="flex items-center gap-2">
                     <PenLine className="w-4 h-4" />
                     Lançamento Manual
                   </TabsTrigger>
                   <TabsTrigger value="import" className="flex items-center gap-2">
                     <Upload className="w-4 h-4" />
                     Importar Planilha
                   </TabsTrigger>
                 </TabsList>
                 <TabsContent value="manual" className="mt-6">
                   <CampaignForm 
                     clientId={selectedClientId} 
                     onSuccess={() => queryClient.invalidateQueries({ queryKey: ['campanhas-anuncios', selectedClientId] })}
                   />
                 </TabsContent>
                 <TabsContent value="import" className="mt-6">
                   <CampaignImport 
                     clientId={selectedClientId}
                     onSuccess={() => queryClient.invalidateQueries({ queryKey: ['campanhas-anuncios', selectedClientId] })}
                   />
                 </TabsContent>
               </Tabs>
             </CardContent>
           </Card>
 
           {/* Performance Dashboard */}
           <PerformanceDashboard 
             clientId={selectedClientId}
             clientName={selectedClient?.lead?.company_name || 'Cliente'}
              clientPhone={selectedClient?.lead?.whatsapp || null}
             campaigns={campaigns}
             isLoading={isLoadingCampaigns}
           />
 
           {/* Campaign History */}
           <CampaignHistory 
             clientId={selectedClientId}
             campaigns={campaigns}
             isLoading={isLoadingCampaigns}
             onUpdate={() => queryClient.invalidateQueries({ queryKey: ['campanhas-anuncios', selectedClientId] })}
           />
         </>
       )}
 
       {/* Empty State */}
       {!selectedClientId && (
         <Card className="border-dashed">
           <CardContent className="flex flex-col items-center justify-center py-12 text-center">
             <Users className="w-12 h-12 text-muted-foreground/50 mb-4" />
             <h3 className="text-lg font-medium mb-2">Selecione um cliente</h3>
             <p className="text-muted-foreground max-w-md">
               Escolha um cliente ativo no seletor acima para visualizar o dashboard de performance 
               e inserir dados de campanhas de anúncios.
             </p>
           </CardContent>
         </Card>
       )}
     </div>
   );
 }
