import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Copy, FileDown, FileText, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAllRows } from '@/lib/supabaseFetch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { LeadOption, QuoteDraft, QuoteEditor } from '@/components/quotes/QuoteEditor';
import {
  BILLING_LABELS,
  Billing,
  Quote,
  QuoteStatus,
  STATUS_LABELS,
  Service,
  buildQuoteWhatsAppText,
  computeQuoteTotals,
  money,
  quoteCode,
} from '@/lib/quotes';

// services e quotes ainda não estão nos tipos gerados do Supabase.
const db = supabase as any;

const STATUS_STYLE: Record<QuoteStatus, string> = {
  rascunho: 'bg-muted text-muted-foreground',
  enviado: 'bg-accent text-accent-foreground',
  aprovado: 'bg-success/10 text-success',
  recusado: 'bg-destructive/10 text-destructive',
};

const isMissingTable = (error: any) => error?.code === '42P01' || error?.code === 'PGRST205';

type ServiceForm = { id?: string; title: string; description: string; price: string; billing: Billing; active: boolean };
const emptyService: ServiceForm = { title: '', description: '', price: '', billing: 'mensal', active: true };

export default function Quotes() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState('orcamentos');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [contacts, setContacts] = useState<LeadOption[]>([]);
  const [tableMissing, setTableMissing] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [initialDraft, setInitialDraft] = useState<Partial<QuoteDraft> | null>(null);

  const [serviceForm, setServiceForm] = useState<ServiceForm | null>(null);

  const agencyName = profile?.company_name || 'nossa agência';

  useEffect(() => {
    const load = async () => {
      const [quotesRes, servicesRes, leads, clientsRes] = await Promise.all([
        db.from('quotes').select('*').order('created_at', { ascending: false }),
        db.from('services').select('*').order('title'),
        fetchAllRows<{ id: string; company_name: string }>('leads', { select: 'id, company_name' }),
        supabase.from('clients').select('id, lead:leads(company_name)'),
      ]);
      setTableMissing(isMissingTable(quotesRes.error) || isMissingTable(servicesRes.error));
      setQuotes(quotesRes.data || []);
      setServices((servicesRes.data || []).map((s: Service) => ({ ...s, price: Number(s.price) })));
      setContacts([
        ...((clientsRes.data || []) as any[]).map((c) => ({
          id: c.id,
          name: c.lead?.company_name || 'Cliente',
          kind: 'client' as const,
        })),
        ...leads.map((l) => ({ id: l.id, name: l.company_name, kind: 'lead' as const })),
      ]);
    };
    load();
  }, []);

  // Vindo do card do lead: abre um orçamento novo já com o lead selecionado.
  useEffect(() => {
    const leadId = searchParams.get('lead');
    const clientId = searchParams.get('client');
    if (!leadId && !clientId) return;
    const name = searchParams.get('nome') || '';
    setEditing(null);
    setInitialDraft({ lead_id: leadId, client_id: clientId, client_name: name });
    setEditorOpen(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const fail = (title: string, error: any) =>
    toast({
      title,
      description: tableMissing ? 'Falta aplicar no Lovable a atualização de banco de serviços e orçamentos.' : error?.message,
      variant: 'destructive',
    });

  // ---------- Orçamentos ----------

  const openNew = () => {
    setEditing(null);
    setInitialDraft(null);
    setEditorOpen(true);
  };

  const openEdit = (quote: Quote) => {
    setEditing(quote);
    setInitialDraft({
      lead_id: quote.lead_id,
      client_id: quote.client_id,
      client_name: quote.client_name,
      items: quote.items,
      discount_type: quote.discount_type,
      discount_value: Number(quote.discount_value),
      installments: quote.installments,
      valid_until: quote.valid_until,
      notes: quote.notes,
    });
    setEditorOpen(true);
  };

  const saveQuote = async (draft: QuoteDraft) => {
    if (!user) return;
    const totals = computeQuoteTotals(draft.items, draft.discount_type, draft.discount_value, draft.installments);
    const payload = {
      ...draft,
      client_name: draft.client_name.trim(),
      notes: draft.notes?.trim() || null,
      total_monthly: totals.totalMonthly,
      total_one_time: totals.totalOneTime,
    };
    const query = editing
      ? db.from('quotes').update(payload).eq('id', editing.id)
      : db.from('quotes').insert({ ...payload, user_id: user.id });
    const { data, error } = await query.select().single();
    if (error) {
      fail('Não foi possível salvar o orçamento', error);
      return;
    }
    setQuotes((current) => [data, ...current.filter((q) => q.id !== data.id)]);
    setEditorOpen(false);
    toast({ title: editing ? 'Orçamento atualizado' : 'Orçamento criado', description: quoteCode(data) });
  };

  const setStatus = async (quote: Quote, status: QuoteStatus) => {
    const { error } = await db.from('quotes').update({ status }).eq('id', quote.id);
    if (error) return fail('Não foi possível atualizar', error);
    setQuotes((current) => current.map((q) => (q.id === quote.id ? { ...q, status } : q)));
  };

  const removeQuote = async (quote: Quote) => {
    const { error } = await db.from('quotes').delete().eq('id', quote.id);
    if (error) return fail('Não foi possível excluir', error);
    setQuotes((current) => current.filter((q) => q.id !== quote.id));
  };

  const copyWhatsApp = async (quote: Quote) => {
    const text = buildQuoteWhatsAppText(quote, agencyName);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    toast({ title: 'Texto copiado', description: 'Cole no WhatsApp do cliente junto com o PDF.' });
    if (quote.status === 'rascunho') setStatus(quote, 'enviado');
  };

  // ---------- Serviços ----------

  const saveService = async () => {
    if (!user || !serviceForm || !serviceForm.title.trim()) return;
    const payload = {
      title: serviceForm.title.trim(),
      description: serviceForm.description.trim() || null,
      price: Number(serviceForm.price.replace(',', '.')) || 0,
      billing: serviceForm.billing,
      active: serviceForm.active,
    };
    const query = serviceForm.id
      ? db.from('services').update(payload).eq('id', serviceForm.id)
      : db.from('services').insert({ ...payload, user_id: user.id });
    const { data, error } = await query.select().single();
    if (error) return fail('Não foi possível salvar o serviço', error);
    const saved = { ...data, price: Number(data.price) };
    setServices((current) =>
      [...current.filter((s) => s.id !== saved.id), saved].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')),
    );
    setServiceForm(null);
  };

  const toggleService = async (service: Service) => {
    const { error } = await db.from('services').update({ active: !service.active }).eq('id', service.id);
    if (error) return fail('Não foi possível atualizar', error);
    setServices((current) => current.map((s) => (s.id === service.id ? { ...s, active: !s.active } : s)));
  };

  const removeService = async (service: Service) => {
    const { error } = await db.from('services').delete().eq('id', service.id);
    if (error) return fail('Não foi possível excluir', error);
    setServices((current) => current.filter((s) => s.id !== service.id));
  };

  const summary = useMemo(() => {
    const approved = quotes.filter((q) => q.status === 'aprovado');
    return {
      total: quotes.length,
      open: quotes.filter((q) => q.status === 'enviado').length,
      approved: approved.length,
      approvedMonthly: approved.reduce((s, q) => s + Number(q.total_monthly), 0),
    };
  }, [quotes]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Orçamentos
          </h1>
          <p className="text-sm text-muted-foreground">Monte propostas com seus serviços e envie em PDF para o cliente.</p>
        </div>
        {tab === 'orcamentos' ? (
          <Button className="gap-2" onClick={openNew}>
            <Plus className="w-4 h-4" />
            Novo orçamento
          </Button>
        ) : (
          <Button className="gap-2" onClick={() => setServiceForm({ ...emptyService })}>
            <Plus className="w-4 h-4" />
            Novo serviço
          </Button>
        )}
      </div>

      {tableMissing && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="pt-6 text-sm">
            Falta aplicar no Lovable a atualização de banco <code className="text-xs">services_quotes</code> para salvar
            serviços e orçamentos.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Orçamentos', value: String(summary.total) },
          { label: 'Aguardando resposta', value: String(summary.open) },
          { label: 'Aprovados', value: String(summary.approved) },
          { label: 'Mensal aprovado', value: money(summary.approvedMonthly) },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-semibold mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="orcamentos">Orçamentos</TabsTrigger>
          <TabsTrigger value="servicos">Serviços ({services.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="orcamentos">
          <Card>
            <CardContent className="pt-6">
              {quotes.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {services.length === 0
                      ? 'Comece cadastrando seus serviços na aba "Serviços".'
                      : 'Nenhum orçamento ainda.'}
                  </p>
                  <Button variant="outline" onClick={services.length === 0 ? () => setTab('servicos') : openNew}>
                    {services.length === 0 ? 'Cadastrar serviços' : 'Criar o primeiro orçamento'}
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {quotes.map((q) => {
                    const totals = computeQuoteTotals(q.items, q.discount_type, Number(q.discount_value), q.installments);
                    return (
                      <div key={q.id} className="flex flex-wrap items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">
                            {q.client_name}
                            <span className="ml-2 text-xs font-normal text-muted-foreground">{quoteCode(q)}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(q.created_at), 'dd/MM/yyyy')} · {q.items.length} serviço(s)
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          {totals.totalMonthly > 0 && <p className="font-semibold">{money(totals.totalMonthly)}/mês</p>}
                          {totals.totalOneTime > 0 && (
                            <p className="text-muted-foreground">+ {money(totals.totalOneTime)} único</p>
                          )}
                        </div>
                        <Badge variant="secondary" className={cn('w-[92px] justify-center', STATUS_STYLE[q.status])}>
                          {STATUS_LABELS[q.status]}
                        </Badge>
                        <div className="flex items-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(`/orcamentos/${q.id}/pdf`, '_blank')}
                            aria-label="Abrir PDF"
                          >
                            <FileDown className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-success"
                            onClick={() => copyWhatsApp(q)}
                            aria-label="Copiar texto para WhatsApp"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Mais ações">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(q)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              {q.lead_id && (
                                <DropdownMenuItem onClick={() => navigate('/leads')}>Ver lead</DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs text-muted-foreground">Status</DropdownMenuLabel>
                              {(Object.keys(STATUS_LABELS) as QuoteStatus[])
                                .filter((s) => s !== q.status)
                                .map((s) => (
                                  <DropdownMenuItem key={s} onClick={() => setStatus(q, s)}>
                                    Marcar como {STATUS_LABELS[s].toLowerCase()}
                                  </DropdownMenuItem>
                                ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => removeQuote(q)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="servicos">
          <Card>
            <CardContent className="pt-6">
              {services.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  Cadastre os serviços que você vende (ex.: Gestão de Tráfego, Otimização do Google Meu Negócio).
                </p>
              ) : (
                <div className="divide-y">
                  {services.map((s) => (
                    <div key={s.id} className={cn('flex items-center gap-3 py-3', !s.active && 'opacity-60')}>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{s.title}</p>
                        {s.description && <p className="text-xs text-muted-foreground line-clamp-1">{s.description}</p>}
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-semibold">{money(Number(s.price))}</p>
                        <p className="text-xs text-muted-foreground">{BILLING_LABELS[s.billing]}</p>
                      </div>
                      <Switch checked={s.active} onCheckedChange={() => toggleService(s)} aria-label="Serviço ativo" />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          setServiceForm({
                            id: s.id,
                            title: s.title,
                            description: s.description || '',
                            price: String(s.price),
                            billing: s.billing,
                            active: s.active,
                          })
                        }
                        aria-label="Editar serviço"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeService(s)}
                        aria-label="Excluir serviço"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <QuoteEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        services={services}
        contacts={contacts}
        initial={initialDraft}
        editing={Boolean(editing)}
        onSave={saveQuote}
      />

      <Dialog open={Boolean(serviceForm)} onOpenChange={(open) => !open && setServiceForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{serviceForm?.id ? 'Editar serviço' : 'Novo serviço'}</DialogTitle>
          </DialogHeader>
          {serviceForm && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="service-title">Nome do serviço</Label>
                <Input
                  id="service-title"
                  autoFocus
                  value={serviceForm.title}
                  onChange={(e) => setServiceForm({ ...serviceForm, title: e.target.value })}
                  placeholder="Ex.: Gestão de Tráfego Pago"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="service-price">Preço (R$)</Label>
                  <Input
                    id="service-price"
                    inputMode="decimal"
                    value={serviceForm.price}
                    onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                    placeholder="1500,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cobrança</Label>
                  <Select
                    value={serviceForm.billing}
                    onValueChange={(v) => setServiceForm({ ...serviceForm, billing: v as Billing })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="unico">Valor único</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-description">Descrição (vai na 2ª página do PDF)</Label>
                <Textarea
                  id="service-description"
                  rows={5}
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                  placeholder="O que está incluso, entregáveis, frequência de relatórios..."
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={serviceForm.active}
                  onCheckedChange={(active) => setServiceForm({ ...serviceForm, active })}
                />
                Ativo (aparece ao montar orçamentos)
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceForm(null)}>
              Cancelar
            </Button>
            <Button onClick={saveService} disabled={!serviceForm?.title.trim()}>
              Salvar serviço
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
