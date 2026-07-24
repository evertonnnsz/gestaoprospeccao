import { format, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Lead } from '@/types/crm';
import { LeadStatusBadge } from './LeadStatusBadge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Building2, 
  Calendar, 
  MessageCircle, 
  Instagram, 
  AlertTriangle,
  Edit2,
  Trash2,
  CheckCircle2,
  Bell,
  RefreshCw
} from 'lucide-react';
import { generateFollowUpDates, generateNextFollowUpFromContact } from '@/lib/utils/followUpDates';

// Helper functions to compare dates without timezone issues
const isSameDay = (dateStr: string): boolean => {
  const date = parseISO(dateStr);
  const today = startOfDay(new Date());
  return startOfDay(date).getTime() === today.getTime();
};

const isDatePast = (dateStr: string): boolean => {
  const date = parseISO(dateStr);
  const today = startOfDay(new Date());
  return startOfDay(date).getTime() < today.getTime();
};

interface LeadCardProps {
  lead: Lead;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onUpdate?: () => void;
  hasCheckbox?: boolean;
}

export function LeadCard({ lead, onEdit, onDelete, onUpdate, hasCheckbox }: LeadCardProps) {
  const { toast } = useToast();

  const hasOverdueFollowUp = () => {
    // Don't show overdue for lost leads or those without interest
    if (lead.status === 'lead_perdido' || lead.status === 'sem_interesse') {
      return false;
    }
    
    // Don't show overdue if all three follow-ups are filled
    if (lead.follow_up_1 && lead.follow_up_2 && lead.follow_up_3) {
      return false;
    }
    
    const followUps = [lead.follow_up_1, lead.follow_up_2, lead.follow_up_3].filter(Boolean);
    return followUps.some(date => date && isDatePast(date));
  };

  const hasTodayFollowUp = () => {
    if (lead.status === 'lead_perdido' || lead.status === 'sem_interesse') {
      return false;
    }
    const followUps = [lead.follow_up_1, lead.follow_up_2, lead.follow_up_3].filter(Boolean);
    return followUps.some(date => date && isSameDay(date));
  };

  const getNextFollowUp = () => {
    const today = startOfDay(new Date());
    const followUps = [lead.follow_up_1, lead.follow_up_2, lead.follow_up_3]
      .filter(Boolean)
      .map(d => parseISO(d!))
      .filter(d => startOfDay(d).getTime() >= today.getTime())
      .sort((a, b) => a.getTime() - b.getTime());
    return followUps[0];
  };

  const canRenewFollowUp = () => {
    if (lead.status === 'lead_perdido' || lead.status === 'sem_interesse' || lead.status === 'fechado') {
      return false;
    }
    // Show renew when all 3 follow-ups are empty (completed/cleared) or all are past
    const followUps = [lead.follow_up_1, lead.follow_up_2, lead.follow_up_3];
    const allEmpty = followUps.every(f => !f);
    const allPast = followUps.filter(Boolean).every(f => isDatePast(f!));
    return allEmpty || allPast;
  };

  const renewFollowUp = async () => {
    try {
      const dates = generateFollowUpDates();
      const { error } = await supabase
        .from('leads')
        .update({
          follow_up_1: dates.follow_up_1,
          follow_up_2: dates.follow_up_2,
          follow_up_3: dates.follow_up_3,
        })
        .eq('id', lead.id);

      if (error) throw error;

      toast({
        title: 'Follow-ups renovados',
        description: 'Novos follow-ups agendados para os próximos 3 dias úteis.',
      });

      onUpdate?.();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const completeFollowUp = async () => {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const updates: Partial<Lead> = { last_contact: todayStr };

      // Concluir follow-up 1: limpa e recalcula follow-up 2 a partir de hoje
      if (lead.follow_up_1 && isSameDay(lead.follow_up_1)) {
        updates.follow_up_1 = null;
        updates.follow_up_2 = generateNextFollowUpFromContact(today, 2);
      }
      // Concluir follow-up 2: limpa e recalcula follow-up 3 a partir de hoje
      if (lead.follow_up_2 && isSameDay(lead.follow_up_2)) {
        updates.follow_up_2 = null;
        updates.follow_up_3 = generateNextFollowUpFromContact(today, 3);
      }
      // Concluir follow-up 3: apenas limpa
      if (lead.follow_up_3 && isSameDay(lead.follow_up_3)) {
        updates.follow_up_3 = null;
      }

      const { error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', lead.id);

      if (error) throw error;

      toast({
        title: 'Follow-up concluído',
        description: 'O follow-up foi marcado como concluído.',
      });

      onUpdate?.();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const isOverdue = hasOverdueFollowUp();
  const isTodays = hasTodayFollowUp();
  const nextFollowUp = getNextFollowUp();

  const openWhatsApp = () => {
    if (lead.whatsapp) {
      const phone = lead.whatsapp.replace(/\D/g, '');
      window.open(`https://wa.me/${phone}`, '_blank');
    }
  };

  const openInstagram = () => {
    if (lead.instagram) {
      const username = lead.instagram.replace('@', '');
      window.open(`https://instagram.com/${username}`, '_blank');
    }
  };

  return (
    <Card 
      className={cn(
        "p-4 transition-all hover:-translate-y-0.5 hover:shadow-md animate-fade-in",
        isOverdue && "border-destructive/40 bg-destructive/5",
        isTodays && !isOverdue && "border-primary/30 bg-accent/50"
      )}
    >
      <div className={cn("flex items-start justify-between gap-4", hasCheckbox && "pl-8")}>
        <div className="flex-1 min-w-0 space-y-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold truncate text-base">{lead.company_name}</h3>
              {lead.razao_social && (
                <p className="text-xs text-muted-foreground truncate">{lead.razao_social}</p>
              )}
              {lead.cnpj && (
                <p className="text-xs text-muted-foreground font-mono">{lead.cnpj}</p>
              )}
              {lead.contact_name && (
                <p className="text-sm text-muted-foreground truncate">{lead.contact_name}</p>
              )}
            </div>
          </div>

          {/* Status and alerts */}
          <div className="flex items-center gap-2 flex-wrap">
            <LeadStatusBadge status={lead.status} size="sm" />
            {isOverdue && (
              <span className="inline-flex items-center gap-1 text-xs text-destructive font-medium">
                <AlertTriangle className="w-3 h-3" />
                Follow-up vencido
              </span>
            )}
            {isTodays && !isOverdue && (
              <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                <Bell className="w-3 h-3" />
                Follow-up hoje
              </span>
            )}
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {lead.segment && (
              <span className="truncate">{lead.segment}</span>
            )}
            {nextFollowUp && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {format(nextFollowUp, "dd/MM", { locale: ptBR })}
              </span>
            )}
          </div>

          {/* Next action */}
          {lead.next_action && (
            <p className="text-sm bg-muted/60 rounded-lg px-3 py-2 truncate">
              Próxima ação: {lead.next_action}
            </p>
          )}

          {/* Complete Follow-up Button */}
          {isTodays && (
            <Button 
              size="sm" 
              variant="outline" 
              className="gap-2 text-primary border-primary/30 hover:bg-primary/10"
              onClick={completeFollowUp}
            >
              <CheckCircle2 className="w-4 h-4" />
              Concluir Follow-up
            </Button>
          )}

          {/* Renew Follow-up Button - always visible for active leads */}
          {lead.status !== 'lead_perdido' && lead.status !== 'sem_interesse' && lead.status !== 'fechado' && (
            <Button 
              size="sm" 
              variant="outline" 
              className="gap-2 text-accent-foreground border-accent hover:bg-accent/80"
              onClick={renewFollowUp}
            >
              <RefreshCw className="w-4 h-4" />
              Renovar Follow-ups
            </Button>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 rounded-lg bg-muted/40 p-1">
          {lead.whatsapp && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-success" onClick={openWhatsApp}>
              <MessageCircle className="w-4 h-4" />
            </Button>
          )}
          {lead.instagram && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-chart-4" onClick={openInstagram}>
              <Instagram className="w-4 h-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(lead)}>
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => onDelete(lead)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
