import { Client, MonthlyPaymentStatus } from '@/types/crm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Phone
} from 'lucide-react';
import { format, addMonths, isBefore, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PAYMENT_STATUS_CONFIG: Record<MonthlyPaymentStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  paid: { label: 'Quitado', icon: CheckCircle2, className: 'bg-green-100 text-green-700 border-green-200' },
  overdue: { label: 'Vencido', icon: AlertCircle, className: 'bg-red-100 text-red-700 border-red-200' },
  pending: { label: 'Pendente', icon: CircleDashed, className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
};

interface ClientCardProps {
  client: Client;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
}

export function ClientCard({ client, onEdit, onDelete }: ClientCardProps) {
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

  return (
    <Card className={`hover:shadow-md transition-shadow ${contractExpiringSoon ? 'border-warning ring-1 ring-warning/30' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
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

        <div className="grid grid-cols-2 gap-3">
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
