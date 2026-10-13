import QRCode from 'qrcode';

// Desenha o cartão de avaliação em um <canvas> (sem dependência de HTML -> imagem),
// para baixar como PNG nos formatos digital e impressão.

export type CardFormat = 'digital' | 'impressao';

export type CardOptions = {
  format: CardFormat;
  businessName: string;
  headline: string;
  subtitle: string;
  reviewUrl: string;
  backgroundColor: string;
  backgroundImage: string | null;
  overlayOpacity: number; // 0 a 1, cor de fundo por cima da imagem
  accentColor: string;
  logo: string | null;
};

export const CARD_SIZES: Record<CardFormat, { width: number; height: number; label: string }> = {
  digital: { width: 1080, height: 1350, label: 'Digital' },
  // 10 x 15 cm em ~300 dpi
  impressao: { width: 1181, height: 1772, label: 'Impressão 10x15' },
};

export const reviewUrlFromPlaceId = (placeId: string) =>
  `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;

const FONT = 'Inter, "Segoe UI", Arial, sans-serif';

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// Texto escuro ou claro conforme o fundo.
export function readableTextColor(hex: string) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.6 ? '#111827' : '#ffffff';
}

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Quebra o texto em até maxLines linhas que caibam na largura.
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else {
      lines.push(line);
      line = word;
    }
  });
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/\s+\S*$/, '')}…`;
    return kept;
  }
  return lines;
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, color: string) {
  const inner = outer * 0.45;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export async function drawReviewCard(canvas: HTMLCanvasElement, options: CardOptions) {
  const { width: W, height: H } = CARD_SIZES[options.format];
  canvas.width = W;
  canvas.height = H;
  const main = canvas.getContext('2d')!;
  // Conteúdo é desenhado numa camada separada para depois ser centralizado na vertical.
  const layer = document.createElement('canvas');
  layer.width = W;
  layer.height = H;
  const ctx = layer.getContext('2d')!;
  const s = W / 1080; // escala base
  const textColor = readableTextColor(options.backgroundColor);
  const center = W / 2;

  // Fundo
  main.fillStyle = options.backgroundColor;
  main.fillRect(0, 0, W, H);
  if (options.backgroundImage) {
    try {
      const img = await loadImage(options.backgroundImage);
      const ratio = Math.max(W / img.width, H / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      main.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      main.fillStyle = hexToRgba(options.backgroundColor, options.overlayOpacity);
      main.fillRect(0, 0, W, H);
    } catch {
      // Imagem inválida: fica só a cor de fundo.
    }
  }

  let y = 0;

  // Logo
  if (options.logo) {
    try {
      const logo = await loadImage(options.logo);
      const size = 200 * s;
      ctx.save();
      ctx.beginPath();
      ctx.arc(center, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.clip();
      const ratio = Math.min((size * 0.82) / logo.width, (size * 0.82) / logo.height);
      const lw = logo.width * ratio;
      const lh = logo.height * ratio;
      ctx.drawImage(logo, center - lw / 2, y + size / 2 - lh / 2, lw, lh);
      ctx.restore();
      y += size + 50 * s;
    } catch {
      // Logo inválida: segue sem.
    }
  } else {
    y += 40 * s;
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = textColor;

  // Nome da empresa
  ctx.font = `800 ${64 * s}px ${FONT}`;
  wrapText(ctx, options.businessName || 'Sua empresa', W - 160 * s, 2).forEach((line) => {
    y += 70 * s;
    ctx.fillText(line, center, y);
  });

  // Chamada
  y += 70 * s;
  ctx.font = `600 ${44 * s}px ${FONT}`;
  wrapText(ctx, options.headline, W - 200 * s, 2).forEach((line, i) => {
    if (i > 0) y += 54 * s;
    ctx.fillText(line, center, y);
  });

  // Estrelas
  y += 80 * s;
  const starSize = 34 * s;
  for (let i = 0; i < 5; i++) {
    drawStar(ctx, center + (i - 2) * starSize * 2.4, y, starSize, '#FBBC04');
  }

  // QR Code em caixa branca
  const qrBox = (options.format === 'impressao' ? 620 : 470) * s;
  y += 60 * s;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
  ctx.shadowBlur = 30 * s;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, center - qrBox / 2, y, qrBox, qrBox, 36 * s);
  ctx.fill();
  ctx.restore();
  const qrSize = qrBox - 70 * s;
  const qrData = await QRCode.toDataURL(options.reviewUrl || 'https://www.google.com', {
    errorCorrectionLevel: 'M',
    margin: 0,
    width: Math.round(qrSize),
    color: { dark: '#111827', light: '#ffffff' },
  });
  const qrImg = await loadImage(qrData);
  ctx.drawImage(qrImg, center - qrSize / 2, y + (qrBox - qrSize) / 2, qrSize, qrSize);
  y += qrBox;

  // Botão
  y += 50 * s;
  const buttonW = 640 * s;
  const buttonH = 104 * s;
  ctx.fillStyle = options.accentColor;
  roundRect(ctx, center - buttonW / 2, y, buttonW, buttonH, buttonH / 2);
  ctx.fill();
  ctx.fillStyle = readableTextColor(options.accentColor);
  ctx.font = `700 ${42 * s}px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('Avalie no Google ★', center, y + buttonH / 2 + 2 * s);
  ctx.textBaseline = 'alphabetic';
  y += buttonH;

  // Instrução
  ctx.fillStyle = textColor;
  ctx.globalAlpha = 0.85;
  ctx.font = `500 ${32 * s}px ${FONT}`;
  wrapText(ctx, options.subtitle, W - 200 * s, 2).forEach((line) => {
    y += 56 * s;
    ctx.fillText(line, center, y);
  });
  ctx.globalAlpha = 1;

  // Centraliza o bloco de conteúdo na vertical.
  const contentHeight = y + 20 * s;
  main.drawImage(layer, 0, Math.max(40 * s, (H - contentHeight) / 2));
}
