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
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const fu1 = addBusinessDays(base, 1);
  const fu2 = addBusinessDays(fu1, 2);
  const fu3 = addBusinessDays(fu2, 3);
  return {
    follow_up_1: toDateString(fu1),
    follow_up_2: toDateString(fu2),
    follow_up_3: toDateString(fu3),
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

type FollowUpFields = {
  follow_up_1: string | null;
  follow_up_2: string | null;
  follow_up_3: string | null;
};

/**
 * Alterações no lead ao concluir o follow-up de hoje: registra o contato,
 * limpa a etapa concluída e agenda a próxima a partir de hoje.
 * Com includeOverdue, etapas atrasadas também contam como concluídas.
 */
export function buildFollowUpCompletion(
  lead: FollowUpFields,
  today: Date = new Date(),
  includeOverdue = false,
): FollowUpFields & { last_contact: string } {
  const todayStr = toDateString(today);
  const matches = (date: string | null) =>
    Boolean(date) && (date!.slice(0, 10) === todayStr || (includeOverdue && date!.slice(0, 10) < todayStr));

  const updates = {
    last_contact: todayStr,
    follow_up_1: lead.follow_up_1,
    follow_up_2: lead.follow_up_2,
    follow_up_3: lead.follow_up_3,
  };

  // Follow-up 1 concluído: limpa e recalcula o 2 a partir de hoje
  if (matches(lead.follow_up_1)) {
    updates.follow_up_1 = null;
    updates.follow_up_2 = generateNextFollowUpFromContact(today, 2);
  }
  // Follow-up 2 concluído: limpa e recalcula o 3 a partir de hoje
  if (matches(lead.follow_up_2)) {
    updates.follow_up_2 = null;
    updates.follow_up_3 = generateNextFollowUpFromContact(today, 3);
  }
  // Follow-up 3 concluído: apenas limpa
  if (matches(lead.follow_up_3)) {
    updates.follow_up_3 = null;
  }

  return updates;
}
