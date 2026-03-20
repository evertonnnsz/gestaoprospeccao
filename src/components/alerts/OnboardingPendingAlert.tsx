import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export function OnboardingPendingAlert() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [shown, setShown] = useState(false);

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['onboarding-lead-pending', user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('client_onboarding_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('is_lead_responsibility', true)
        .eq('is_completed', false);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (pendingCount > 0 && !shown) {
      setShown(true);
      toast({
        title: '📋 Tarefas de Onboarding Pendentes',
        description: `Existem ${pendingCount} tarefa(s) de onboarding atribuídas ao lead que ainda estão pendentes.`,
        action: (
          <button
            className="text-xs font-medium underline whitespace-nowrap"
            onClick={() => navigate('/onboarding')}
          >
            Ver tarefas
          </button>
        ),
        duration: 8000,
      });
    }
  }, [pendingCount, shown, navigate]);

  return null;
}
