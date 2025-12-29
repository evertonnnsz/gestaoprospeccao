import { useEffect, useState } from 'react';
import { CalendarClock, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { addMonths, isBefore, isAfter, addDays } from 'date-fns';
import { Tables } from '@/integrations/supabase/types';

type Client = Tables<'clients'>;

export function ContractExpirationAlert() {
  const { user } = useAuth();
  const [expiringCount, setExpiringCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchExpiringContracts = async () => {
      const { data: clients } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id);

      if (clients) {
        const today = new Date();
        const oneMonthFromNow = addMonths(today, 1);

        const count = clients.filter((client: Client) => {
          // Calcula a data de término do contrato
          if (!client.project_start_date || !client.contract_duration_months) {
            return false;
          }

          const startDate = new Date(client.project_start_date);
          const endDate = addMonths(startDate, client.contract_duration_months);

          // Verifica se o contrato vence dentro de 1 mês (e ainda não venceu)
          return isAfter(endDate, today) && isBefore(endDate, oneMonthFromNow);
        }).length;

        setExpiringCount(count);
      }
    };

    fetchExpiringContracts();

    // Subscribe to changes
    const channel = supabase
      .channel('clients-expiration-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchExpiringContracts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (expiringCount === 0 || dismissed) {
    return null;
  }

  return (
    <div className="bg-warning/10 border-b border-warning/20 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2 text-warning">
        <CalendarClock className="h-4 w-4" />
        <span className="text-sm font-medium">
          Você tem {expiringCount} contrato{expiringCount > 1 ? 's' : ''} vencendo em menos de 1 mês!
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-warning/70 hover:text-warning transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
