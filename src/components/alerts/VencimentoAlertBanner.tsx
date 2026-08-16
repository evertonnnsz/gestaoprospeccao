import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, DollarSign, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { addMonths, addDays, isBefore, isAfter } from 'date-fns';
import { Tables } from '@/integrations/supabase/types';

type Client = Tables<'clients'>;

// Janela de alerta: "vencendo em breve" quando faltam até estes dias.
// Mantém o mesmo critério usado no alerta oficial por WhatsApp (edge function
// whatsapp-vencimento-alert), para que o banner do CRM e o WhatsApp nunca
// fiquem dessincronizados.
const CONTRACT_ALERT_WINDOW_DAYS = 30;
const PAYMENT_ALERT_WINDOW_DAYS = 7;

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

      const today = new Date();
      const contractWindowEnd = addDays(today, CONTRACT_ALERT_WINDOW_DAYS);
      const paymentWindowEnd = addDays(today, PAYMENT_ALERT_WINDOW_DAYS);

      const contractsExpiring = clients.filter((client: Client) => {
        if (!client.project_start_date || !client.contract_duration_months) return false;
        const endDate = addMonths(new Date(client.project_start_date), client.contract_duration_months);
        return isAfter(endDate, today) && isBefore(endDate, contractWindowEnd);
      }).length;

      const paymentsDue = clients.filter((client: Client) => {
        if (!client.payment_due_date) return false;
        const dueDate = new Date(client.payment_due_date);
        return isAfter(dueDate, today) && isBefore(dueDate, paymentWindowEnd);
      }).length;

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
