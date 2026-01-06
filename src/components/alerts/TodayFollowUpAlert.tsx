import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isToday } from 'date-fns';
import { Tables } from '@/integrations/supabase/types';

type Lead = Tables<'leads'>;

export function TodayFollowUpAlert() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [todayCount, setTodayCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchTodayFollowUps = async () => {
      const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', user.id);

      if (leads) {
        const count = leads.filter((lead: Lead) => {
          // Don't count for lost leads or those without interest
          if (lead.status === 'lead_perdido' || lead.status === 'sem_interesse') {
            return false;
          }
          
          const followUps = [lead.follow_up_1, lead.follow_up_2, lead.follow_up_3].filter(Boolean);
          return followUps.some(date => date && isToday(new Date(date)));
        }).length;
        
        setTodayCount(count);
      }
    };

    fetchTodayFollowUps();

    // Subscribe to changes
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
