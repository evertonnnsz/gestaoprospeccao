 import { useMemo } from 'react';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Skeleton } from '@/components/ui/skeleton';
 import { 
   DollarSign, 
   MessageCircle, 
   Users, 
   MousePointer, 
   TrendingUp, 
   Eye,
   Target,
   BarChart3
 } from 'lucide-react';
 import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
 
 interface Campaign {
   id: string;
   platform: string;
   investment: number;
   impressions: number;
   clicks: number;
   conversations_started: number;
   leads_generated: number;
   period_start: string;
   period_end: string;
 }
 
 interface PerformanceDashboardProps {
   clientId: string;
   clientName: string;
   campaigns: Campaign[];
   isLoading: boolean;
 }
 
 const COLORS = ['#3b82f6', '#f97316'];
 
 export function PerformanceDashboard({ clientId, clientName, campaigns, isLoading }: PerformanceDashboardProps) {
   const metrics = useMemo(() => {
     if (!campaigns.length) return null;
 
     const totals = campaigns.reduce((acc, c) => ({
       investment: acc.investment + Number(c.investment),
       impressions: acc.impressions + c.impressions,
       clicks: acc.clicks + c.clicks,
       conversations: acc.conversations + c.conversations_started,
       leads: acc.leads + c.leads_generated,
     }), { investment: 0, impressions: 0, clicks: 0, conversations: 0, leads: 0 });
 
     return {
       ...totals,
       ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
       cpc: totals.clicks > 0 ? totals.investment / totals.clicks : 0,
       costPerConversation: totals.conversations > 0 ? totals.investment / totals.conversations : 0,
       cpl: totals.leads > 0 ? totals.investment / totals.leads : 0,
     };
   }, [campaigns]);
 
   const platformData = useMemo(() => {
     const byPlatform: Record<string, typeof metrics> = {};
     
     campaigns.forEach(c => {
       const platform = c.platform === 'meta_ads' ? 'Meta Ads' : 'Google Ads';
       if (!byPlatform[platform]) {
         byPlatform[platform] = { investment: 0, impressions: 0, clicks: 0, conversations: 0, leads: 0, ctr: 0, cpc: 0, costPerConversation: 0, cpl: 0 };
       }
       byPlatform[platform]!.investment += Number(c.investment);
       byPlatform[platform]!.impressions += c.impressions;
       byPlatform[platform]!.clicks += c.clicks;
       byPlatform[platform]!.conversations += c.conversations_started;
       byPlatform[platform]!.leads += c.leads_generated;
     });
 
     return Object.entries(byPlatform).map(([name, data]) => ({
       name,
       investimento: data!.investment,
       cliques: data!.clicks,
       conversas: data!.conversations,
       leads: data!.leads,
     }));
   }, [campaigns]);
 
   const pieData = useMemo(() => {
     return platformData.map(p => ({
       name: p.name,
       value: p.investimento,
     }));
   }, [platformData]);
 
   if (isLoading) {
     return (
       <Card>
         <CardHeader>
           <Skeleton className="h-6 w-48" />
           <Skeleton className="h-4 w-72 mt-2" />
         </CardHeader>
         <CardContent>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {[...Array(8)].map((_, i) => (
               <Skeleton key={i} className="h-24" />
             ))}
           </div>
         </CardContent>
       </Card>
     );
   }
 
   if (!metrics) {
     return (
       <Card className="border-dashed">
         <CardContent className="flex flex-col items-center justify-center py-12 text-center">
           <BarChart3 className="w-12 h-12 text-muted-foreground/50 mb-4" />
           <h3 className="text-lg font-medium mb-2">Nenhum dado de campanha</h3>
           <p className="text-muted-foreground">
             Insira dados de campanhas para visualizar o dashboard de performance.
           </p>
         </CardContent>
       </Card>
     );
   }
 
   const kpiCards = [
     { title: 'Investimento Total', value: `R$ ${metrics.investment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: 'text-primary' },
     { title: 'Conversas Iniciadas', value: metrics.conversations.toLocaleString(), icon: MessageCircle, color: 'text-success' },
     { title: 'Custo por Conversa', value: `R$ ${metrics.costPerConversation.toFixed(2)}`, icon: MessageCircle, color: 'text-warning' },
     { title: 'Leads Gerados', value: metrics.leads.toLocaleString(), icon: Users, color: 'text-success' },
     { title: 'CPL (Custo por Lead)', value: `R$ ${metrics.cpl.toFixed(2)}`, icon: Target, color: 'text-warning' },
     { title: 'CTR', value: `${metrics.ctr.toFixed(2)}%`, icon: Eye, color: 'text-primary' },
     { title: 'CPC', value: `R$ ${metrics.cpc.toFixed(2)}`, icon: MousePointer, color: 'text-warning' },
     { title: 'Total de Cliques', value: metrics.clicks.toLocaleString(), icon: MousePointer, color: 'text-primary' },
   ];
 
   return (
     <Card>
       <CardHeader>
         <CardTitle className="flex items-center gap-2">
           <TrendingUp className="w-5 h-5" />
           Dashboard de Performance
         </CardTitle>
         <CardDescription>
           Métricas consolidadas para {clientName}
         </CardDescription>
       </CardHeader>
       <CardContent className="space-y-8">
         {/* KPI Cards */}
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           {kpiCards.map((kpi, i) => (
             <div key={i} className="p-4 rounded-lg border bg-card">
               <div className="flex items-center gap-2 mb-2">
                 <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                 <span className="text-xs text-muted-foreground">{kpi.title}</span>
               </div>
               <p className="text-xl font-bold">{kpi.value}</p>
             </div>
           ))}
         </div>
 
         {/* Charts */}
         {platformData.length > 1 && (
           <div className="grid md:grid-cols-2 gap-6">
             {/* Bar Chart - Comparison */}
             <div>
               <h4 className="font-medium mb-4">Comparativo por Plataforma</h4>
               <ResponsiveContainer width="100%" height={300}>
                 <BarChart data={platformData}>
                   <CartesianGrid strokeDasharray="3 3" />
                   <XAxis dataKey="name" />
                   <YAxis />
                   <Tooltip 
                     formatter={(value: number) => value.toLocaleString()}
                     contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                   />
                   <Legend />
                   <Bar dataKey="cliques" name="Cliques" fill="#3b82f6" />
                   <Bar dataKey="conversas" name="Conversas" fill="#22c55e" />
                   <Bar dataKey="leads" name="Leads" fill="#f97316" />
                 </BarChart>
               </ResponsiveContainer>
             </div>
 
             {/* Pie Chart - Investment Distribution */}
             <div>
               <h4 className="font-medium mb-4">Distribuição de Investimento</h4>
               <ResponsiveContainer width="100%" height={300}>
                 <PieChart>
                   <Pie
                     data={pieData}
                     cx="50%"
                     cy="50%"
                     labelLine={false}
                     label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                     outerRadius={100}
                     fill="#8884d8"
                     dataKey="value"
                   >
                     {pieData.map((_, index) => (
                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                     ))}
                   </Pie>
                   <Tooltip 
                     formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                     contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                   />
                 </PieChart>
               </ResponsiveContainer>
             </div>
           </div>
         )}
       </CardContent>
     </Card>
   );
 }