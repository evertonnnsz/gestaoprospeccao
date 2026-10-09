// Gera o relatório de anúncios em texto formatado para WhatsApp (*negrito*, _itálico_ e emojis).

type ReportMetrics = {
  investimento: number;
  impressoes: number;
  alcance: number | null;
  frequencia: number | null;
  cliques: number;
  cpc: number | null;
  cpm: number | null;
  ctr: number | null;
  resultado: number | null;
  resultado_label: string;
  custo_por_resultado: number | null;
};

type ReportCampaign = {
  name: string;
  investimento: number;
  resultado: number | null;
  resultado_label: string;
  custo_por_resultado: number | null;
};

type ReportCreative = {
  ad_name: string;
  campaign_name: string;
  investimento: number;
  impressoes: number;
  cliques: number;
  resultado: number | null;
  resultado_label: string;
  custo_por_resultado: number | null;
  is_video: boolean;
};

type ReportInput = {
  clientName: string;
  periodLabel: string | null;
  campaignName?: string | null;
  account: ReportMetrics;
  campaigns: ReportCampaign[];
  bestCreative: ReportCreative | null;
};

const SEPARATOR = '━━━━━━━━━━━━━━━';

const money = (value?: number | null) =>
  value === null || value === undefined
    ? '—'
    : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const num = (value?: number | null, digits = 0) =>
  value === null || value === undefined
    ? '—'
    : value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const pct = (value?: number | null) => (value === null || value === undefined ? '—' : `${num(value, 2)}%`);

function metric(emoji: string, label: string, value: string, meaning: string) {
  return `${emoji} *${label}:* ${value}\n_${meaning}_`;
}

function winnerReasons(creative: ReportCreative, account: ReportMetrics): string[] {
  const reasons: string[] = [];
  const label = creative.resultado_label.toLowerCase();

  if (creative.custo_por_resultado !== null) {
    reasons.push(`Teve o *menor custo por resultado* entre todos os anúncios: ${money(creative.custo_por_resultado)} cada.`);
  }

  if (
    creative.custo_por_resultado !== null &&
    account.custo_por_resultado &&
    creative.custo_por_resultado < account.custo_por_resultado
  ) {
    const saving = (1 - creative.custo_por_resultado / account.custo_por_resultado) * 100;
    reasons.push(`Saiu *${num(saving, 0)}% mais barato* que a média geral (${money(account.custo_por_resultado)}).`);
  }

  if (creative.resultado && account.resultado && account.resultado > 0) {
    const share = (creative.resultado / account.resultado) * 100;
    reasons.push(`Sozinho trouxe *${num(creative.resultado)} de ${num(account.resultado)}* ${label} (${num(share, 0)}% do total).`);
  }

  const creativeCtr = creative.impressoes > 0 ? (creative.cliques / creative.impressoes) * 100 : null;
  if (creativeCtr !== null && account.ctr !== null && creativeCtr > account.ctr) {
    reasons.push(`CTR de *${pct(creativeCtr)}*, acima da média de ${pct(account.ctr)}: chamou mais atenção e gerou mais cliques.`);
  }

  return reasons;
}

export function buildAdsReportText({
  clientName,
  periodLabel,
  campaignName,
  account,
  campaigns,
  bestCreative,
}: ReportInput): string {
  const resultLabel = account.resultado_label || 'Resultados';
  const lines: string[] = [];

  lines.push(`📊 *RELATÓRIO DE ANÚNCIOS*`);
  lines.push(`🏢 *${clientName}*`);
  if (periodLabel) lines.push(`🗓️ Período: ${periodLabel}`);
  if (campaignName) lines.push(`📌 Campanha: ${campaignName}`);
  lines.push('');
  lines.push(`Olá! 👋 Segue o resumo dos resultados das campanhas no Facebook e Instagram:`);
  lines.push('');

  lines.push(SEPARATOR);
  lines.push(`🎯 *RESULTADO PRINCIPAL*`);
  lines.push(SEPARATOR);
  lines.push(metric('✅', resultLabel, num(account.resultado), 'O principal objetivo das campanhas, o que realmente importa.'));
  lines.push('');
  lines.push(
    metric(
      '🏷️',
      'Custo por resultado',
      money(account.custo_por_resultado),
      'Quanto custou, em média, cada resultado. Quanto menor, melhor.',
    ),
  );
  lines.push('');
  lines.push(metric('💰', 'Investimento', money(account.investimento), 'Valor total investido nos anúncios no período.'));
  lines.push('');

  lines.push(SEPARATOR);
  lines.push(`📣 *ALCANCE E VISIBILIDADE*`);
  lines.push(SEPARATOR);
  lines.push(metric('👥', 'Alcance', num(account.alcance), 'Quantas pessoas diferentes viram os anúncios.'));
  lines.push('');
  lines.push(metric('👀', 'Impressões', num(account.impressoes), 'Quantas vezes os anúncios apareceram na tela.'));
  lines.push('');
  lines.push(metric('🔁', 'Frequência', num(account.frequencia, 2), 'Média de vezes que cada pessoa viu o anúncio.'));
  lines.push('');
  lines.push(metric('📢', 'CPM', money(account.cpm), 'Custo para o anúncio aparecer 1.000 vezes.'));
  lines.push('');

  lines.push(SEPARATOR);
  lines.push(`🖱️ *INTERESSE DO PÚBLICO*`);
  lines.push(SEPARATOR);
  lines.push(metric('👆', 'Cliques', num(account.cliques), 'Quantas vezes as pessoas clicaram nos anúncios.'));
  lines.push('');
  lines.push(
    metric('📈', 'CTR (taxa de cliques)', pct(account.ctr), 'De cada 100 pessoas que viram, quantas clicaram. Quanto maior, mais o anúncio chama atenção.'),
  );
  lines.push('');
  lines.push(metric('💸', 'CPC', money(account.cpc), 'Custo médio de cada clique.'));
  lines.push('');

  if (bestCreative) {
    lines.push(SEPARATOR);
    lines.push(`🏆 *CRIATIVO CAMPEÃO*`);
    lines.push(SEPARATOR);
    lines.push(`${bestCreative.is_video ? '🎬' : '🖼️'} *${bestCreative.ad_name}*`);
    lines.push(`_Campanha: ${bestCreative.campaign_name}_`);
    lines.push('');
    lines.push(`• ${bestCreative.resultado_label}: *${num(bestCreative.resultado)}*`);
    lines.push(`• Custo por resultado: *${money(bestCreative.custo_por_resultado)}*`);
    lines.push(`• Investimento: ${money(bestCreative.investimento)}`);
    lines.push(`• Impressões: ${num(bestCreative.impressoes)} · Cliques: ${num(bestCreative.cliques)}`);

    const reasons = winnerReasons(bestCreative, account);
    if (reasons.length > 0) {
      lines.push('');
      lines.push(`💡 *Por que ele foi o campeão?*`);
      reasons.forEach((reason) => lines.push(`✔️ ${reason}`));
    }
    lines.push('');
  }

  const topCampaigns = campaigns.filter((c) => c.investimento > 0).slice(0, 3);
  if (!campaignName && topCampaigns.length > 1) {
    lines.push(SEPARATOR);
    lines.push(`📋 *DESTAQUE POR CAMPANHA*`);
    lines.push(SEPARATOR);
    topCampaigns.forEach((c) => {
      lines.push(`▫️ *${c.name}*`);
      lines.push(`   ${money(c.investimento)} investidos · ${num(c.resultado)} ${c.resultado_label.toLowerCase()} · ${money(c.custo_por_resultado)} cada`);
    });
    lines.push('');
  }

  lines.push(`🚀 Seguimos acompanhando e otimizando as campanhas para trazer cada vez mais resultados!`);
  lines.push(`Qualquer dúvida, estamos à disposição. 🤝`);

  return lines.join('\n');
}
