import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, FileDown, Loader2, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { BILLING_LABELS, Quote, computeQuoteTotals, money, quoteCode } from '@/lib/quotes';

const db = supabase as any;

// Folha A4. Cores fixas (claras) para o PDF sair igual em qualquer tema.
function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="quote-sheet mx-auto bg-white text-slate-900 shadow-lg print:shadow-none w-[210mm] min-h-[297mm] px-[16mm] py-[14mm] flex flex-col">
      {children}
    </div>
  );
}

export default function QuotePrint() {
  const { id } = useParams();
  const { profile, loading: authLoading } = useAuth();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !id) return;
    db.from('quotes')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error: err }: any) => {
        if (err || !data) setError('Orçamento não encontrado ou você não tem acesso a ele.');
        else setQuote(data);
      });
  }, [id, authLoading]);

  useEffect(() => {
    if (quote) document.title = `${quoteCode(quote)} - ${quote.client_name}`;
  }, [quote]);

  if (error) {
    return <div className="p-10 text-center text-sm text-muted-foreground">{error}</div>;
  }
  if (!quote) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totals = computeQuoteTotals(quote.items, quote.discount_type, Number(quote.discount_value), quote.installments);
  const agency = profile?.company_name || 'Proposta comercial';
  const withDescription = quote.items.filter((i) => i.description?.trim());
  const date = (value: string) => format(parseISO(value), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const header = (
    <div className="flex items-start justify-between gap-6 border-b-2 border-emerald-800 pb-5">
      <div className="flex items-center gap-3">
        {profile?.company_logo_url ? (
          <img src={profile.company_logo_url} alt="" className="h-14 w-14 object-contain" />
        ) : (
          <div className="h-12 w-12 rounded-lg bg-emerald-800 flex items-center justify-center">
            <Target className="h-6 w-6 text-white" />
          </div>
        )}
        <div>
          <p className="text-xl font-bold">{agency}</p>
          {profile?.email && <p className="text-xs text-slate-500">{profile.email}</p>}
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">Proposta comercial</p>
        <p className="text-lg font-bold">{quoteCode(quote)}</p>
        <p className="text-xs text-slate-500">{date(quote.created_at)}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-200 py-8 print:bg-white print:py-0">
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          html, body { background: white !important; }
          .quote-sheet { break-after: page; }
          .quote-sheet:last-child { break-after: auto; }
        }
      `}</style>

      <div className="mx-auto mb-6 flex w-[210mm] max-w-full items-center justify-between px-4 print:hidden">
        <Button variant="outline" asChild className="gap-2 bg-white">
          <Link to="/orcamentos">
            <ArrowLeft className="h-4 w-4" />
            Orçamentos
          </Link>
        </Button>
        <Button className="gap-2" onClick={() => window.print()}>
          <FileDown className="h-4 w-4" />
          Salvar PDF
        </Button>
      </div>

      <div className="space-y-8 print:space-y-0">
        <Sheet>
          {header}

          <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Para</p>
              <p className="text-lg font-semibold">{quote.client_name}</p>
            </div>
            {quote.valid_until && (
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-slate-500">Válida até</p>
                <p className="font-semibold">{date(quote.valid_until)}</p>
              </div>
            )}
          </div>

          <table className="mt-8 w-full text-sm">
            <thead>
              <tr className="bg-emerald-800 text-left text-white">
                <th className="px-3 py-2 font-medium">Serviço</th>
                <th className="px-3 py-2 font-medium">Cobrança</th>
                <th className="px-3 py-2 text-center font-medium">Qtd.</th>
                <th className="px-3 py-2 text-right font-medium">Valor unit.</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item, i) => (
                <tr key={i} className="border-b border-slate-200">
                  <td className="px-3 py-2.5 font-medium">{item.title}</td>
                  <td className="px-3 py-2.5 text-slate-600">{BILLING_LABELS[item.billing]}</td>
                  <td className="px-3 py-2.5 text-center">{item.quantity}</td>
                  <td className="px-3 py-2.5 text-right">{money(item.price)}</td>
                  <td className="px-3 py-2.5 text-right font-medium">
                    {money(item.price * item.quantity)}
                    {item.billing === 'mensal' ? '/mês' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 ml-auto w-[90mm] space-y-1.5 text-sm">
            {totals.subtotalMonthly > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Subtotal mensal</span>
                <span>{money(totals.subtotalMonthly)}</span>
              </div>
            )}
            {totals.subtotalOneTime > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Subtotal único</span>
                <span>{money(totals.subtotalOneTime)}</span>
              </div>
            )}
            {totals.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>
                  Desconto
                  {quote.discount_type === 'percent' ? ` (${Number(quote.discount_value)}%)` : ''}
                </span>
                <span>-{money(totals.discountAmount)}</span>
              </div>
            )}
            <div className="mt-2 space-y-2 rounded-lg bg-emerald-50 p-3">
              {totals.totalMonthly > 0 && (
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">Investimento mensal</span>
                  <span className="text-lg font-bold text-emerald-800">{money(totals.totalMonthly)}</span>
                </div>
              )}
              {totals.totalOneTime > 0 && (
                <div>
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium">Investimento único</span>
                    <span className="text-lg font-bold text-emerald-800">{money(totals.totalOneTime)}</span>
                  </div>
                  {totals.installments && (
                    <p className="text-right text-xs text-slate-600">
                      ou {totals.installments}x de {money(totals.installmentValue!)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {quote.notes && (
            <div className="mt-8 rounded-lg border border-slate-200 p-4 text-sm">
              <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Observações</p>
              <p className="whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}

          <p className="mt-auto pt-10 text-center text-xs text-slate-500">
            {withDescription.length > 0 ? 'Detalhes de cada serviço na próxima página · ' : ''}
            {agency}
          </p>
        </Sheet>

        {withDescription.length > 0 && (
          <Sheet>
            {header}
            <h2 className="mt-6 text-lg font-bold">O que está incluso</h2>
            <div className="mt-4 space-y-5">
              {withDescription.map((item, i) => (
                <div key={i} className="break-inside-avoid">
                  <p className="font-semibold text-emerald-800">{item.title}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{item.description}</p>
                </div>
              ))}
            </div>
            <p className="mt-auto pt-10 text-center text-xs text-slate-500">{agency}</p>
          </Sheet>
        )}
      </div>
    </div>
  );
}
