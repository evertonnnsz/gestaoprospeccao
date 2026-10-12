import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, CalendarClock, CalendarDays, Circle, CheckCircle2, Flag, ListChecks, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { KIND_LABELS, useDailyActivities } from '@/hooks/useDailyActivities';
import { KIND_STYLES, PRIORITY_STYLES } from './activityStyles';

const MAX_ITEMS = 6;

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Bom dia', emoji: '☀️' };
  if (hour < 18) return { text: 'Boa tarde', emoji: '🌤️' };
  return { text: 'Boa noite', emoji: '🌙' };
};

const seenKey = (userId: string) => `daily-summary-seen:${userId}:${format(new Date(), 'yyyy-MM-dd')}`;

const wasSeenToday = (userId: string) => {
  try {
    return localStorage.getItem(seenKey(userId)) === '1';
  } catch {
    return false;
  }
};

const markSeenToday = (userId: string) => {
  try {
    localStorage.setItem(seenKey(userId), '1');
  } catch {
    // Sem storage: o resumo só volta a aparecer no próximo carregamento.
  }
};

// Resumo que abre na tela ao entrar no CRM (uma vez por dia) com o que precisa ser feito hoje.
export function DailySummaryDialog() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [today] = useState(() => new Date());
  const { items, loading, setStatus } = useDailyActivities(today);
  const [open, setOpen] = useState(false);

  const pending = useMemo(() => items.filter((i) => i.status !== 'concluida'), [items]);

  useEffect(() => {
    if (!user || loading || pending.length === 0) return;
    if (location.pathname === '/atividades' || wasSeenToday(user.id)) return;
    setOpen(true);
    markSeenToday(user.id);
    // Só decide uma vez, quando os dados chegam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  const count = (kinds: string[]) => pending.filter((i) => kinds.includes(i.kind)).length;
  const stats = [
    { label: 'Follow-ups hoje', value: count(['follow_up']), icon: MessageCircle, tone: 'text-emerald-600' },
    { label: 'Atrasados', value: count(['follow_up_atrasado']), icon: AlertTriangle, tone: 'text-red-500' },
    { label: 'Vencimentos', value: count(['contrato', 'pagamento']), icon: CalendarClock, tone: 'text-amber-600' },
    { label: 'Agenda', value: count(['agenda']), icon: CalendarDays, tone: 'text-violet-600' },
  ];

  const { text, emoji } = greeting();
  const firstName = profile?.full_name?.split(' ')[0];

  const goToPanel = () => {
    setOpen(false);
    navigate('/atividades');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {text}
            {firstName ? `, ${firstName}` : ''}! {emoji}
          </DialogTitle>
          <DialogDescription>
            Resumo de {format(today, "EEEE, dd 'de' MMMM", { locale: ptBR })}: você tem{' '}
            <strong className="text-foreground">{pending.length}</strong> atividade{pending.length === 1 ? '' : 's'} para hoje.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border bg-muted/30 p-3">
              <stat.icon className={cn('w-4 h-4', stat.tone)} />
              <p className="text-2xl font-semibold mt-1">{stat.value}</p>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Prioridades</p>
          {pending.slice(0, MAX_ITEMS).map((item) => {
            const KindIcon = KIND_STYLES[item.kind].icon;
            return (
              <div key={item.key} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
                <button
                  onClick={() => setStatus(item, 'concluida').catch(() => undefined)}
                  className="text-muted-foreground hover:text-emerald-600 shrink-0"
                  aria-label="Marcar como concluída"
                >
                  <Circle className="w-4 h-4" />
                </button>
                <Flag className={cn('w-3.5 h-3.5 shrink-0', PRIORITY_STYLES[item.priority])} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {item.time && <span className="text-primary mr-1">{item.time}</span>}
                    {item.title}
                  </p>
                  {item.subtitle && <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>}
                </div>
                <span
                  className={cn(
                    'hidden sm:inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium shrink-0',
                    KIND_STYLES[item.kind].badge,
                  )}
                >
                  <KindIcon className="w-3 h-3" />
                  {KIND_LABELS[item.kind]}
                </span>
              </div>
            );
          })}
          {pending.length > MAX_ITEMS && (
            <p className="text-xs text-muted-foreground px-2 pt-1">
              + {pending.length - MAX_ITEMS} outra{pending.length - MAX_ITEMS === 1 ? '' : 's'} no painel do dia
            </p>
          )}
          {pending.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-emerald-600 px-2">
              <CheckCircle2 className="w-4 h-4" /> Tudo em dia!
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Ver depois
          </Button>
          <Button className="gap-2" onClick={goToPanel}>
            <ListChecks className="w-4 h-4" />
            Abrir painel do dia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
