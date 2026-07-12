import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Archive,
  Brain,
  CalendarClock,
  CheckCircle2,
  Clock,
  Inbox,
  Pause,
  Play,
  Plus,
  Sparkles,
  Timer,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type DemandType = 'cliente' | 'comercial' | 'interna' | 'financeiro' | 'estudo' | 'outro';
type DemandPriority = 'critica' | 'alta' | 'media' | 'baixa';
type DemandDeadline = 'hoje' | 'amanha' | 'esta_semana' | 'data_personalizada' | 'sem_prazo';
type DemandImpact = 'faturamento' | 'cliente' | 'operacional' | 'financeiro' | 'reputacao' | 'estrategico';
type DemandStatus =
  | 'inbox'
  | 'classificada'
  | 'planejada'
  | 'em_execucao'
  | 'pausada'
  | 'aguardando'
  | 'concluida'
  | 'cancelada'
  | 'arquivada';

type Demand = {
  id: string;
  title: string;
  description: string;
  type: DemandType;
  clientName: string;
  priority: DemandPriority;
  estimatedMinutes: number;
  deadline: DemandDeadline;
  customDeadline: string;
  impact: DemandImpact;
  status: DemandStatus;
  generatesRevenue: boolean;
  clientNoticesToday: boolean;
  hasRealDeadline: boolean;
  lossRisk: boolean;
  affectsActiveClient: boolean;
  affectsRunningCampaign: boolean;
  quickWin: boolean;
  canRescheduleSafely: boolean;
  dependsOnExternalMaterial: boolean;
  requiresEvertonDecision: boolean;
  priorityScore: number;
  aiSuggestion: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

type DemandForm = Omit<Demand, 'id' | 'status' | 'priorityScore' | 'aiSuggestion' | 'createdAt' | 'updatedAt' | 'completedAt'>;

const STORAGE_KEY = 'fature-demand-center';

const defaultForm: DemandForm = {
  title: '',
  description: '',
  type: 'cliente',
  clientName: '',
  priority: 'media',
  estimatedMinutes: 30,
  deadline: 'hoje',
  customDeadline: '',
  impact: 'operacional',
  generatesRevenue: false,
  clientNoticesToday: false,
  hasRealDeadline: true,
  lossRisk: false,
  affectsActiveClient: false,
  affectsRunningCampaign: false,
  quickWin: true,
  canRescheduleSafely: false,
  dependsOnExternalMaterial: false,
  requiresEvertonDecision: false,
};

const typeLabels: Record<DemandType, string> = {
  cliente: 'Cliente',
  comercial: 'Comercial',
  interna: 'Interna',
  financeiro: 'Financeiro',
  estudo: 'Estudo',
  outro: 'Outro',
};

const priorityLabels: Record<DemandPriority, string> = {
  critica: 'Critica',
  alta: 'Alta',
  media: 'Media',
  baixa: 'Baixa',
};

const deadlineLabels: Record<DemandDeadline, string> = {
  hoje: 'Hoje',
  amanha: 'Amanha',
  esta_semana: 'Esta semana',
  data_personalizada: 'Data personalizada',
  sem_prazo: 'Sem prazo',
};

const impactLabels: Record<DemandImpact, string> = {
  faturamento: 'Faturamento',
  cliente: 'Cliente',
  operacional: 'Operacional',
  financeiro: 'Financeiro',
  reputacao: 'Reputacao',
  estrategico: 'Estrategico',
};

const statusLabels: Record<DemandStatus, string> = {
  inbox: 'Inbox',
  classificada: 'Classificada',
  planejada: 'Planejada',
  em_execucao: 'Em execucao',
  pausada: 'Pausada',
  aguardando: 'Aguardando',
  concluida: 'Concluida',
  cancelada: 'Cancelada',
  arquivada: 'Arquivada',
};

const seedDemands: Demand[] = [
  createDemand({
    ...defaultForm,
    title: 'Subir novo criativo',
    description: 'Cliente pediu uma nova arte para campanha ativa no Meta Ads.',
    type: 'cliente',
    clientName: 'Cliente ativo',
    priority: 'alta',
    impact: 'cliente',
    affectsActiveClient: true,
    affectsRunningCampaign: true,
    clientNoticesToday: true,
  }),
  createDemand({
    ...defaultForm,
    title: 'Revisar proposta comercial',
    description: 'Ajustar proposta antes do envio para oportunidade quente.',
    type: 'comercial',
    priority: 'alta',
    impact: 'faturamento',
    generatesRevenue: true,
    quickWin: false,
  }),
  createDemand({
    ...defaultForm,
    title: 'Organizar aula de Google Ads',
    description: 'Separar 30 minutos para continuar o estudo da semana.',
    type: 'estudo',
    priority: 'baixa',
    deadline: 'esta_semana',
    impact: 'estrategico',
    hasRealDeadline: false,
    canRescheduleSafely: true,
  }),
];

function createDemand(form: DemandForm): Demand {
  const now = new Date().toISOString();
  const demand = {
    ...form,
    id: createId(),
    status: form.priority === 'critica' || form.deadline === 'hoje' ? 'classificada' : 'inbox',
    priorityScore: 0,
    aiSuggestion: '',
    createdAt: now,
    updatedAt: now,
  } satisfies Demand;

  return {
    ...demand,
    priorityScore: calculatePriorityScore(demand),
    aiSuggestion: buildSuggestion(demand),
  };
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function calculatePriorityScore(demand: Pick<Demand, 'impact' | 'affectsActiveClient' | 'clientNoticesToday' | 'deadline' | 'priority' | 'affectsRunningCampaign' | 'lossRisk' | 'quickWin' | 'dependsOnExternalMaterial' | 'canRescheduleSafely'>) {
  let score = 0;

  if (demand.impact === 'faturamento') score += 30;
  if (demand.affectsActiveClient) score += 25;
  if (demand.clientNoticesToday) score += 20;
  if (demand.deadline === 'hoje') score += 20;
  if (demand.priority === 'critica') score += 20;
  if (demand.priority === 'alta') score += 12;
  if (demand.affectsRunningCampaign) score += 15;
  if (demand.lossRisk) score += 20;
  if (demand.quickWin) score += 10;
  if (demand.dependsOnExternalMaterial) score -= 10;
  if (demand.canRescheduleSafely) score -= 20;
  if (demand.deadline === 'sem_prazo') score -= 10;

  return Math.max(score, 0);
}

function buildSuggestion(demand: Pick<Demand, 'title' | 'impact' | 'deadline' | 'affectsActiveClient' | 'clientNoticesToday' | 'priorityScore'>) {
  if (demand.priorityScore >= 70) {
    return `Execute "${demand.title}" agora. Ela combina impacto em ${impactLabels[demand.impact].toLowerCase()} com prioridade real para hoje.`;
  }

  if (demand.affectsActiveClient || demand.clientNoticesToday) {
    return `Priorize "${demand.title}" ainda hoje para preservar a percepcao do cliente.`;
  }

  if (demand.deadline === 'sem_prazo') {
    return `Mantenha "${demand.title}" na Inbox ate existir um contexto melhor de execucao.`;
  }

  return `Planeje "${demand.title}" conforme a fila do dia, sem tratar como atraso.`;
}

function suggestForm(form: DemandForm): DemandForm {
  const text = `${form.title} ${form.description}`.toLowerCase();
  const next = { ...form };

  if (text.includes('criativo') || text.includes('arte') || text.includes('post')) {
    next.type = 'cliente';
    next.priority = 'alta';
    next.estimatedMinutes = 30;
    next.impact = 'cliente';
    next.clientNoticesToday = true;
    next.affectsActiveClient = true;
  }

  if (text.includes('campanha') || text.includes('anuncio') || text.includes('meta') || text.includes('google')) {
    next.priority = text.includes('parada') || text.includes('bloqueada') ? 'critica' : 'alta';
    next.impact = 'operacional';
    next.affectsRunningCampaign = true;
    next.hasRealDeadline = true;
  }

  if (text.includes('pagamento') || text.includes('boleto') || text.includes('nota')) {
    next.type = 'financeiro';
    next.impact = 'financeiro';
  }

  if (text.includes('proposta') || text.includes('reuniao') || text.includes('fechar')) {
    next.type = 'comercial';
    next.impact = 'faturamento';
    next.generatesRevenue = true;
    next.priority = 'alta';
  }

  if (text.includes('curso') || text.includes('aula') || text.includes('estudo')) {
    next.type = 'estudo';
    next.impact = 'estrategico';
    next.priority = 'baixa';
    next.deadline = 'esta_semana';
    next.canRescheduleSafely = true;
  }

  next.quickWin = next.estimatedMinutes <= 30;
  return next;
}

export default function DemandCenter() {
  const [demands, setDemands] = useState<Demand[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<DemandForm>(defaultForm);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setDemands(stored ? JSON.parse(stored) : seedDemands);
  }, []);

  useEffect(() => {
    if (demands.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(demands));
    }
  }, [demands]);

  const activeDemands = useMemo(
    () => demands.filter((demand) => !['concluida', 'cancelada', 'arquivada'].includes(demand.status)),
    [demands],
  );

  const todayDemands = useMemo(
    () =>
      demands
        .filter((demand) => ['hoje', 'amanha'].includes(demand.deadline) && !['concluida', 'cancelada', 'arquivada'].includes(demand.status))
        .sort((a, b) => b.priorityScore - a.priorityScore),
    [demands],
  );

  const criticalDemands = useMemo(
    () =>
      demands
        .filter(
          (demand) =>
            demand.priority === 'critica' ||
            demand.priorityScore >= 65 ||
            demand.clientNoticesToday ||
            demand.lossRisk,
        )
        .filter((demand) => !['concluida', 'cancelada', 'arquivada'].includes(demand.status))
        .sort((a, b) => b.priorityScore - a.priorityScore),
    [demands],
  );

  const nextBestDemand = todayDemands[0] || activeDemands.sort((a, b) => b.priorityScore - a.priorityScore)[0];
  const todayMinutes = todayDemands.reduce((total, demand) => total + demand.estimatedMinutes, 0);
  const completedThisWeek = demands.filter((demand) => demand.status === 'concluida').length;

  const saveDemand = () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Informe titulo e descricao da demanda.');
      return;
    }

    const demand = createDemand({
      ...form,
      quickWin: form.estimatedMinutes <= 30,
    });

    setDemands((current) => [demand, ...current]);
    setForm(defaultForm);
    setOpen(false);
    toast.success('Demanda criada e priorizada.');
  };

  const updateDemandStatus = (id: string, status: DemandStatus) => {
    setDemands((current) =>
      current.map((demand) =>
        demand.id === id
          ? {
              ...demand,
              status,
              completedAt: status === 'concluida' ? new Date().toISOString() : demand.completedAt,
              updatedAt: new Date().toISOString(),
            }
          : demand,
      ),
    );
  };

  const filtered = {
    inbox: demands.filter((demand) => demand.status === 'inbox' || demand.status === 'classificada'),
    hoje: todayDemands,
    criticas: criticalDemands,
    agendadas: demands.filter((demand) => ['planejada'].includes(demand.status) || ['amanha', 'esta_semana', 'data_personalizada'].includes(demand.deadline)),
    aguardando: demands.filter((demand) => demand.status === 'aguardando'),
    concluidas: demands.filter((demand) => ['concluida', 'cancelada', 'arquivada'].includes(demand.status)),
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-warning">
            <Inbox className="w-4 h-4" />
            Modo Fluxo
          </div>
          <h1 className="text-2xl font-bold">Central de Demandas</h1>
          <p className="text-muted-foreground">
            Tudo que surge no dia entra aqui primeiro, separado do comercial, financeiro e WhatsApp.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Demanda
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <MetricCard title="Inbox" value={filtered.inbox.length} icon={Inbox} />
        <MetricCard title="Hoje" value={todayDemands.length} icon={CalendarClock} />
        <MetricCard title="Criticas" value={criticalDemands.length} icon={AlertTriangle} tone="danger" />
        <MetricCard title="Tempo hoje" value={`${Math.round(todayMinutes / 60)}h${todayMinutes % 60 ? ` ${todayMinutes % 60}m` : ''}`} icon={Timer} />
        <MetricCard title="Aguardando" value={filtered.aguardando.length} icon={Clock} />
        <MetricCard title="Concluidas" value={completedThisWeek} icon={CheckCircle2} tone="success" />
      </div>

      <Card className="border-warning/30 bg-warning/5 shadow-sm">
        <CardContent className="p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles className="w-5 h-5 text-warning" />
              Proxima melhor acao
            </div>
            <p className="text-sm text-muted-foreground">
              {nextBestDemand
                ? nextBestDemand.aiSuggestion
                : 'Nenhuma demanda ativa agora. Use este espaco para capturar a proxima solicitacao.'}
            </p>
          </div>
          {nextBestDemand && (
            <Button onClick={() => updateDemandStatus(nextBestDemand.id, 'em_execucao')} className="gap-2">
              <Play className="w-4 h-4" />
              Executar agora
            </Button>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="inbox" className="space-y-4">
        <TabsList className="h-auto w-full justify-start overflow-x-auto p-1">
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="criticas">Criticas</TabsTrigger>
          <TabsTrigger value="agendadas">Agendadas</TabsTrigger>
          <TabsTrigger value="aguardando">Aguardando</TabsTrigger>
          <TabsTrigger value="concluidas">Concluidas</TabsTrigger>
          <TabsTrigger value="ia">Analise IA</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox">
          <DemandGrid demands={filtered.inbox} onStatusChange={updateDemandStatus} empty="Nenhuma demanda na Inbox." />
        </TabsContent>
        <TabsContent value="hoje">
          <DemandGrid demands={filtered.hoje} onStatusChange={updateDemandStatus} empty="Nenhuma demanda priorizada para hoje." />
        </TabsContent>
        <TabsContent value="criticas">
          <DemandGrid demands={filtered.criticas} onStatusChange={updateDemandStatus} empty="Nenhuma demanda critica ativa." />
        </TabsContent>
        <TabsContent value="agendadas">
          <DemandGrid demands={filtered.agendadas} onStatusChange={updateDemandStatus} empty="Nenhuma demanda agendada." />
        </TabsContent>
        <TabsContent value="aguardando">
          <DemandGrid demands={filtered.aguardando} onStatusChange={updateDemandStatus} empty="Nada aguardando terceiros." />
        </TabsContent>
        <TabsContent value="concluidas">
          <DemandGrid demands={filtered.concluidas} onStatusChange={updateDemandStatus} empty="Nenhuma demanda concluida ainda." />
        </TabsContent>
        <TabsContent value="ia">
          <AiAnalysis demands={demands} />
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nova Demanda</DialogTitle>
            <DialogDescription>
              Registre rapido, confirme a classificacao e deixe o sistema ordenar a execucao.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Titulo">
              <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Subir novo criativo" />
            </Field>
            <Field label="Cliente">
              <Input value={form.clientName} onChange={(event) => setForm({ ...form, clientName: event.target.value })} placeholder="Opcional" />
            </Field>
            <Field label="Tipo">
              <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value as DemandType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Prioridade">
              <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value as DemandPriority })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tempo estimado">
              <Select value={String(form.estimatedMinutes)} onValueChange={(value) => setForm({ ...form, estimatedMinutes: Number(value), quickWin: Number(value) <= 30 })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 20, 30, 60, 120, 240].map((minutes) => (
                    <SelectItem key={minutes} value={String(minutes)}>{minutes < 60 ? `${minutes} minutos` : `${minutes / 60} hora${minutes > 60 ? 's' : ''}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Prazo">
              <Select value={form.deadline} onValueChange={(value) => setForm({ ...form, deadline: value as DemandDeadline })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(deadlineLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Impacto principal">
              <Select value={form.impact} onValueChange={(value) => setForm({ ...form, impact: value as DemandImpact })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(impactLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            {form.deadline === 'data_personalizada' && (
              <Field label="Data personalizada">
                <Input type="date" value={form.customDeadline} onChange={(event) => setForm({ ...form, customDeadline: event.target.value })} />
              </Field>
            )}
            <div className="md:col-span-2">
              <Field label="Descricao">
                <Textarea
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Cliente pediu alteracao de criativo."
                  rows={4}
                />
              </Field>
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div>
              <h3 className="font-semibold">Criterios de decisao</h3>
              <p className="text-sm text-muted-foreground">Essas respostas ajudam a calcular a melhor ordem do dia.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <DecisionSwitch label="Gera faturamento?" checked={form.generatesRevenue} onCheckedChange={(value) => setForm({ ...form, generatesRevenue: value, impact: value ? 'faturamento' : form.impact })} />
              <DecisionSwitch label="Cliente percebe hoje?" checked={form.clientNoticesToday} onCheckedChange={(value) => setForm({ ...form, clientNoticesToday: value })} />
              <DecisionSwitch label="Existe prazo real?" checked={form.hasRealDeadline} onCheckedChange={(value) => setForm({ ...form, hasRealDeadline: value })} />
              <DecisionSwitch label="Existe risco de perda?" checked={form.lossRisk} onCheckedChange={(value) => setForm({ ...form, lossRisk: value })} />
              <DecisionSwitch label="Afeta cliente ativo?" checked={form.affectsActiveClient} onCheckedChange={(value) => setForm({ ...form, affectsActiveClient: value })} />
              <DecisionSwitch label="Afeta campanha rodando?" checked={form.affectsRunningCampaign} onCheckedChange={(value) => setForm({ ...form, affectsRunningCampaign: value })} />
              <DecisionSwitch label="Leva ate 30 minutos?" checked={form.quickWin} onCheckedChange={(value) => setForm({ ...form, quickWin: value })} />
              <DecisionSwitch label="Pode reagendar sem prejuizo?" checked={form.canRescheduleSafely} onCheckedChange={(value) => setForm({ ...form, canRescheduleSafely: value })} />
              <DecisionSwitch label="Depende de material externo?" checked={form.dependsOnExternalMaterial} onCheckedChange={(value) => setForm({ ...form, dependsOnExternalMaterial: value })} />
              <DecisionSwitch label="Requer decisao do Everton?" checked={form.requiresEvertonDecision} onCheckedChange={(value) => setForm({ ...form, requiresEvertonDecision: value })} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => {
                setForm(suggestForm(form));
                toast.success('Sugestao gerada. Confirme ou ajuste antes de salvar.');
              }}
            >
              <Brain className="w-4 h-4" />
              Sugerir com IA
            </Button>
            <Button type="button" onClick={saveDemand}>Salvar demanda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, tone = 'default' }: { title: string; value: number | string; icon: any; tone?: 'default' | 'danger' | 'success' }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            tone === 'danger' && 'bg-destructive/10 text-destructive',
            tone === 'success' && 'bg-success/10 text-success',
            tone === 'default' && 'bg-primary/10 text-primary',
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function DemandGrid({ demands, onStatusChange, empty }: { demands: Demand[]; onStatusChange: (id: string, status: DemandStatus) => void; empty: string }) {
  if (demands.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">{empty}</CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {demands.map((demand) => (
        <DemandCard key={demand.id} demand={demand} onStatusChange={onStatusChange} />
      ))}
    </div>
  );
}

function DemandCard({ demand, onStatusChange }: { demand: Demand; onStatusChange: (id: string, status: DemandStatus) => void }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{demand.title}</CardTitle>
            {demand.clientName && <p className="text-sm text-muted-foreground">{demand.clientName}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Score</p>
            <p className="text-xl font-bold text-warning">{demand.priorityScore}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{typeLabels[demand.type]}</Badge>
          <Badge className={priorityClass(demand.priority)}>{priorityLabels[demand.priority]}</Badge>
          <Badge variant="secondary">{impactLabels[demand.impact]}</Badge>
          <Badge variant="outline">{statusLabels[demand.status]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{demand.description}</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Prazo" value={deadlineLabels[demand.deadline]} />
          <Info label="Tempo" value={`${demand.estimatedMinutes} min`} />
        </div>
        <div className="rounded-lg bg-muted/60 p-3 text-sm">{demand.aiSuggestion}</div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onStatusChange(demand.id, 'em_execucao')} className="gap-1">
            <Play className="w-4 h-4" />
            Executar
          </Button>
          <Button size="sm" variant="outline" onClick={() => onStatusChange(demand.id, 'pausada')} className="gap-1">
            <Pause className="w-4 h-4" />
            Pausar
          </Button>
          <Button size="sm" variant="outline" onClick={() => onStatusChange(demand.id, 'aguardando')} className="gap-1">
            <Clock className="w-4 h-4" />
            Aguardar
          </Button>
          <Button size="sm" variant="outline" onClick={() => onStatusChange(demand.id, 'planejada')} className="gap-1">
            <CalendarClock className="w-4 h-4" />
            Agendar
          </Button>
          <Button size="sm" variant="outline" onClick={() => onStatusChange(demand.id, 'concluida')} className="gap-1">
            <CheckCircle2 className="w-4 h-4" />
            Concluir
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onStatusChange(demand.id, 'arquivada')} className="gap-1">
            <Archive className="w-4 h-4" />
            Arquivar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AiAnalysis({ demands }: { demands: Demand[] }) {
  const active = demands.filter((demand) => !['concluida', 'cancelada', 'arquivada'].includes(demand.status));
  const revenue = active.filter((demand) => demand.impact === 'faturamento' || demand.generatesRevenue);
  const client = active.filter((demand) => demand.affectsActiveClient || demand.clientNoticesToday);
  const totalMinutes = active.reduce((total, demand) => total + demand.estimatedMinutes, 0);
  const highScore = [...active].sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 3);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Recomendada para agora
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {highScore.map((demand) => (
            <div key={demand.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{demand.title}</p>
                <Badge className="bg-warning text-warning-foreground">{demand.priorityScore}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{demand.aiSuggestion}</p>
            </div>
          ))}
          {highScore.length === 0 && <p className="text-sm text-muted-foreground">Sem demandas ativas para analisar.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Leitura do fluxo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Info label="Demandas ativas" value={String(active.length)} />
          <Info label="Impactam faturamento" value={String(revenue.length)} />
          <Info label="Afetam cliente" value={String(client.length)} />
          <Info label="Tempo estimado" value={`${Math.round(totalMinutes / 60)}h ${totalMinutes % 60}m`} />
          <div className="rounded-lg bg-muted/60 p-3 text-muted-foreground">
            O sistema esta priorizando faturamento, cliente ativo e prazo real. Itens reagendaveis ficam sem culpa na fila.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function DecisionSwitch({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function priorityClass(priority: DemandPriority) {
  if (priority === 'critica') return 'bg-destructive text-destructive-foreground';
  if (priority === 'alta') return 'bg-orange-500 text-white';
  if (priority === 'media') return 'bg-warning text-warning-foreground';
  return 'bg-muted text-muted-foreground';
}
