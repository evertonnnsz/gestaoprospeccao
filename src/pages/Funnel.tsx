import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Lead, LeadStatus, STATUS_LABELS } from '@/types/crm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PeriodFilter, PeriodType, DateRange, filterByPeriod } from '@/components/filters/PeriodFilter';
import {
  Loader2,
  MessageCircle,
  Users,
  Sparkles,
  CalendarCheck,
  Trophy,
  ChevronDown,
  XCircle,
  EyeOff,
  Ban,
} from 'lucide-react';

type StageKey = LeadStatus | 'responderam';

const FUNNEL_STAGES: StageKey[] = [
  'lead_coletado',
  'responderam',
  'interesse_demonstrado',
  'agendou_reuniao',
  'reuniao_realizada',
  'proposta_enviada',
  'em_negociacao',
  'fechado',
];

const STAGE_COLORS: Record<StageKey, string> = {
  lead_coletado: 'hsl(var(--muted-foreground))',
  contato_iniciado: 'hsl(var(--primary))',
  responderam: 'hsl(var(--primary))',
  visualizou_nao_respondeu: 'hsl(var(--warning))',
  interesse_demonstrado: 'hsl(var(--success))',
  agendou_reuniao: 'hsl(var(--chart-4))',
  reuniao_realizada: 'hsl(var(--chart-4))',
  proposta_enviada: 'hsl(var(--primary))',
  em_negociacao: 'hsl(var(--warning))',
  fechado: 'hsl(var(--success))',
  sem_interesse: 'hsl(var(--muted-foreground))',
  lead_perdido: 'hsl(var(--destructive))',
};

const closedStatuses: LeadStatus[] = ['fechado', 'lead_perdido'];

interface StatusHistoryEntry {
  lead_id: string;
  status: LeadStatus;
  changed_at: string;
}

// Conta leads distintos que JÁ passaram pelo status informado (com base no histórico).
function countByHistory(history: StatusHistoryEntry[], status: LeadStatus): number {
  const ids = new Set<string>();
  for (const h of history) {
    if (h.status === status) ids.add(h.lead_id);
  }
  return ids.size;
}

export default function Funnel() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('all');
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [respondedFilter, setRespondedFilter] = useState<string>('all');

  useEffect(() => {
    const fetchAll = async () => {
      const [{ data: leadsData }, { data: historyData }] = await Promise.all([
        supabase.from('leads').select('*'),
        (supabase as any).from('lead_status_history').select('lead_id, status, changed_at'),
      ]);
      setLeads((leadsData as Lead[]) || []);
      setHistory((historyData as StatusHistoryEntry[]) || []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const periodFilteredLeads = useMemo(
    () => filterByPeriod(leads, period, dateRange),
    [leads, period, dateRange]
  );

  const filteredLeads = useMemo(
    () =>
      periodFilteredLeads.filter((lead) => {
        if (respondedFilter === 'all') return true;
        if (respondedFilter === 'yes') return lead.responded === true;
        if (respondedFilter === 'no') return lead.responded === false || lead.responded === null;
        return true;
      }),
    [periodFilteredLeads, respondedFilter]
  );

  // Histórico restrito aos leads visíveis no período/filtros atuais.
  const filteredHistory = useMemo(() => {
    const allowedIds = new Set(filteredLeads.map((l) => l.id));
    return history.filter((h) => allowedIds.has(h.lead_id));
  }, [history, filteredLeads]);

  const stageCounts = useMemo(() => {
    return FUNNEL_STAGES.map((stage) => {
      let count: number;
      if (stage === 'lead_coletado') {
        count = filteredLeads.length;
      } else if (stage === 'responderam') {
        count = filteredLeads.filter((l) => l.responded === true).length;
      } else {
        count = countByHistory(filteredHistory, stage as LeadStatus);
      }
      return { stage, count };
    });
  }, [filteredLeads, filteredHistory]);

  const topCount = stageCounts[0]?.count ?? 0;
  const closedCount = stageCounts[stageCounts.length - 1]?.count ?? 0;
  const overallConversion = topCount > 0 ? (closedCount / topCount) * 100 : 0;

  const respondedLeads = periodFilteredLeads.filter((l) => l.responded === true).length;

  // Desqualificados via histórico (mantém o evento mesmo se status mudar depois)
  const visualizouCount = countByHistory(filteredHistory, 'visualizou_nao_respondeu');
  const semInteresseCount = countByHistory(filteredHistory, 'sem_interesse');
  const perdidoCount = countByHistory(filteredHistory, 'lead_perdido');
  const desqualificadoTotal = visualizouCount + semInteresseCount + perdidoCount;

  // KPIs
  const engajadosCount = countByHistory(filteredHistory, 'interesse_demonstrado');
  const reunioesCount = countByHistory(filteredHistory, 'reuniao_realizada');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Funil de Prospecção</h1>
          <p className="text-muted-foreground">
            {filteredLeads.length} leads no período selecionado
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <PeriodFilter
            value={period}
            onChange={setPeriod}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
          <Select value={respondedFilter} onValueChange={setRespondedFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filtrar por resposta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Respostas</SelectItem>
              <SelectItem value="yes">Respondeu</SelectItem>
              <SelectItem value="no">Não Respondeu</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Users} label="Topo do Funil" value={topCount} accent="text-muted-foreground" />
        <KpiCard icon={Sparkles} label="Engajados" value={engajadosCount} accent="text-success" />
        <KpiCard icon={CalendarCheck} label="Reuniões" value={reunioesCount} accent="text-chart-4" />
        <KpiCard icon={Trophy} label="Fechados" value={closedCount} accent="text-success" />
      </div>

      {/* Funil + Desqualificados */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Funil principal */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Funil de Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            {topCount === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                Nenhum lead no período selecionado
              </div>
            ) : (
              <div className="space-y-1">
                {(() => {
                  // Escala de larguras que GARANTE formato de funil (monotonicamente decrescente).
                  const total = stageCounts.length;
                  const MAX_W = 100;
                  const MIN_W = 14;
                  const widths: number[] = [];
                  for (let i = 0; i < total; i++) {
                    const item = stageCounts[i];
                    const proportional = topCount > 0 ? (item.count / topCount) * 100 : 0;
                    const positional =
                      total > 1 ? MAX_W - ((MAX_W - MIN_W) * i) / (total - 1) : MAX_W;
                    let w = proportional * 0.6 + positional * 0.4;
                    if (i > 0) w = Math.min(w, widths[i - 1] - 2);
                    w = Math.max(MIN_W, Math.min(MAX_W, w));
                    if (item.count === 0) w = MIN_W;
                    widths.push(w);
                  }
                  return stageCounts.map((item, idx) => {
                    const prev = idx > 0 ? stageCounts[idx - 1].count : null;
                    const conv = prev && prev > 0 ? (item.count / prev) * 100 : null;
                    const widthPct = widths[idx];
                    const sharePct = topCount > 0 ? (item.count / topCount) * 100 : 0;
                    const color = STAGE_COLORS[item.stage];
                    const label =
                      item.stage === 'responderam'
                        ? 'Leads que Responderam'
                        : STATUS_LABELS[item.stage as LeadStatus];

                    return (
                    <div key={item.stage}>
                      {idx > 0 && (
                        <div className="flex items-center justify-center py-1.5">
                          <div className="flex items-center gap-1.5 text-xs">
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                            <span
                              className={
                                conv !== null && conv >= 50
                                  ? 'text-success font-medium'
                                  : conv !== null && conv >= 25
                                  ? 'text-warning font-medium'
                                  : 'text-muted-foreground font-medium'
                              }
                            >
                              {conv !== null ? `${conv.toFixed(1)}%` : '—'}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        {/* Barra do funil centralizada — sem minWidth para preservar formato */}
                        <div className="flex-1 flex justify-center items-center gap-3">
                          <div
                            className="rounded-md flex items-center justify-center px-3 py-3 shadow-sm transition-all"
                            style={{
                              width: `${widthPct}%`,
                              backgroundColor: color,
                            }}
                            title={`${label}: ${item.count}`}
                          >
                            <span className="text-xs sm:text-sm font-semibold text-white drop-shadow truncate text-center">
                              {label}
                            </span>
                          </div>
                          <span className="text-sm font-bold tabular-nums w-12 text-left">
                            {item.count}
                          </span>
                        </div>

                        {/* % do topo */}
                        <div className="w-16 text-right">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {sharePct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    );
                  });
                })()}

                {/* Conversão total */}
                <div className="mt-6 pt-4 border-t flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Conversão total Topo → Fechado
                  </span>
                  <span className="text-lg font-bold text-success">
                    {overallConversion.toFixed(2)}%
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Painel lateral - Desqualificados */}
        <Card className="shadow-sm h-fit">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" />
              Desqualificados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DisqualifiedRow
              icon={EyeOff}
              label="Visualizou e Não Respondeu"
              count={visualizouCount}
              color="text-warning"
              bg="bg-warning/10"
            />
            <DisqualifiedRow
              icon={Ban}
              label="Sem Interesse"
              count={semInteresseCount}
              color="text-muted-foreground"
              bg="bg-muted"
            />
            <DisqualifiedRow
              icon={XCircle}
              label="Lead Perdido"
              count={perdidoCount}
              color="text-destructive"
              bg="bg-destructive/10"
            />

            <div className="pt-3 mt-3 border-t flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total</span>
              <span className="text-lg font-bold">{desqualificadoTotal}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <Icon className={`w-8 h-8 ${accent}`} />
      </CardContent>
    </Card>
  );
}

function DisqualifiedRow({
  icon: Icon,
  label,
  count,
  color,
  bg,
}: {
  icon: any;
  label: string;
  count: number;
  color: string;
  bg: string;
}) {
  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${bg}`}>
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={`w-4 h-4 shrink-0 ${color}`} />
        <span className="text-sm font-medium truncate">{label}</span>
      </div>
      <span className={`text-base font-bold ${color}`}>{count}</span>
    </div>
  );
}
