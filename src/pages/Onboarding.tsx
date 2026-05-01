import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { ClipboardCheck, Loader2, Users, UserCheck, Plus, Ban } from 'lucide-react';
import { DEFAULT_ONBOARDING_TASKS, PLATFORM_LABELS, PLATFORM_COLORS } from '@/lib/constants/onboardingTasks';
import type { Client } from '@/types/crm';

type OnboardingTask = {
  id: string;
  client_id: string;
  user_id: string;
  task_order: string;
  task_name: string;
  platform: string;
  is_completed: boolean;
  is_lead_responsibility: boolean;
  is_applicable: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export default function Onboarding() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  // Fetch clients (fechado status via lead join)
  const { data: clients = [], isLoading: isLoadingClients } = useQuery({
    queryKey: ['onboarding-clients', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*, lead:leads(company_name, contact_name)')
        .eq('user_id', user?.id || '')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as (Client & { lead: { company_name: string; contact_name: string | null } })[];
    },
    enabled: !!user?.id,
  });

  // Fetch tasks for selected client
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ['onboarding-tasks', selectedClientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_onboarding_tasks')
        .select('*')
        .eq('client_id', selectedClientId)
        .order('task_order', { ascending: true });
      if (error) throw error;
      return data as OnboardingTask[];
    },
    enabled: !!selectedClientId,
  });

  // Initialize tasks for a client
  const initMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const rows = DEFAULT_ONBOARDING_TASKS.map((t) => ({
        client_id: clientId,
        user_id: user!.id,
        task_order: t.task_order,
        task_name: t.task_name,
        platform: t.platform,
      }));
      const { error } = await supabase.from('client_onboarding_tasks').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks', selectedClientId] });
      toast({ title: 'Tarefas de onboarding criadas com sucesso!' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao criar tarefas', description: err.message, variant: 'destructive' });
    },
  });

  // Toggle task completion
  const toggleMutation = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      const { error } = await supabase
        .from('client_onboarding_tasks')
        .update({
          is_completed: completed,
          completed_at: completed ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks', selectedClientId] });
    },
  });

  // Toggle lead responsibility
  const toggleLeadMutation = useMutation({
    mutationFn: async ({ taskId, isLead }: { taskId: string; isLead: boolean }) => {
      const { error } = await supabase
        .from('client_onboarding_tasks')
        .update({
          is_lead_responsibility: isLead,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks', selectedClientId] });
    },
  });

  // Toggle applicable
  const toggleApplicableMutation = useMutation({
    mutationFn: async ({ taskId, applicable }: { taskId: string; applicable: boolean }) => {
      const updates: any = {
        is_applicable: applicable,
        updated_at: new Date().toISOString(),
      };
      if (!applicable) {
        updates.is_completed = false;
        updates.completed_at = null;
        updates.is_lead_responsibility = false;
      }
      const { error } = await supabase
        .from('client_onboarding_tasks')
        .update(updates)
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks', selectedClientId] });
    },
  });

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const applicableTasks = tasks.filter((t) => t.is_applicable);
  const completedCount = applicableTasks.filter((t) => t.is_completed).length;
  const progressPercent = applicableTasks.length > 0 ? (completedCount / applicableTasks.length) * 100 : 0;

  // Group tasks by platform
  const groupedTasks = tasks.reduce<Record<string, OnboardingTask[]>>((acc, task) => {
    const key = task.platform;
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});

  const platformOrder = ['geral', 'google_ads', 'meta_ads', 'site'];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardCheck className="w-7 h-7" />
          Onboarding de Clientes
        </h1>
        <p className="text-muted-foreground mt-1">
          Acompanhe o processo de onboarding e as tarefas pendentes de cada cliente
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
            Escolha um cliente para visualizar ou gerenciar o processo de onboarding
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
                  Nenhum cliente encontrado
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

      {/* Task List */}
      {selectedClientId && (
        <>
          {isLoadingTasks ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : tasks.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <ClipboardCheck className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma tarefa de onboarding</h3>
                <p className="text-muted-foreground max-w-md mb-4">
                  Este cliente ainda não possui tarefas de onboarding. Clique abaixo para iniciar o processo.
                </p>
                <Button onClick={() => initMutation.mutate(selectedClientId)} disabled={initMutation.isPending}>
                  {initMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Iniciar Onboarding
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Progress */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">
                    Progresso — {selectedClient?.lead?.company_name}
                  </CardTitle>
                  <CardDescription>
                    {completedCount} de {applicableTasks.length} tarefas concluídas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Progress value={progressPercent} className="h-3" />
                </CardContent>
              </Card>

              {/* Tasks grouped by platform */}
              {platformOrder.map((platform) => {
                const platformTasks = groupedTasks[platform];
                if (!platformTasks || platformTasks.length === 0) return null;

                return (
                  <Card key={platform}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-3">
                        <Badge variant="outline" className={PLATFORM_COLORS[platform]}>
                          {PLATFORM_LABELS[platform]}
                        </Badge>
                        <span className="text-sm font-normal text-muted-foreground">
                          {platformTasks.filter((t) => t.is_completed && t.is_applicable).length}/{platformTasks.filter((t) => t.is_applicable).length}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {platformTasks.map((task) => (
                        <div
                          key={task.id}
                          className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                            !task.is_applicable
                              ? 'bg-muted/20 opacity-50'
                              : task.is_completed
                              ? 'bg-muted/40'
                              : 'hover:bg-muted/30'
                          }`}
                        >
                          <Checkbox
                            checked={task.is_completed}
                            disabled={!task.is_applicable}
                            onCheckedChange={(checked) =>
                              toggleMutation.mutate({ taskId: task.id, completed: !!checked })
                            }
                          />
                          <span className={`flex-1 text-sm ${
                            !task.is_applicable
                              ? 'line-through text-muted-foreground'
                              : task.is_completed
                              ? 'line-through text-muted-foreground'
                              : ''
                          }`}>
                            {task.task_order} - {task.task_name}
                          </span>

                          {!task.is_applicable && (
                            <Badge variant="outline" className="text-xs gap-1 border-destructive/30 text-destructive">
                              <Ban className="w-3 h-3" />
                              N/A
                            </Badge>
                          )}

                          {task.is_applicable && task.is_lead_responsibility && (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <UserCheck className="w-3 h-3" />
                              Lead
                            </Badge>
                          )}

                          {task.is_applicable && (
                            <Button
                              variant={task.is_lead_responsibility ? 'secondary' : 'ghost'}
                              size="sm"
                              className="text-xs h-7"
                              onClick={() =>
                                toggleLeadMutation.mutate({
                                  taskId: task.id,
                                  isLead: !task.is_lead_responsibility,
                                })
                              }
                            >
                              {task.is_lead_responsibility ? 'Remover do Lead' : 'Atribuir ao Lead'}
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            className={`text-xs h-7 ${!task.is_applicable ? 'text-primary' : 'text-muted-foreground'}`}
                            onClick={() =>
                              toggleApplicableMutation.mutate({
                                taskId: task.id,
                                applicable: !task.is_applicable,
                              })
                            }
                          >
                            {task.is_applicable ? 'Não se aplica' : 'Reativar'}
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </>
      )}

      {/* Empty State */}
      {!selectedClientId && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardCheck className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Selecione um cliente</h3>
            <p className="text-muted-foreground max-w-md">
              Escolha um cliente para visualizar e gerenciar as tarefas de onboarding.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
