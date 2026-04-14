/**
 * Calcula a próxima data útil (seg-sex) a partir de uma data base,
 * pulando N dias úteis.
 */
function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) {
      added++;
    }
  }
  return result;
}

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * Gera as datas de follow-up automáticas (próximos 3 dias úteis).
 */
export function generateFollowUpDates(baseDate?: Date): {
  follow_up_1: string;
  follow_up_2: string;
  follow_up_3: string;
} {
  const base = baseDate || new Date();
  return {
    follow_up_1: toDateString(addBusinessDays(base, 1)),
    follow_up_2: toDateString(addBusinessDays(base, 2)),
    follow_up_3: toDateString(addBusinessDays(base, 3)),
  };
}

/**
 * Calcula o próximo follow-up com base na data do último contato.
 * Follow-up 2: +2 dias úteis a partir do contato
 * Follow-up 3: +3 dias úteis a partir do contato
 */
export function generateNextFollowUpFromContact(
  contactDate: Date,
  followUpNumber: 2 | 3
): string {
  return toDateString(addBusinessDays(contactDate, followUpNumber));
}
