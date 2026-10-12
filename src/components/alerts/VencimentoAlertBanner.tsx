import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, DollarSign, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  CONTRACT_ALERT_WINDOW_DAYS,
  PAYMENT_ALERT_WINDOW_DAYS,
  isContractExpiringSoon,
  isPaymentDueSoon,
} from '@/lib/utils/dailyRules';

export function VencimentoAlertBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expiringContracts, setExpiringContracts] = useState(0);
  const [duePayments, setDuePayments] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchAlerts = async () => {
      const { data: clients } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (!clients) return;

      const contractsExpiring = clients.filter((client) => isContractExpiringSoon(client)).length;
      const paymentsDue = clients.filter((client) => isPaymentDueSoon(client)).length;

      setExpiringContracts(contractsExpiring);
      setDuePayments(paymentsDue);
    };

    fetchAlerts();

    const channel = supabase
      .channel('clients-vencimento-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients', filter: `user_id=eq.${user.id}` },
        () => fetchAlerts(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (dismissed || (expiringContracts === 0 && duePayments === 0)) {
    return null;
  }

  return (
    <div className="bg-warning/10 border-b border-warning/20 px-4 py-2 flex items-center justify-between gap-4">
      <button
        className="flex items-center gap-4 text-warning text-left hover:underline"
        onClick={() => navigate('/clients')}
      >
        {expiringContracts > 0 && (
          <span className="flex items-center gap-2 text-sm font-medium">
            <CalendarClock className="h-4 w-4" />
            {expiringContracts} contrato{expiringContracts > 1 ? 's' : ''} vencendo em até {CONTRACT_ALERT_WINDOW_DAYS} dias
          </span>
        )}
        {duePayments > 0 && (
          <span className="flex items-center gap-2 text-sm font-medium">
            <DollarSign className="h-4 w-4" />
            {duePayments} pagamento{duePayments > 1 ? 's' : ''} vencendo em até {PAYMENT_ALERT_WINDOW_DAYS} dias
          </span>
        )}
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-warning/70 hover:text-warning transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
