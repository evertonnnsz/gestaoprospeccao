import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  KanbanSquare,
  List,
  ListChecks,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Repeat,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  ActivityItem,
  ActivityKind,
  ActivityPriority,
  ActivityStatus,
  KIND_LABELS,
  PRIORITY_LABELS,
  RECURRENCE_LABELS,
  ActivityRecurrence,
  STATUS_LABELS,
  useDailyActivities,
} from '@/hooks/useDailyActivities';
import { KIND_STYLES, PRIORITY_STYLES, STATUS_STYLES } from '@/components/activities/activityStyles';

const STATUS_ORDER: ActivityStatus[] = ['a_fazer', 'em_andamento', 'concluida'];

const KIND_FILTERS: ActivityKind[] = ['follow_up_atrasado', 'follow_up', 'agenda', 'contrato', 'pagamento', 'onboarding', 'manual'];

export default function DailyActivities() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [date, setDate] = useState(() => new Date());
  const { items, loading, tableMissing, setStatus, createTask, updatePriority, deleteTask } = useDailyActivities(date);

  const [view, setView] = useState<'list' | 'board'>('list');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<ActivityKind | null>(null);
  const [collapsed, setCollapsed] = useState<Record<ActivityStatus, boolean>>({
    a_fazer: false,
    em_andamento: false,
    concluida: false,
  });
  const [quickAdd, setQuickAdd] = useState('');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    notes: '',
    priority: 'normal' as ActivityPriority,
    date: '',
    recurrence: 'nenhuma' as ActivityRecurrence,
  });
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<ActivityStatus | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter(
      (item) =>
        (!kindFilter || item.kind === kindFilter) &&
        (!term || `${item.title} ${item.subtitle || ''}`.toLowerCase().includes(term)),
    );
  }, [items, kindFilter, search]);

  const grouped = useMemo(() => {
    const groups: Record<ActivityStatus, ActivityItem[]> = { a_fazer: [], em_andamento: [], concluida: [] };
    filtered.forEach((item) => groups[item.status].push(item));
    return groups;
  }, [filtered]);

  const doneCount = items.filter((i) => i.status === 'concluida').length;
  const progress = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

  const pendingByKind = useMemo(() => {
    const counts = {} as Record<ActivityKind, number>;
    KIND_FILTERS.forEach((k) => (counts[k] = 0));
    items.forEach((i) => {
      if (i.status !== 'concluida') counts[i.kind] += 1;
    });
    return counts;
  }, [items]);

  const guard = async (action: () => Promise<void>, success?: string) => {
    try {
      await action();
      if (success) toast({ title: success });
    } catch (error: any) {
      toast({
        title: 'Não foi possível salvar',
        description: tableMissing
          ? 'A tabela de atividades ainda não foi criada no banco. Aplique a migration no Lovable.'
          : error?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const toggleDone = (item: ActivityItem) =>
    guard(() => setStatus(item, item.status === 'concluida' ? 'a_fazer' : 'concluida'));

  const submitQuickAdd = () => {
    const title = quickAdd.trim();
    if (!title) {
      setQuickAddOpen(false);
      return;
    }
    guard(async () => {
      await createTask({ title });
      setQuickAdd('');
    });
  };

  const submitNewTask = () => {
    if (!newTask.title.trim()) return;
    guard(async () => {
      await createTask({
        title: newTask.title.trim(),
        notes: newTask.notes.trim(),
        priority: newTask.priority,
        date: newTask.date || undefined,
        recurrence: newTask.recurrence,
      });
      setNewTaskOpen(false);
      setNewTask({ title: '', notes: '', priority: 'normal', date: '', recurrence: 'nenhuma' });
    }, 'Tarefa criada');
  };

  const openNewTask = () => {
    setNewTask({ title: '', notes: '', priority: 'normal', date: format(date, 'yyyy-MM-dd'), recurrence: 'nenhuma' });
    setNewTaskOpen(true);
  };

  const rowActions = (item: ActivityItem) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Mais ações">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Mover para</DropdownMenuLabel>
        {STATUS_ORDER.filter((s) => s !== item.status && !(item.kind === 'agenda' && s === 'em_andamento')).map((s) => (
          <DropdownMenuItem key={s} onClick={() => guard(() => setStatus(item, s))}>
            <span className={cn('w-2.5 h-2.5 rounded-full mr-2', STATUS_STYLES[s].pill.split(' ')[0])} />
            {STATUS_LABELS[s]}
          </DropdownMenuItem>
        ))}
        {item.kind === 'manual' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Prioridade</DropdownMenuLabel>
            {(Object.keys(PRIORITY_LABELS) as ActivityPriority[]).map((p) => (
              <DropdownMenuItem key={p} onClick={() => guard(() => updatePriority(item, p))}>
                <Flag className={cn('w-3.5 h-3.5 mr-2', PRIORITY_STYLES[p])} />
                {PRIORITY_LABELS[p]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => guard(() => deleteTask(item), 'Tarefa excluída')}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {item.recurrence ? 'Excluir tarefa e repetições' : 'Excluir tarefa'}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const quickLinks = (item: ActivityItem) => (
    <>
      {item.whatsappUrl && (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-success" asChild aria-label="Abrir WhatsApp">
          <a href={item.whatsappUrl} target="_blank" rel="noreferrer">
            <MessageCircle className="w-4 h-4" />
          </a>
        </Button>
      )}
      {item.path && (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(item.path!)} aria-label="Abrir">
          <ArrowUpRight className="w-4 h-4" />
        </Button>
      )}
    </>
  );

  return (
    <div className="p-6 space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ListChecks className="w-6 h-6 text-primary" />
            Atividades do Dia
          </h1>
          <p className="text-sm text-muted-foreground first-letter:uppercase">
            {format(date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setDate((d) => addDays(d, -1))} aria-label="Dia anterior">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant={isToday(date) ? 'secondary' : 'outline'} onClick={() => setDate(new Date())}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={() => setDate((d) => addDays(d, 1))} aria-label="Próximo dia">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button className="gap-2 ml-2" onClick={openNewTask} disabled={tableMissing}>
            <Plus className="w-4 h-4" />
            Nova tarefa
          </Button>
        </div>
      </div>

      {tableMissing && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="pt-6 text-sm flex gap-3">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
            <div>
              <p className="font-medium">Falta criar a tabela de atividades no banco.</p>
              <p className="text-muted-foreground">
                As atividades automáticas já aparecem abaixo, mas para dar check e criar tarefas é preciso aplicar a
                migration <code className="text-xs">daily_tasks</code> no Lovable.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progresso + filtros por tipo */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Progresso do dia</p>
              <p className="text-xl font-semibold">
                {doneCount} de {items.length} concluídas
                <span className="text-sm font-normal text-muted-foreground ml-2">{progress}%</span>
              </p>
            </div>
            {items.length > 0 && doneCount === items.length && (
              <span className="text-sm font-medium text-success">Tudo concluído por hoje! 🎉</span>
            )}
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex flex-wrap gap-2">
            {KIND_FILTERS.filter((k) => items.some((i) => i.kind === k)).map((kind) => {
              const Icon = KIND_STYLES[kind].icon;
              const active = kindFilter === kind;
              return (
                <button
                  key={kind}
                  onClick={() => setKindFilter(active ? null : kind)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all border',
                    KIND_STYLES[kind].badge,
                    active ? 'border-current ring-2 ring-current/20' : 'border-transparent hover:border-current/30',
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {KIND_LABELS[kind]}
                  <span className="rounded-full bg-background/70 px-1.5">{pendingByKind[kind]}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Barra de visualização */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b">
        <div className="flex gap-1">
          {[
            { id: 'list' as const, label: 'Lista', icon: List },
            { id: 'board' as const, label: 'Quadro', icon: KanbanSquare },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                view === tab.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative pb-2">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar atividade..."
            className="pl-8 h-9 w-[220px]"
          />
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Montando sua lista do dia...
        </div>
      ) : view === 'list' ? (
        <div className="space-y-6">
          {STATUS_ORDER.map((status) => {
            const group = grouped[status];
            const StatusIcon = STATUS_STYLES[status].icon;
            if (status === 'em_andamento' && group.length === 0) return null;
            return (
              <section key={status}>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setCollapsed((c) => ({ ...c, [status]: !c[status] }))}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={collapsed[status] ? 'Expandir grupo' : 'Recolher grupo'}
                  >
                    {collapsed[status] ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <span
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide',
                      STATUS_STYLES[status].pill,
                    )}
                  >
                    <StatusIcon className="w-3.5 h-3.5" />
                    {STATUS_LABELS[status]}
                  </span>
                  <span className="text-sm text-muted-foreground">{group.length}</span>
                </div>

                {!collapsed[status] && (
                  <div className="rounded-lg border bg-card">
                    <div className="hidden md:grid grid-cols-[1fr_170px_110px_110px] gap-3 px-4 py-2 text-xs text-muted-foreground border-b">
                      <span className="pl-8">Nome</span>
                      <span>Tipo</span>
                      <span>Prioridade</span>
                      <span className="text-right">Ações</span>
                    </div>
                    {group.length === 0 && (
                      <p className="px-4 py-3 text-sm text-muted-foreground">
                        {status === 'concluida' ? 'Nada concluído ainda.' : 'Nenhuma atividade pendente. 🙌'}
                      </p>
                    )}
                    {group.map((item) => {
                      const KindIcon = KIND_STYLES[item.kind].icon;
                      const ItemStatusIcon = STATUS_STYLES[item.status].icon;
                      const done = item.status === 'concluida';
                      return (
                        <div
                          key={item.key}
                          className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_170px_110px_110px] gap-3 items-center px-4 py-2.5 border-b last:border-b-0 hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              onClick={() => toggleDone(item)}
                              className={cn(
                                'shrink-0 transition-colors',
                                done ? 'text-success' : item.status === 'em_andamento' ? 'text-primary' : 'text-muted-foreground hover:text-success',
                              )}
                              aria-label={done ? 'Desmarcar como concluída' : 'Marcar como concluída'}
                            >
                              <ItemStatusIcon className="w-5 h-5" />
                            </button>
                            <div className="min-w-0">
                              <p className={cn('text-sm font-medium truncate', done && 'line-through text-muted-foreground')}>
                                {item.time && <span className="text-primary mr-1.5">{item.time}</span>}
                                {item.recurrence && (
                                  <Repeat className="inline w-3.5 h-3.5 mr-1 text-muted-foreground" aria-label={RECURRENCE_LABELS[item.recurrence]} />
                                )}
                                {item.title}
                              </p>
                              {item.subtitle && <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>}
                            </div>
                          </div>
                          <span
                            className={cn(
                              'hidden md:inline-flex items-center gap-1.5 w-fit rounded-md px-2 py-0.5 text-xs font-medium',
                              KIND_STYLES[item.kind].badge,
                            )}
                          >
                            <KindIcon className="w-3.5 h-3.5" />
                            {KIND_LABELS[item.kind]}
                          </span>
                          <span className="hidden md:flex items-center gap-1.5 text-sm">
                            <Flag className={cn('w-4 h-4', PRIORITY_STYLES[item.priority])} />
                            {PRIORITY_LABELS[item.priority]}
                          </span>
                          <div className="flex items-center justify-end">
                            {quickLinks(item)}
                            {rowActions(item)}
                          </div>
                        </div>
                      );
                    })}

                    {status === 'a_fazer' && !tableMissing && (
                      <div className="px-4 py-2 border-t">
                        {quickAddOpen ? (
                          <Input
                            autoFocus
                            value={quickAdd}
                            onChange={(e) => setQuickAdd(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') submitQuickAdd();
                              if (e.key === 'Escape') setQuickAddOpen(false);
                            }}
                            onBlur={submitQuickAdd}
                            placeholder="Nome da tarefa e Enter para salvar"
                            className="h-8"
                          />
                        ) : (
                          <button
                            onClick={() => setQuickAddOpen(true)}
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                          >
                            <Plus className="w-4 h-4" />
                            Adicionar tarefa
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {STATUS_ORDER.map((status) => {
            const StatusIcon = STATUS_STYLES[status].icon;
            return (
              <div
                key={status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(status);
                }}
                onDragLeave={() => setDragOver((current) => (current === status ? null : current))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  const item = items.find((i) => i.key === dragKey);
                  setDragKey(null);
                  if (!item || item.status === status) return;
                  // A agenda só tem "a fazer" e "concluído".
                  if (item.kind === 'agenda' && status === 'em_andamento') return;
                  guard(() => setStatus(item, status));
                }}
                className={cn(
                  'rounded-lg bg-muted/40 p-3 space-y-3 min-h-[200px] transition-colors',
                  dragOver === status && 'bg-primary/10 ring-2 ring-primary/30',
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide',
                      STATUS_STYLES[status].pill,
                    )}
                  >
                    <StatusIcon className="w-3.5 h-3.5" />
                    {STATUS_LABELS[status]}
                  </span>
                  <span className="text-sm text-muted-foreground">{grouped[status].length}</span>
                </div>
                {grouped[status].map((item) => {
                  const KindIcon = KIND_STYLES[item.kind].icon;
                  return (
                    <div
                      key={item.key}
                      draggable
                      onDragStart={(e) => {
                        setDragKey(item.key);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => {
                        setDragKey(null);
                        setDragOver(null);
                      }}
                      className={cn(
                        'rounded-lg border bg-card p-3 space-y-2 shadow-sm cursor-grab active:cursor-grabbing',
                        dragKey === item.key && 'opacity-50',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium',
                            KIND_STYLES[item.kind].badge,
                          )}
                        >
                          <KindIcon className="w-3 h-3" />
                          {KIND_LABELS[item.kind]}
                        </span>
                        {rowActions(item)}
                      </div>
                      <p className={cn('text-sm font-medium', item.status === 'concluida' && 'line-through text-muted-foreground')}>
                        {item.time && <span className="text-primary mr-1.5">{item.time}</span>}
                                {item.recurrence && (
                                  <Repeat className="inline w-3.5 h-3.5 mr-1 text-muted-foreground" aria-label={RECURRENCE_LABELS[item.recurrence]} />
                                )}
                        {item.title}
                      </p>
                      {item.subtitle && <p className="text-xs text-muted-foreground">{item.subtitle}</p>}
                      <div className="flex items-center justify-between pt-1">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Flag className={cn('w-3.5 h-3.5', PRIORITY_STYLES[item.priority])} />
                          {PRIORITY_LABELS[item.priority]}
                        </span>
                        <div className="flex items-center">
                          {quickLinks(item)}
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn('h-8 w-8', item.status === 'concluida' ? 'text-success' : 'text-muted-foreground')}
                            onClick={() => toggleDone(item)}
                            aria-label="Alternar concluída"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Tarefa</Label>
              <Input
                id="task-title"
                autoFocus
                value={newTask.title}
                onChange={(e) => setNewTask((t) => ({ ...t, title: e.target.value }))}
                placeholder="Ex.: Gravar criativos da Pizzaria"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select
                  value={newTask.priority}
                  onValueChange={(value) => setNewTask((t) => ({ ...t, priority: value as ActivityPriority }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PRIORITY_LABELS) as ActivityPriority[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-2">
                          <Flag className={cn('w-3.5 h-3.5', PRIORITY_STYLES[p])} />
                          {PRIORITY_LABELS[p]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-date">{newTask.recurrence === 'nenhuma' ? 'Data' : 'Começa em'}</Label>
                <Input
                  id="task-date"
                  type="date"
                  value={newTask.date}
                  onChange={(e) => setNewTask((t) => ({ ...t, date: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Repetir</Label>
              <Select
                value={newTask.recurrence}
                onValueChange={(value) => setNewTask((t) => ({ ...t, recurrence: value as ActivityRecurrence }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(RECURRENCE_LABELS) as ActivityRecurrence[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {RECURRENCE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-notes">Observações</Label>
              <Textarea
                id="task-notes"
                value={newTask.notes}
                onChange={(e) => setNewTask((t) => ({ ...t, notes: e.target.value }))}
                placeholder="Detalhes opcionais"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTaskOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submitNewTask} disabled={!newTask.title.trim()}>
              Criar tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
