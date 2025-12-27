import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isPast, isToday } from 'date-fns';
import { Tables } from '@/integrations/supabase/types';

type Lead = Tables<'leads'>;

export function OverdueFollowUpAlert() {
  const { user } = useAuth();
  const [overdueCount, setOverdueCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchOverdueFollowUps = async () => {
      const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', user.id);

      if (leads) {
        const count = leads.filter((lead: Lead) => {
          // Don't count overdue for lost leads or those without interest
          if (lead.status === 'lead_perdido' || lead.status === 'sem_interesse') {
            return false;
          }
          
          // Don't count overdue if all three follow-ups are filled
          if (lead.follow_up_1 && lead.follow_up_2 && lead.follow_up_3) {
            return false;
          }
          
          const followUps = [lead.follow_up_1, lead.follow_up_2, lead.follow_up_3].filter(Boolean);
          return followUps.some(date => date && isPast(new Date(date)) && !isToday(new Date(date)));
        }).length;
        
        setOverdueCount(count);
      }
    };

    fetchOverdueFollowUps();

    // Subscribe to changes
    const channel = supabase
      .channel('leads-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchOverdueFollowUps();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (overdueCount === 0 || dismissed) {
    return null;
  }

  return (
    <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm font-medium">
          Você tem {overdueCount} follow-up{overdueCount > 1 ? 's' : ''} vencido{overdueCount > 1 ? 's' : ''}!
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-destructive/70 hover:text-destructive transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
