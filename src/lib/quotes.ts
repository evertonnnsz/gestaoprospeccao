// Cálculos e textos do orçamento. Sem dependências de React/Supabase para poder ser testado isolado.

export type Billing = 'mensal' | 'unico';
export type DiscountType = 'percent' | 'value';
export type QuoteStatus = 'rascunho' | 'enviado' | 'aprovado' | 'recusado';

export type Service = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  billing: Billing;
  active: boolean;
};

export type QuoteItem = {
  service_id: string | null;
  title: string;
  description: string | null;
  price: number;
  quantity: number;
  billing: Billing;
};

export type Quote = {
  id: string;
  number: number;
  lead_id: string | null;
  client_id: string | null;
  client_name: string;
  items: QuoteItem[];
  discount_type: DiscountType;
  discount_value: number;
  installments: number | null;
  valid_until: string | null;
  notes: string | null;
  status: QuoteStatus;
  total_monthly: number;
  total_one_time: number;
  created_at: string;
};

export const STATUS_LABELS: Record<QuoteStatus, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
};

export const BILLING_LABELS: Record<Billing, string> = {
  mensal: 'Mensal',
  unico: 'Valor único',
};

export const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const quoteCode = (quote: Pick<Quote, 'number' | 'created_at'>) =>
  `ORC-${quote.created_at.slice(0, 4)}-${String(quote.number).padStart(4, '0')}`;

const round = (value: number) => Math.round(value * 100) / 100;

export function computeQuoteTotals(
  items: QuoteItem[],
  discountType: DiscountType,
  discountValue: number,
  installments: number | null,
) {
  const sum = (billing: Billing) =>
    round(items.filter((i) => i.billing === billing).reduce((s, i) => s + i.price * i.quantity, 0));
  const subtotalMonthly = sum('mensal');
  const subtotalOneTime = sum('unico');
  const subtotal = subtotalMonthly + subtotalOneTime;

  // Desconto em % vale para os dois grupos; em R$ é dividido proporcionalmente entre eles.
  const ratio =
    subtotal <= 0
      ? 0
      : discountType === 'percent'
        ? Math.min(Math.max(discountValue, 0), 100) / 100
        : Math.min(Math.max(discountValue, 0), subtotal) / subtotal;

  const totalMonthly = round(subtotalMonthly * (1 - ratio));
  const totalOneTime = round(subtotalOneTime * (1 - ratio));
  const discountAmount = round(subtotal - totalMonthly - totalOneTime);

  // Parcelamento só se aplica ao valor único.
  const parcels = installments && installments >= 2 && totalOneTime > 0 ? installments : null;

  return {
    subtotalMonthly,
    subtotalOneTime,
    discountAmount,
    totalMonthly,
    totalOneTime,
    installments: parcels,
    installmentValue: parcels ? round(totalOneTime / parcels) : null,
  };
}

export function buildQuoteWhatsAppText(quote: Quote, agencyName: string) {
  const totals = computeQuoteTotals(quote.items, quote.discount_type, quote.discount_value, quote.installments);
  const lines: string[] = [];
  lines.push(`📄 *Orçamento ${quoteCode(quote)}*`);
  lines.push(`Olá, ${quote.client_name}! 👋 Segue a proposta da ${agencyName}:`);
  lines.push('');
  quote.items.forEach((item) => {
    const qty = item.quantity > 1 ? `${item.quantity}x ` : '';
    const suffix = item.billing === 'mensal' ? '/mês' : '';
    lines.push(`✅ ${qty}*${item.title}*: ${money(item.price * item.quantity)}${suffix}`);
  });
  lines.push('');
  if (totals.discountAmount > 0) lines.push(`🎁 Desconto: -${money(totals.discountAmount)}`);
  if (totals.totalMonthly > 0) lines.push(`💰 *Investimento mensal: ${money(totals.totalMonthly)}*`);
  if (totals.totalOneTime > 0) {
    lines.push(
      `💳 *Investimento único: ${money(totals.totalOneTime)}*${
        totals.installments ? ` (ou ${totals.installments}x de ${money(totals.installmentValue!)})` : ''
      }`,
    );
  }
  if (quote.valid_until) {
    const [y, m, d] = quote.valid_until.split('-');
    lines.push(`📅 Válido até ${d}/${m}/${y}`);
  }
  if (quote.notes) {
    lines.push('');
    lines.push(quote.notes);
  }
  lines.push('');
  lines.push('Qualquer dúvida, estou à disposição! 🤝');
  return lines.join('\n');
}
