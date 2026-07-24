import { Client, ClientStatus, MonthlyPaymentStatus } from '@/types/crm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Building2, 
  Calendar, 
  DollarSign, 
  FileText, 
  Clock, 
  Edit, 
  Trash2,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  CircleDashed,
  Phone,
  PauseCircle,
  UserMinus,
  ChevronDown,
  PlayCircle,
} from 'lucide-react';
import { format, addMonths, isBefore, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PAYMENT_STATUS_CONFIG: Record<MonthlyPaymentStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  paid: { label: 'Quitado', icon: CheckCircle2, className: 'bg-success/10 text-success border-success/20' },
  overdue: { label: 'Vencido', icon: AlertCircle, className: 'bg-destructive/10 text-destructive border-destructive/20' },
  pending: { label: 'Pendente', icon: CircleDashed, className: 'bg-warning/10 text-warning border-warning/20' },
};

const CLIENT_STATUS_CONFIG: Record<ClientStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  active: { label: 'Ativo', icon: PlayCircle, className: 'bg-success/15 text-success border-success/30' },
  paused: { label: 'Pausado', icon: PauseCircle, className: 'bg-warning/15 text-warning border-warning/30' },
  churn: { label: 'Churn', icon: UserMinus, className: 'bg-destructive/15 text-destructive border-destructive/30' },
};

interface ClientCardProps {
  client: Client;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
  onChange?: () => void;
}

export function ClientCard({ client, onEdit, onDelete, onChange }: ClientCardProps) {
  const { toast } = useToast();
  const currentStatus: ClientStatus = (client.status as ClientStatus) || 'active';
  const statusConfig = CLIENT_STATUS_CONFIG[currentStatus];
  const StatusIcon = statusConfig.icon;

  const handleStatusChange = async (newStatus: ClientStatus) => {
    if (newStatus === currentStatus) return;
    try {
      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'churn') {
        updates.churn_date = new Date().toISOString().split('T')[0];
      } else {
        updates.churn_date = null;
        updates.churn_reason = null;
      }
      const { error } = await supabase.from('clients').update(updates).eq('id', client.id);
      if (error) throw error;
      toast({ title: `Status atualizado para ${CLIENT_STATUS_CONFIG[newStatus].label}` });
      onChange?.();
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar status',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR });
  };

  // Verifica se o contrato está próximo do vencimento (1 mês)
  const isContractExpiringSoon = () => {
    if (!client.project_start_date || !client.contract_duration_months) {
      return false;
    }
    const today = new Date();
    const oneMonthFromNow = addMonths(today, 1);
    const startDate = new Date(client.project_start_date);
    const endDate = addMonths(startDate, client.contract_duration_months);
    
    return isAfter(endDate, today) && isBefore(endDate, oneMonthFromNow);
  };

  const contractExpiringSoon = isContractExpiringSoon();
  const isInactive = currentStatus !== 'active';

  return (
    <Card
      className={`hover:-translate-y-0.5 hover:shadow-md transition-all ${
        contractExpiringSoon ? 'border-warning/50 ring-1 ring-warning/20' : ''
      } ${isInactive ? 'opacity-75' : ''}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="w-5 h-5 text-primary" />
              </span>
              {client.lead?.company_name || 'Cliente'}
            </CardTitle>
            {client.lead?.contact_name && (
              <p className="text-sm text-muted-foreground mt-1">
                {client.lead.contact_name}
              </p>
            )}
            {contractExpiringSoon && (
              <div className="flex items-center gap-1.5 mt-2 text-warning">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-medium">Contrato vencendo em breve!</span>
              </div>
            )}
          </div>
          <div className="flex gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={`gap-1 ${statusConfig.className}`}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{statusConfig.label}</span>
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Mudar status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleStatusChange('active')}>
                  <PlayCircle className="w-4 h-4 mr-2 text-success" />
                  Ativo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange('paused')}>
                  <PauseCircle className="w-4 h-4 mr-2 text-warning" />
                  Pausado
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleStatusChange('churn')}
                  className="text-destructive focus:text-destructive"
                >
                  <UserMinus className="w-4 h-4 mr-2" />
                  Churn (saída)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" onClick={() => onEdit(client)}>
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(client)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {currentStatus === 'churn' && client.churn_reason && (
          <div className="text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded p-2">
            <strong>Motivo do churn:</strong> {client.churn_reason}
          </div>
        )}
        {client.monthly_payment_status && (
          <div className="flex items-center">
            {(() => {
              const status = client.monthly_payment_status as MonthlyPaymentStatus;
              const config = PAYMENT_STATUS_CONFIG[status];
              const Icon = config.icon;
              return (
                <Badge variant="outline" className={`gap-1 ${config.className}`}>
                  <Icon className="w-3.5 h-3.5" />
                  Mês: {config.label}
                </Badge>
              );
            })()}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3">
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{formatCurrency(client.project_value)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>{client.contract_duration_months ? `${client.contract_duration_months} meses` : '-'}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {client.lead?.whatsapp && (
            <div className="flex items-center gap-2 text-sm col-span-2">
              <Phone className="w-4 h-4 text-green-600" />
              <span>{client.lead.whatsapp}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Início</p>
            <div className="flex items-center gap-1 text-sm">
              <Calendar className="w-3 h-3" />
              {formatDate(client.project_start_date)}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Vencimento</p>
            <div className="flex items-center gap-1 text-sm">
              <Calendar className="w-3 h-3" />
              {formatDate(client.payment_due_date)}
            </div>
          </div>
        </div>

        {client.services && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Serviços</p>
            <p className="text-sm line-clamp-2">{client.services}</p>
          </div>
        )}

        {client.contract_url && (
          <a
            href={client.contract_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <FileText className="w-4 h-4" />
            Ver Contrato
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        {client.notes && (
          <div className="space-y-1 pt-2 border-t">
            <p className="text-xs text-muted-foreground">Observações</p>
            <p className="text-sm text-muted-foreground line-clamp-2">{client.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
