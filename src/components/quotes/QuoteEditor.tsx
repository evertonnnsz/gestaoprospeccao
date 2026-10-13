import { useEffect, useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { Minus, Plus, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  BILLING_LABELS,
  DiscountType,
  Quote,
  QuoteItem,
  Service,
  computeQuoteTotals,
  money,
} from '@/lib/quotes';

export type QuoteDraft = Omit<Quote, 'id' | 'number' | 'created_at' | 'status' | 'total_monthly' | 'total_one_time'>;

export type LeadOption = { id: string; name: string; kind: 'lead' | 'client' };

const VALIDITY_DAYS = 15;

const emptyDraft = (): QuoteDraft => ({
  lead_id: null,
  client_id: null,
  client_name: '',
  items: [],
  discount_type: 'percent',
  discount_value: 0,
  installments: null,
  valid_until: format(addDays(new Date(), VALIDITY_DAYS), 'yyyy-MM-dd'),
  notes: '',
});

export function QuoteEditor({
  open,
  onOpenChange,
  services,
  contacts,
  initial,
  editing = false,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: Service[];
  contacts: LeadOption[];
  initial: Partial<QuoteDraft> | null;
  editing?: boolean;
  onSave: (draft: QuoteDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<QuoteDraft>(emptyDraft);
  const [contactSearch, setContactSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft({ ...emptyDraft(), ...(initial || {}) });
    setContactSearch('');
  }, [open, initial]);

  const totals = useMemo(
    () => computeQuoteTotals(draft.items, draft.discount_type, draft.discount_value, draft.installments),
    [draft],
  );

  const matches = useMemo(() => {
    const term = contactSearch.trim().toLowerCase();
    if (term.length < 2) return [];
    return contacts.filter((c) => c.name.toLowerCase().includes(term)).slice(0, 8);
  }, [contacts, contactSearch]);

  const update = (patch: Partial<QuoteDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const addService = (service: Service) => {
    setDraft((d) => {
      const existing = d.items.findIndex((i) => i.service_id === service.id);
      if (existing >= 0) {
        const items = [...d.items];
        items[existing] = { ...items[existing], quantity: items[existing].quantity + 1 };
        return { ...d, items };
      }
      const item: QuoteItem = {
        service_id: service.id,
        title: service.title,
        description: service.description,
        price: Number(service.price),
        quantity: 1,
        billing: service.billing,
      };
      return { ...d, items: [...d.items, item] };
    });
  };

  const updateItem = (index: number, patch: Partial<QuoteItem>) =>
    setDraft((d) => ({ ...d, items: d.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) }));

  const removeItem = (index: number) => setDraft((d) => ({ ...d, items: d.items.filter((_, i) => i !== index) }));

  const activeServices = services.filter((s) => s.active);
  const canSave = draft.client_name.trim().length > 0 && draft.items.length > 0;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar orçamento' : 'Novo orçamento'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Cliente */}
          <div className="space-y-2">
            <Label htmlFor="quote-client">Cliente</Label>
            {draft.lead_id || draft.client_id ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>
                  <strong>{draft.client_name}</strong>{' '}
                  <span className="text-muted-foreground">({draft.client_id ? 'cliente' : 'lead'})</span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => update({ lead_id: null, client_id: null, client_name: '' })}
                  aria-label="Trocar cliente"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-3 text-muted-foreground" />
                <Input
                  id="quote-client"
                  className="pl-8"
                  value={draft.client_name}
                  onChange={(e) => {
                    update({ client_name: e.target.value });
                    setContactSearch(e.target.value);
                  }}
                  placeholder="Busque um lead/cliente ou digite o nome"
                />
                {matches.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                    {matches.map((c) => (
                      <button
                        key={`${c.kind}-${c.id}`}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          update({
                            client_name: c.name,
                            lead_id: c.kind === 'lead' ? c.id : null,
                            client_id: c.kind === 'client' ? c.id : null,
                          });
                          setContactSearch('');
                        }}
                      >
                        {c.name}
                        <span className="text-xs text-muted-foreground">{c.kind === 'client' ? 'Cliente' : 'Lead'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Serviços */}
          <div className="space-y-2">
            <Label>Serviços</Label>
            {activeServices.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
                Nenhum serviço ativo. Cadastre seus serviços na aba "Serviços" primeiro.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {activeServices.map((s) => (
                  <Button key={s.id} variant="outline" size="sm" className="gap-1.5" onClick={() => addService(s)}>
                    <Plus className="w-3.5 h-3.5" />
                    {s.title}
                    <span className="text-muted-foreground">
                      {money(Number(s.price))}
                      {s.billing === 'mensal' ? '/mês' : ''}
                    </span>
                  </Button>
                ))}
              </div>
            )}

            {draft.items.length > 0 && (
              <div className="rounded-lg border divide-y">
                {draft.items.map((item, index) => (
                  <div key={`${item.service_id}-${index}`} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_110px_120px_auto] gap-2 items-center p-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{BILLING_LABELS[item.billing]}</p>
                    </div>
                    <div className="flex items-center gap-1 order-3 sm:order-none">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateItem(index, { quantity: Math.max(1, item.quantity - 1) })}
                        aria-label="Diminuir quantidade"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </Button>
                      <span className="w-7 text-center text-sm">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateItem(index, { quantity: item.quantity + 1 })}
                        aria-label="Aumentar quantidade"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.price}
                      onChange={(e) => updateItem(index, { price: Number(e.target.value) || 0 })}
                      className="h-8 order-4 sm:order-none"
                      aria-label="Preço unitário"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(index)}
                      aria-label="Remover serviço"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Condições */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Desconto</Label>
              <div className="flex gap-2">
                <Select
                  value={draft.discount_type}
                  onValueChange={(v) => update({ discount_type: v as DiscountType })}
                >
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">%</SelectItem>
                    <SelectItem value="value">R$</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.discount_value}
                  onChange={(e) => update({ discount_value: Number(e.target.value) || 0 })}
                  aria-label="Valor do desconto"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center justify-between">
                Parcelar valor único
                <Switch
                  checked={draft.installments !== null}
                  onCheckedChange={(on) => update({ installments: on ? 3 : null })}
                />
              </Label>
              <Select
                value={String(draft.installments ?? '')}
                onValueChange={(v) => update({ installments: Number(v) })}
                disabled={draft.installments === null}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem parcelamento" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quote-valid">Válido até</Label>
              <Input
                id="quote-valid"
                type="date"
                value={draft.valid_until || ''}
                onChange={(e) => update({ valid_until: e.target.value || null })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quote-notes">Observações (aparece no PDF)</Label>
            <Textarea
              id="quote-notes"
              value={draft.notes || ''}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="Ex.: Investimento em anúncios não incluso, pago direto à Meta/Google."
            />
          </div>

          {/* Resumo */}
          <div className="rounded-lg bg-muted/40 p-4 space-y-1.5 text-sm">
            {totals.discountAmount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Desconto</span>
                <span>-{money(totals.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Investimento mensal</span>
              <strong>{money(totals.totalMonthly)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Investimento único</span>
              <strong>
                {money(totals.totalOneTime)}
                {totals.installments && (
                  <span className="font-normal text-muted-foreground">
                    {' '}
                    ou {totals.installments}x de {money(totals.installmentValue!)}
                  </span>
                )}
              </strong>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!canSave || saving} className={cn(saving && 'opacity-70')}>
            {saving ? 'Salvando...' : 'Salvar orçamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
