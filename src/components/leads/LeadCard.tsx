import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Lead } from '@/types/crm';
import { LeadStatusBadge } from './LeadStatusBadge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Building2, 
  Calendar, 
  MessageCircle, 
  Instagram, 
  AlertTriangle,
  Edit2,
  Trash2,
  ExternalLink 
} from 'lucide-react';

interface LeadCardProps {
  lead: Lead;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
}

export function LeadCard({ lead, onEdit, onDelete }: LeadCardProps) {
  const hasOverdueFollowUp = () => {
    const followUps = [lead.follow_up_1, lead.follow_up_2, lead.follow_up_3].filter(Boolean);
    return followUps.some(date => date && isPast(new Date(date)) && !isToday(new Date(date)));
  };

  const getNextFollowUp = () => {
    const followUps = [lead.follow_up_1, lead.follow_up_2, lead.follow_up_3]
      .filter(Boolean)
      .map(d => new Date(d!))
      .filter(d => !isPast(d) || isToday(d))
      .sort((a, b) => a.getTime() - b.getTime());
    return followUps[0];
  };

  const isOverdue = hasOverdueFollowUp();
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
        "p-4 transition-all hover:shadow-md animate-fade-in",
        isOverdue && "border-destructive/50 bg-destructive/5"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{lead.company_name}</h3>
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
            <p className="text-sm bg-muted/50 rounded px-2 py-1 truncate">
              Próxima ação: {lead.next_action}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1">
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
