import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  ListChecks,
  MessageCircle,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useDailyActivities } from '@/hooks/useDailyActivities';

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Bom dia', emoji: '☀️' };
  if (hour < 18) return { text: 'Boa tarde', emoji: '🌤️' };
  return { text: 'Boa noite', emoji: '🌙' };
};

// Abre uma vez por sessão do navegador (cada vez que o CRM é aberto), e de novo se o dia virar.
// sessionStorage: navegar entre as páginas não reabre o resumo.
const seenKey = (userId: string) => `daily-summary-seen:${userId}:${format(new Date(), 'yyyy-MM-dd')}`;

const wasSeen = (userId: string) => {
  try {
    return sessionStorage.getItem(seenKey(userId)) === '1';
  } catch {
    return false;
  }
};

const markSeen = (userId: string) => {
  try {
    sessionStorage.setItem(seenKey(userId), '1');
  } catch {
    // Sem storage: o resumo só volta a aparecer no próximo carregamento.
  }
};

const OPEN_EVENT = 'open-daily-summary';

// Abre o resumo manualmente (botão "Resumo do dia").
export const openDailySummary = () => window.dispatchEvent(new Event(OPEN_EVENT));

// Resumo que abre na tela ao entrar no CRM com o que precisa ser feito hoje.
export function DailySummaryDialog() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [today] = useState(() => new Date());
  const { items, loading } = useDailyActivities(today);
  const [open, setOpen] = useState(false);

  const pending = useMemo(() => items.filter((i) => i.status !== 'concluida'), [items]);

  useEffect(() => {
    if (!user || loading || pending.length === 0) return;
    if (location.pathname === '/atividades' || wasSeen(user.id)) return;
    setOpen(true);
    markSeen(user.id);
    // Só decide uma vez, quando os dados chegam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  const count = (kinds: string[]) => pending.filter((i) => kinds.includes(i.kind)).length;
  // Só totais: a lista detalhada fica no painel do dia.
  const stats = [
    { label: 'Follow-ups hoje', value: count(['follow_up']), icon: MessageCircle, tone: 'text-emerald-600' },
    { label: 'Follow-ups atrasados', value: count(['follow_up_atrasado']), icon: AlertTriangle, tone: 'text-red-500' },
    { label: 'Contratos vencendo', value: count(['contrato']), icon: CalendarClock, tone: 'text-amber-600' },
    { label: 'Pagamentos vencendo', value: count(['pagamento']), icon: DollarSign, tone: 'text-orange-600' },
    { label: 'Compromissos', value: count(['agenda']), icon: CalendarDays, tone: 'text-violet-600' },
    { label: 'Onboarding', value: count(['onboarding']), icon: ClipboardCheck, tone: 'text-sky-600' },
    { label: 'Tarefas', value: count(['manual']), icon: UserRound, tone: 'text-slate-600' },
  ].filter((stat) => stat.value > 0);

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

        {stats.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-lg border bg-muted/30 p-3">
                <stat.icon className={cn('w-4 h-4', stat.tone)} />
                <p className="text-2xl font-semibold mt-1">{stat.value}</p>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle2 className="w-4 h-4" /> Tudo em dia!
          </p>
        )}

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
