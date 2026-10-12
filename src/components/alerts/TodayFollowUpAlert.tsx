import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAllRows } from '@/lib/supabaseFetch';
import { hasTodayFollowUp } from '@/lib/utils/dailyRules';
import type { Lead } from '@/types/crm';

// Recalcula periodicamente para virar o dia corretamente com a aba aberta.
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function TodayFollowUpAlert() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [todayCount, setTodayCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchTodayFollowUps = async () => {
      // Paginado: um select simples para em 1.000 linhas e fazia o banner
      // mostrar menos follow-ups que o Dashboard.
      const leads = await fetchAllRows<Lead>('leads', {
        select: 'id, status, follow_up_1, follow_up_2, follow_up_3',
      });
      setTodayCount(leads.filter(hasTodayFollowUp).length);
    };

    fetchTodayFollowUps();
    const interval = window.setInterval(fetchTodayFollowUps, REFRESH_INTERVAL_MS);

    const channel = supabase
      .channel('leads-today-followups')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchTodayFollowUps();
        }
      )
      .subscribe();

    return () => {
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleClick = () => {
    navigate('/leads?filter=today');
  };

  if (todayCount === 0 || dismissed) {
    return null;
  }

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between">
      <button
        onClick={handleClick}
        className="flex items-center gap-2 text-primary hover:underline"
      >
        <Bell className="h-4 w-4" />
        <span className="text-sm font-medium">
          Você tem {todayCount} follow-up{todayCount > 1 ? 's' : ''} para hoje! Clique para ver.
        </span>
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-primary/70 hover:text-primary transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
