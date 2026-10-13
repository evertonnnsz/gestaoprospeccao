import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  HelpCircle,
  MapPin,
  Phone,
  Star,
  ThumbsUp,
  Trophy,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type {
  ChecklistItem,
  Profile,
  ReviewStats,
  computeCategories,
  computeCompetition,
} from '../../../supabase/functions/gbp-analyze/analysis';

export type GbpAnalysis = {
  id: string;
  created_at: string;
  business_name: string;
  address: string | null;
  data_id: string | null;
  score: number;
  reviews_analyzed: number;
  lead_id: string | null;
  client_id: string | null;
  profile: Profile;
  checklist: ChecklistItem[];
  competitors: ReturnType<typeof computeCompetition>;
  reviews: ReviewStats;
  categories: ReturnType<typeof computeCategories>;
};

export const scoreTone = (score: number) =>
  score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-500' : 'text-red-500';

const STATUS_STYLE = {
  ok: { icon: CheckCircle2, tone: 'text-emerald-600', label: 'Ok' },
  atencao: { icon: AlertTriangle, tone: 'text-amber-500', label: 'Precisa de atenção' },
  desconhecido: { icon: HelpCircle, tone: 'text-muted-foreground', label: 'Não verificável' },
} as const;

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  color: 'hsl(var(--foreground))',
};

const monthLabel = (key: string) => format(parseISO(`${key}-01`), 'MMM/yy', { locale: ptBR });

export function ScoreRing({ score, size = 112 }: { score: number; size?: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
          className={scoreTone(score)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-3xl font-bold', scoreTone(score))}>{score}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">de 100</span>
      </div>
    </div>
  );
}

function Percent({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-semibold">{value.toLocaleString('pt-BR')}%</span>
      </div>
      <Progress value={value} className="h-2" />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Words({ title, words, tone }: { title: string; words: { word: string; count: number }[]; tone: string }) {
  const max = words[0]?.count || 1;
  return (
    <div>
      <p className="text-sm font-medium mb-2">{title}</p>
      {words.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem avaliações suficientes.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {words.map((w) => (
            <span
              key={w.word}
              className={cn('rounded-full px-2.5 py-1 font-medium', tone)}
              style={{ fontSize: `${0.75 + (w.count / max) * 0.35}rem` }}
            >
              {w.word} <span className="opacity-60">{w.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function GbpAnalysisView({
  analysis,
  history,
  presentation,
  printing,
}: {
  analysis: GbpAnalysis;
  history: GbpAnalysis[];
  presentation: boolean;
  printing: boolean;
}) {
  const [tab, setTab] = useState('checklist');
  const { profile, checklist, competitors, reviews, categories } = analysis;

  const visibleChecklist = presentation ? checklist.filter((i) => i.status === 'ok') : checklist;
  const okCount = checklist.filter((i) => i.status === 'ok').length;
  const attentionCount = checklist.filter((i) => i.status === 'atencao').length;

  const evolution = useMemo(
    () =>
      history
        .filter((h) => h.data_id && h.data_id === analysis.data_id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((h) => ({ date: format(parseISO(h.created_at), 'dd/MM/yy'), score: h.score })),
    [history, analysis.data_id],
  );

  const monthData = reviews.months.map((m) => ({ ...m, label: monthLabel(m.month) }));
  const starData = ['5', '4', '3', '2', '1'].map((s) => ({ star: `${s}★`, total: reviews.stars[s] || 0 }));

  const header = (
    <Card>
      <CardContent className="pt-6 flex flex-col md:flex-row gap-6 md:items-center">
        <ScoreRing score={analysis.score} />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{profile.title}</h2>
            {profile.rating !== null && (
              <span className="flex items-center gap-1 text-sm">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                {profile.rating.toFixed(1)} · {profile.reviews ?? 0} avaliações
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {profile.categories.map((c, i) => (
              <Badge key={c} variant={i === 0 ? 'default' : 'secondary'}>
                {c}
              </Badge>
            ))}
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            {profile.address && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                {profile.address}
              </span>
            )}
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              {profile.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  {profile.phone}
                </span>
              )}
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-foreground truncate max-w-[280px]"
                >
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  {profile.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-1 gap-2 text-center md:text-right text-sm">
          <span>
            <strong className="text-emerald-600">{okCount}</strong> ok
          </span>
          {!presentation && (
            <span>
              <strong className="text-amber-500">{attentionCount}</strong> a melhorar
            </span>
          )}
          <span className="text-muted-foreground">
            {format(parseISO(analysis.created_at), "dd/MM/yyyy 'às' HH:mm")}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  const checklistSection = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {presentation ? 'Pontos fortes do perfil' : 'Checklist do perfil'}
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        {visibleChecklist.map((item) => {
          const style = STATUS_STYLE[item.status];
          return (
            <div key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0 break-inside-avoid">
              <style.icon className={cn('w-5 h-5 shrink-0 mt-0.5', style.tone)} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-sm">{item.label}</p>
                  <span className={cn('text-xs font-medium', style.tone)}>{style.label}</span>
                </div>
                <p className="text-sm text-muted-foreground">{item.detail}</p>
                <p className="text-xs text-muted-foreground/80 mt-0.5">{item.why}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );

  const competitorsSection = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          Ranking da região por avaliações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {competitors.total_compared <= 1 ? (
          <p className="text-sm text-muted-foreground">Nenhum concorrente encontrado na região.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Posição</p>
                <p className="text-xl font-semibold">
                  {competitors.position}º <span className="text-sm font-normal">de {competitors.total_compared}</span>
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Média de avaliações dos concorrentes</p>
                <p className="text-xl font-semibold">{competitors.average_reviews}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Nota média dos concorrentes</p>
                <p className="text-xl font-semibold">{competitors.average_rating?.toFixed(1) ?? '—'}</p>
              </div>
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={competitors.ranking} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="title"
                    width={150}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, 'Avaliações']} />
                  <Bar dataKey="reviews" radius={[0, 4, 4, 0]}>
                    {competitors.ranking.map((c) => (
                      <Cell key={c.title} fill={c.is_self ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.45)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-lg border divide-y text-sm">
              {competitors.ranking.map((c, i) => (
                <div key={`${c.title}-${i}`} className={cn('flex items-center gap-3 px-3 py-2', c.is_self && 'bg-primary/5 font-medium')}>
                  <span className="w-6 text-muted-foreground">{c.is_self ? competitors.position : i + 1}º</span>
                  <span className="flex-1 truncate">{c.title}</span>
                  <span className="flex items-center gap-1 w-14">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    {c.rating?.toFixed(1) ?? '—'}
                  </span>
                  <span className="w-24 text-right">{c.reviews} aval.</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );

  const reviewsSection = (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="break-inside-avoid">
          <CardHeader>
            <CardTitle className="text-base">Avaliações nos últimos 12 meses</CardTitle>
          </CardHeader>
          <CardContent className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, 'Avaliações']} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="break-inside-avoid">
          <CardHeader>
            <CardTitle className="text-base">Nota média por mês</CardTitle>
          </CardHeader>
          <CardContent className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis domain={[1, 5]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v?.toFixed(2), 'Nota']} />
                <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} connectNulls dot />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="break-inside-avoid">
          <CardHeader>
            <CardTitle className="text-base">Avaliações por estrelas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {starData.map((s) => (
              <div key={s.star} className="flex items-center gap-3 text-sm">
                <span className="w-8">{s.star}</span>
                <Progress value={reviews.total ? (s.total / reviews.total) * 100 : 0} className="h-2.5 flex-1" />
                <span className="w-20 text-right text-muted-foreground">
                  {s.total} ({reviews.total ? Math.round((s.total / reviews.total) * 100) : 0}%)
                </span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-2">
              Baseado nas {reviews.total} avaliações mais recentes · nota média {reviews.average?.toFixed(2) ?? '—'}
            </p>
          </CardContent>
        </Card>
        <Card className="break-inside-avoid">
          <CardHeader>
            <CardTitle className="text-base">Engajamento das avaliações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Percent label="Respondidas pelo dono" value={reviews.responded_pct} />
            <Percent
              label="Negativas respondidas (1 a 3★)"
              value={reviews.negative_responded_pct}
              hint={`${reviews.negative_total} avaliação(ões) negativa(s)`}
            />
            <Percent label="Com comentário escrito" value={reviews.with_text_pct} />
            <Percent label="Com fotos" value={reviews.with_images_pct} />
            <Percent label="Feitas por Local Guides" value={reviews.local_guides_pct} />
          </CardContent>
        </Card>
      </div>

      <Card className="break-inside-avoid">
        <CardHeader>
          <CardTitle className="text-base">O que os clientes mais falam</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <Words
            title="Avaliações positivas (4 e 5★)"
            words={reviews.words_positive}
            tone="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          />
          <Words
            title="Avaliações negativas (1 a 3★)"
            words={reviews.words_negative}
            tone="bg-red-500/10 text-red-600 dark:text-red-400"
          />
        </CardContent>
      </Card>

      {reviews.by_year.length > 0 && (
        <Card className="break-inside-avoid">
          <CardHeader>
            <CardTitle className="text-base">Média por ano</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {reviews.by_year.map((y) => (
              <div key={y.year} className="rounded-lg border px-4 py-2 text-sm">
                <p className="font-semibold">{y.year}</p>
                <p className="text-muted-foreground">
                  {y.count} aval. · {y.avg.toFixed(1)}★
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {reviews.top_liked.length > 0 && (
        <Card className="break-inside-avoid">
          <CardHeader>
            <CardTitle className="text-base">Avaliações mais votadas como úteis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reviews.top_liked.map((r, i) => (
              <div key={i} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {r.user} · {'★'.repeat(Math.round(r.rating))}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <ThumbsUp className="w-3.5 h-3.5" /> {r.likes}
                  </span>
                </div>
                {r.text && <p className="text-muted-foreground mt-1">{r.text}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );

  const categoriesSection = (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="break-inside-avoid">
        <CardHeader>
          <CardTitle className="text-base">Categorias que os concorrentes usam e o perfil não</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.missing.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma oportunidade clara de categoria.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.missing.map((c) => (
                <Badge key={c.category} variant="outline" className="text-sm py-1">
                  {c.category}
                  <span className="ml-1.5 text-muted-foreground">{c.total} concorrentes</span>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="break-inside-avoid">
        <CardHeader>
          <CardTitle className="text-base">Categorias principais na região</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {categories.primary_ranking.map((c) => (
            <div key={c.category} className="flex items-center justify-between text-sm">
              <span className={cn(categories.own[0] === c.category && 'font-semibold text-primary')}>{c.category}</span>
              <span className="text-muted-foreground">{c.total}</span>
            </div>
          ))}
          {categories.primary_ranking.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
        </CardContent>
      </Card>
      <Card className="break-inside-avoid lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Categorias adicionais mais usadas no segmento</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {categories.additional_ranking.map((c) => (
            <Badge
              key={c.category}
              variant={categories.own.includes(c.category) ? 'default' : 'secondary'}
              className="text-sm py-1"
            >
              {c.category} · {c.total}
            </Badge>
          ))}
          {categories.additional_ranking.length === 0 && (
            <p className="text-sm text-muted-foreground">Os concorrentes não usam categorias adicionais.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const evolutionSection = (
    <Card className="break-inside-avoid">
      <CardHeader>
        <CardTitle className="text-base">Evolução da nota</CardTitle>
      </CardHeader>
      <CardContent className="h-[260px]">
        {evolution.length < 2 ? (
          <p className="text-sm text-muted-foreground">
            Faça uma nova análise deste perfil depois das otimizações para acompanhar a evolução da nota.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolution}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, 'Nota']} />
              <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );

  // Na impressão (PDF) todas as seções saem empilhadas.
  if (printing) {
    return (
      <div className="space-y-4">
        {header}
        {checklistSection}
        {competitorsSection}
        {reviewsSection}
        {categoriesSection}
        {evolution.length >= 2 && evolutionSection}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="h-auto w-full justify-start overflow-x-auto p-1">
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="concorrentes">Concorrentes</TabsTrigger>
          <TabsTrigger value="avaliacoes">Avaliações ({analysis.reviews_analyzed})</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
        </TabsList>
        <TabsContent value="checklist">{checklistSection}</TabsContent>
        <TabsContent value="concorrentes">{competitorsSection}</TabsContent>
        <TabsContent value="avaliacoes">{reviewsSection}</TabsContent>
        <TabsContent value="categorias">{categoriesSection}</TabsContent>
        <TabsContent value="evolucao">{evolutionSection}</TabsContent>
      </Tabs>
    </div>
  );
}
