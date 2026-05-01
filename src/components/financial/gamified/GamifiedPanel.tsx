import { useState, useEffect, useMemo, useCallback } from 'react';
import { Gamepad2, Flame, Target, Rocket, Trophy, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Lead, LeadStatus, Client } from '@/types/crm';
import { cn } from '@/lib/utils';

type Goals = {
  desired_revenue: number;
  launch_ticket: number;
  deadline_months: number;
  planned_conversion_rate: number; // em %
};

const DEFAULT_GOALS: Goals = {
  desired_revenue: 0,
  launch_ticket: 0,
  deadline_months: 1,
  planned_conversion_rate: 0,
};

const MEETING_OR_BEYOND: LeadStatus[] = [
  'reuniao_realizada',
  'proposta_enviada',
  'em_negociacao',
  'fechado',
  'lead_perdido',
];

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(isFinite(v) ? v : 0);

const fmtNum = (v: number, digits = 0) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(isFinite(v) ? v : 0);

const fmtPct = (v: number) => `${fmtNum(isFinite(v) ? v : 0, 2)}%`;

function calcOffensive(leads: Lead[]): number {
  if (!leads.length) return 0;
  const days = new Set<string>();
  leads.forEach((l) => {
    if (l.created_at) days.add(l.created_at.slice(0, 10));
  });
  let streak = 0;
  const cursor = new Date();
  // Se hoje não teve, começamos a contar a partir de ontem
  let key = cursor.toISOString().slice(0, 10);
  if (!days.has(key)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (true) {
    key = cursor.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

interface KpiCardProps {
  title: string;
  value: string | number;
  caption: string;
  icon: React.ReactNode;
  accent?: string;
}

function KpiCard({ title, value, caption, icon, accent = 'text-warning' }: KpiCardProps) {
  return (
    <Card className="border-2">
      <CardContent className="p-5 text-center">
        <div className="flex items-center justify-center gap-2 text-sm font-bold tracking-wide text-foreground/80 mb-3">
          <span className={accent}>{icon}</span>
          <span className="uppercase">{title}</span>
        </div>
        <div className={cn('text-4xl font-extrabold mb-1', accent)}>{value}</div>
        <div className="text-xs text-muted-foreground">{caption}</div>
      </CardContent>
    </Card>
  );
}

interface RowProps {
  label: string;
  children: React.ReactNode;
}

function Row({ label, children }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-foreground/80">{label}</span>
      <div className="min-w-[120px] flex justify-end">{children}</div>
    </div>
  );
}

function HighlightValue({
  children,
  variant = 'primary',
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'warning' | 'success';
}) {
  const styles = {
    primary: 'bg-sidebar text-sidebar-foreground',
    warning: 'bg-warning text-warning-foreground',
    success: 'bg-success/15 text-success border border-success/30',
  };
  return (
    <div
      className={cn(
        'min-w-[120px] px-3 py-1.5 rounded-md text-center font-bold text-sm',
        styles[variant],
      )}
    >
      {children}
    </div>
  );
}

function MutedValue({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-[120px] px-3 py-1.5 rounded-md text-center font-semibold text-sm bg-muted text-foreground">
      {children}
    </div>
  );
}

function NumericInput({
  value,
  onChange,
  prefix,
  suffix,
  decimals = 2,
}: {
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const [text, setText] = useState<string>(value ? String(value).replace('.', ',') : '');

  useEffect(() => {
    setText(value ? String(value).replace('.', ',') : '');
  }, [value]);

  return (
    <div className="flex items-center gap-1 bg-sidebar text-sidebar-foreground rounded-md px-2 py-1 min-w-[120px] justify-center">
      {prefix && <span className="text-xs opacity-80">{prefix}</span>}
      <Input
        value={text}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d,.-]/g, '');
          setText(raw);
          const normalized = raw.replace(/\./g, '').replace(',', '.');
          const num = parseFloat(normalized);
          if (!isNaN(num)) onChange(num);
          else if (raw === '') onChange(0);
        }}
        inputMode="decimal"
        className="h-7 px-1 py-0 bg-transparent border-0 text-center font-bold text-sm focus-visible:ring-0 focus-visible:ring-offset-0 text-sidebar-foreground placeholder:text-sidebar-foreground/50 w-full"
        placeholder="0"
      />
      {suffix && <span className="text-xs opacity-80">{suffix}</span>}
    </div>
  );
}

interface GamifiedPanelProps {
  leads: Lead[];
  clients: Client[];
  companyName: string | null;
}

export function GamifiedPanel({ leads, clients, companyName }: GamifiedPanelProps) {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [goalsLoaded, setGoalsLoaded] = useState(false);

  // Load goals
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('prospecting_goals')
        .select('desired_revenue, launch_ticket, deadline_months, planned_conversion_rate')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setGoals({
          desired_revenue: Number(data.desired_revenue) || 0,
          launch_ticket: Number(data.launch_ticket) || 0,
          deadline_months: Number(data.deadline_months) || 1,
          planned_conversion_rate: Number(data.planned_conversion_rate) || 0,
        });
      }
      setGoalsLoaded(true);
    })();
  }, [user]);

  // Persist goals (debounced)
  const persistGoals = useCallback(
    (next: Goals) => {
      if (!user) return;
      supabase
        .from('prospecting_goals')
        .upsert(
          {
            user_id: user.id,
            desired_revenue: next.desired_revenue,
            launch_ticket: next.launch_ticket,
            deadline_months: next.deadline_months,
            planned_conversion_rate: next.planned_conversion_rate,
          },
          { onConflict: 'user_id' },
        )
        .then(({ error }) => {
          if (error) console.error('Erro ao salvar metas:', error);
        });
    },
    [user],
  );

  useEffect(() => {
    if (!goalsLoaded) return;
    const t = setTimeout(() => persistGoals(goals), 800);
    return () => clearTimeout(t);
  }, [goals, goalsLoaded, persistGoals]);

  const updateGoal = (key: keyof Goals, value: number) =>
    setGoals((prev) => ({ ...prev, [key]: value }));

  // ===== Métricas reais =====
  const operationRevenue = useMemo(
    () => clients.reduce((sum, c) => sum + (Number(c.project_value) || 0), 0),
    [clients],
  );
  const activeClients = clients.length;
  const baseTicket = activeClients > 0 ? operationRevenue / activeClients : 0;

  const totalLeads = leads.length;
  const respondedLeads = leads.filter((l) => l.responded === true).length;
  const meetingsLeads = leads.filter((l) => MEETING_OR_BEYOND.includes(l.status as LeadStatus)).length;
  const closedLeads = leads.filter((l) => l.status === 'fechado').length;

  const responseRate = totalLeads > 0 ? (respondedLeads / totalLeads) * 100 : 0;
  const meetingRate = respondedLeads > 0 ? (meetingsLeads / respondedLeads) * 100 : 0;
  const closingRate = meetingsLeads > 0 ? (closedLeads / meetingsLeads) * 100 : 0;
  const globalConversion = totalLeads > 0 ? (closedLeads / totalLeads) * 100 : 0;

  // ===== Simulador =====
  const totalNeededClients =
    goals.launch_ticket > 0 ? goals.desired_revenue / goals.launch_ticket : 0;
  const missingClients = Math.max(0, totalNeededClients - activeClients);
  const conversionDecimal = goals.planned_conversion_rate / 100;
  const shotsPerMonth =
    conversionDecimal > 0 && goals.deadline_months > 0
      ? missingClients / conversionDecimal / goals.deadline_months
      : 0;
  const shotsPerWeek = shotsPerMonth / 4;
  const dailyAction = shotsPerWeek / 5;

  // ===== KPIs do topo =====
  const offensiveDays = useMemo(() => calcOffensive(leads), [leads]);
  const todayKey = new Date().toISOString().slice(0, 10);
  const doneToday = leads.filter((l) => (l.created_at || '').slice(0, 10) === todayKey).length;
  const plannedDaily = Math.ceil(dailyAction);

  // ===== Feedback =====
  const isAlert =
    goals.planned_conversion_rate > 0 && globalConversion < goals.planned_conversion_rate;
  const hasGoals = goals.planned_conversion_rate > 0;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b-2 border-sidebar pb-3">
        <h2 className="flex items-center gap-2 text-xl md:text-2xl font-extrabold text-sidebar uppercase tracking-tight">
          <Gamepad2 className="w-6 h-6 text-warning" />
          Central de Prospecção Gamificada
        </h2>
        {companyName && (
          <span className="text-base md:text-lg font-extrabold text-warning uppercase tracking-wide">
            {companyName}
          </span>
        )}
      </div>

      {/* TOP KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Ofensiva"
          value={offensiveDays}
          caption="Dias seguidos de prospecção"
          icon={<Flame className="w-4 h-4" />}
          accent="text-warning"
        />
        <KpiCard
          title="Meta Diária"
          value={`${doneToday} / ${plannedDaily}`}
          caption="Feito x Planejado hoje"
          icon={<Target className="w-4 h-4" />}
          accent="text-sidebar"
        />
        <KpiCard
          title="Acumulado"
          value={totalLeads}
          caption="Disparos totais de frio"
          icon={<Rocket className="w-4 h-4" />}
          accent="text-sidebar"
        />
        <KpiCard
          title="Conversão de Vendas"
          value={fmtPct(globalConversion)}
          caption="Prospects virando cliente"
          icon={<Trophy className="w-4 h-4" />}
          accent="text-sidebar"
        />
      </div>

      {/* 4 BLOCOS PRINCIPAIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* OPERAÇÃO ATUAL */}
        <Card>
          <CardContent className="p-5">
            <h3 className="font-extrabold text-sm uppercase tracking-wide text-sidebar mb-4 flex items-center gap-2">
              <span>📊</span> Sua Operação Atual
            </h3>
            <Row label="Faturamento Mensal Atual">
              <HighlightValue>{fmtBRL(operationRevenue)}</HighlightValue>
            </Row>
            <Row label="Número de Clientes Ativos">
              <HighlightValue>{activeClients}</HighlightValue>
            </Row>
            <Row label="Ticket Médio Base (Autom.)">
              <MutedValue>{fmtBRL(baseTicket)}</MutedValue>
            </Row>
          </CardContent>
        </Card>

        {/* SIMULADOR */}
        <Card>
          <CardContent className="p-5">
            <h3 className="font-extrabold text-sm uppercase tracking-wide text-sidebar mb-4 flex items-center gap-2">
              <span>🎯</span> Simulador (Futuro)
            </h3>
            <Row label="Novo Faturamento Desejado">
              <NumericInput
                value={goals.desired_revenue}
                onChange={(n) => updateGoal('desired_revenue', n)}
                prefix="R$"
              />
            </Row>
            <Row label="Ticket Lançamento Prospecção">
              <NumericInput
                value={goals.launch_ticket}
                onChange={(n) => updateGoal('launch_ticket', n)}
                prefix="R$"
              />
            </Row>
            <Row label="Total Clientes p/ Bater Meta">
              <MutedValue>{fmtNum(totalNeededClients, 1)}</MutedValue>
            </Row>
            <Row label="Faltam X Novos Clientes">
              <MutedValue>{fmtNum(missingClients, 1)}</MutedValue>
            </Row>
            <Row label="Taxa Conversão Planejada">
              <NumericInput
                value={goals.planned_conversion_rate}
                onChange={(n) => updateGoal('planned_conversion_rate', n)}
                suffix="%"
              />
            </Row>
            <Row label="Prazo a Bater (Meses)">
              <NumericInput
                value={goals.deadline_months}
                onChange={(n) => updateGoal('deadline_months', Math.max(1, Math.round(n)))}
                decimals={0}
              />
            </Row>
            <div className="border-t my-3" />
            <Row label="Disparos por Mês">
              <MutedValue>{fmtNum(shotsPerMonth, 0)}</MutedValue>
            </Row>
            <Row label="Disparos por Semana">
              <MutedValue>{fmtNum(shotsPerWeek, 0)}</MutedValue>
            </Row>
            <Row label="AÇÃO DIÁRIA">
              <HighlightValue variant="warning">{fmtNum(dailyAction, 0)}</HighlightValue>
            </Row>
          </CardContent>
        </Card>

        {/* FUNIL REAL */}
        <Card>
          <CardContent className="p-5">
            <h3 className="font-extrabold text-sm uppercase tracking-wide text-sidebar mb-4 flex items-center gap-2">
              <span>📈</span> Seu Funil Real
            </h3>
            <Row label="Prospecções Frias Totais">
              <MutedValue>{totalLeads}</MutedValue>
            </Row>
            <Row label="Respostas Totais (Sim)">
              <MutedValue>{respondedLeads}</MutedValue>
            </Row>
            <Row label="Reuniões Totais (Sim)">
              <MutedValue>{meetingsLeads}</MutedValue>
            </Row>
            <Row label="CONTRATOS FECHADOS (Sim)">
              <HighlightValue variant="success">{closedLeads}</HighlightValue>
            </Row>
            <div className="border-t my-3" />
            <Row label="Taxa Resposta (Warm-up)">
              <MutedValue>{fmtPct(responseRate)}</MutedValue>
            </Row>
            <Row label="Taxa Agendamento (Quente)">
              <MutedValue>{fmtPct(meetingRate)}</MutedValue>
            </Row>
            <Row label="Taxa Fechamento (Deal Won)">
              <MutedValue>{fmtPct(closingRate)}</MutedValue>
            </Row>
          </CardContent>
        </Card>

        {/* FEEDBACK */}
        <Card>
          <CardContent className="p-5">
            <h3 className="font-extrabold text-sm uppercase tracking-wide text-sidebar mb-4 flex items-center gap-2">
              <span>🛟</span> Feedback do Sistema
            </h3>
            {!hasGoals ? (
              <div className="rounded-md p-4 bg-muted text-foreground text-sm text-center space-y-2">
                <Target className="w-6 h-6 mx-auto text-muted-foreground" />
                <p className="font-bold">Defina sua meta</p>
                <p className="text-muted-foreground">
                  Preencha o Simulador ao lado para receber recomendações personalizadas.
                </p>
              </div>
            ) : isAlert ? (
              <div className="rounded-md p-4 bg-warning/15 border border-warning/30 text-sm text-center space-y-3">
                <div className="flex items-center justify-center gap-2 font-extrabold text-warning uppercase">
                  <AlertTriangle className="w-5 h-5" />
                  Modo de Alerta
                </div>
                <p className="text-foreground font-semibold">
                  Sua conversão global está em <strong>{fmtPct(globalConversion)}</strong> e a sua
                  grande meta exige <strong>{fmtPct(goals.planned_conversion_rate)}</strong>.
                </p>
                <p className="text-muted-foreground">
                  Verifique em qual etapa do funil à esquerda o prospect esfriou e ajuste sua
                  abordagem.
                </p>
              </div>
            ) : (
              <div className="rounded-md p-4 bg-success/15 border border-success/30 text-sm text-center space-y-3">
                <div className="flex items-center justify-center gap-2 font-extrabold text-success uppercase">
                  <CheckCircle2 className="w-5 h-5" />
                  Meta no Alvo
                </div>
                <p className="text-foreground font-semibold">
                  Sua conversão global está em <strong>{fmtPct(globalConversion)}</strong>,
                  acima da meta planejada de <strong>{fmtPct(goals.planned_conversion_rate)}</strong>.
                </p>
                <p className="text-muted-foreground">Continue com a cadência atual.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}