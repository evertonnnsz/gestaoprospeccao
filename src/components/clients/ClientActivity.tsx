import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Flag,
  Loader2,
  MessageSquare,
  Send,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// client_comments e daily_tasks ainda não estão nos tipos gerados do Supabase.
const db = supabase as any;

type ActivityEntry = {
  id: string;
  at: string;
  kind: 'comentario' | 'tarefa' | 'agenda' | 'onboarding' | 'marco';
  title: string;
  detail?: string;
  commentId?: string;
};

const KIND_STYLE: Record<ActivityEntry['kind'], { icon: typeof MessageSquare; tone: string }> = {
  comentario: { icon: MessageSquare, tone: 'bg-primary/10 text-primary' },
  tarefa: { icon: CheckCircle2, tone: 'bg-emerald-500/10 text-emerald-600' },
  agenda: { icon: CalendarDays, tone: 'bg-violet-500/10 text-violet-600' },
  onboarding: { icon: ClipboardCheck, tone: 'bg-sky-500/10 text-sky-600' },
  marco: { icon: Flag, tone: 'bg-amber-500/10 text-amber-600' },
};

const formatWhen = (value: string) => {
  // Datas sem horário (yyyy-MM-dd) não devem mostrar 00:00.
  const dateOnly = value.length <= 10;
  return format(new Date(dateOnly ? `${value}T12:00:00` : value), dateOnly ? 'dd/MM/yyyy' : "dd/MM/yyyy 'às' HH:mm", {
    locale: ptBR,
  });
};

export function ClientActivity({
  clientId,
  createdAt,
  projectStartDate,
}: {
  clientId: string;
  createdAt: string;
  projectStartDate: string | null;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [commentsAvailable, setCommentsAvailable] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [commentsRes, tasksRes, agendaRes, onboardingRes] = await Promise.all([
      db.from('client_comments').select('id, body, created_at').eq('client_id', clientId),
      db
        .from('daily_tasks')
        .select('id, title, completed_at, source_type')
        .eq('client_id', clientId)
        .eq('status', 'concluida'),
      supabase
        .from('agenda_events')
        .select('id, title, scheduled_date, scheduled_time, status')
        .eq('client_id', clientId)
        .neq('status', 'cancelled'),
      supabase
        .from('client_onboarding_tasks')
        .select('id, task_name, completed_at')
        .eq('client_id', clientId)
        .eq('is_completed', true),
    ]);

    setCommentsAvailable(!commentsRes.error);

    const list: ActivityEntry[] = [
      { id: 'created', at: createdAt, kind: 'marco', title: 'Cliente cadastrado no CRM' },
      ...(projectStartDate
        ? [{ id: 'start', at: projectStartDate, kind: 'marco' as const, title: 'Início do projeto' }]
        : []),
      ...((commentsRes.data || []) as { id: string; body: string; created_at: string }[]).map((c) => ({
        id: `c-${c.id}`,
        commentId: c.id,
        at: c.created_at,
        kind: 'comentario' as const,
        title: 'Você comentou',
        detail: c.body,
      })),
      ...((tasksRes.data || []) as { id: string; title: string; completed_at: string | null }[])
        .filter((t) => t.completed_at)
        .map((t) => ({
          id: `t-${t.id}`,
          at: t.completed_at!,
          kind: 'tarefa' as const,
          title: 'Atividade concluída',
          detail: t.title,
        })),
      ...(agendaRes.data || []).map((e) => ({
        id: `a-${e.id}`,
        at: `${e.scheduled_date}T${e.scheduled_time || '12:00:00'}`,
        kind: 'agenda' as const,
        title: e.status === 'completed' ? 'Compromisso realizado' : 'Compromisso agendado',
        detail: e.title,
      })),
      ...(onboardingRes.data || [])
        .filter((t) => t.completed_at)
        .map((t) => ({
          id: `o-${t.id}`,
          at: t.completed_at!,
          kind: 'onboarding' as const,
          title: 'Etapa de onboarding concluída',
          detail: t.task_name,
        })),
    ];

    setEntries(list);
    setLoading(false);
  }, [clientId, createdAt, projectStartDate]);

  useEffect(() => {
    load();
  }, [load]);

  const sorted = useMemo(
    () => [...entries].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [entries],
  );

  const sendComment = async () => {
    const body = comment.trim();
    if (!body || !user) return;
    setSending(true);
    const { error } = await db.from('client_comments').insert({ client_id: clientId, user_id: user.id, body });
    setSending(false);
    if (error) {
      toast({ title: 'Não foi possível comentar', description: error.message, variant: 'destructive' });
      return;
    }
    setComment('');
    load();
  };

  const deleteComment = async (commentId: string) => {
    const { error } = await db.from('client_comments').delete().eq('id', commentId);
    if (error) {
      toast({ title: 'Não foi possível excluir', description: error.message, variant: 'destructive' });
      return;
    }
    setEntries((current) => current.filter((e) => e.commentId !== commentId));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          Atividade do cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {commentsAvailable ? (
          <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendComment();
              }}
              placeholder="Escreva um comentário: combinados, feedback do cliente, próximos passos..."
              className="min-h-[80px] bg-background"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Ctrl + Enter para enviar</span>
              <Button size="sm" className="gap-2" onClick={sendComment} disabled={!comment.trim() || sending}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Comentar
              </Button>
            </div>
          </div>
        ) : (
          <p className="rounded-lg bg-warning/10 p-3 text-sm text-muted-foreground">
            Para comentar, aplique a migration <code className="text-xs">client_comments</code> no Lovable.
          </p>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando atividade...
          </p>
        ) : (
          <ol className="relative border-l border-border ml-4 space-y-5">
            {sorted.map((entry) => {
              const style = KIND_STYLE[entry.kind];
              const Icon = entry.id === 'created' ? UserPlus : style.icon;
              return (
                <li key={entry.id} className="ml-6">
                  <span
                    className={cn(
                      'absolute -left-4 flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-card',
                      style.tone,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{entry.title}</p>
                      <p className="text-xs text-muted-foreground">{formatWhen(entry.at)}</p>
                    </div>
                    {entry.commentId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => deleteComment(entry.commentId!)}
                        aria-label="Excluir comentário"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  {entry.detail && (
                    <p
                      className={cn(
                        'mt-1.5 text-sm whitespace-pre-wrap',
                        entry.kind === 'comentario' ? 'rounded-lg border bg-card p-3' : 'text-muted-foreground',
                      )}
                    >
                      {entry.detail}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
