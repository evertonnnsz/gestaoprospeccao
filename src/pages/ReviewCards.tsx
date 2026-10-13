import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, ImagePlus, Link2, Loader2, MessageCircle, QrCode, Search, Star, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CARD_SIZES, CardFormat, CardOptions, drawReviewCard, reviewUrlFromPlaceId } from '@/lib/reviewCard';

const db = supabase as any;

type Profile = { place_id: string; name: string; address: string | null };

// Primeiro as cores da marca (preto, grafite, dourado, creme e branco); depois opções para a marca do cliente.
const PRESET_COLORS = ['#0B0B0B', '#1C1C1C', '#C9A227', '#F6F1E3', '#ffffff', '#0f3d2e', '#1e3a8a', '#7c2d12'];

const readFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const slug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

async function copy(text: string) {
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
}

export default function ReviewCards() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [saved, setSaved] = useState<Profile[]>([]);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Profile[] | null>(null);
  const [rendering, setRendering] = useState(false);

  const [options, setOptions] = useState<CardOptions>({
    format: 'digital',
    businessName: '',
    headline: 'Sua opinião é muito importante para nós!',
    subtitle: 'Aponte a câmera do celular para o QR Code e deixe sua avaliação',
    reviewUrl: '',
    backgroundColor: '#0B0B0B',
    backgroundImage: null,
    overlayOpacity: 0.75,
    accentColor: '#C9A227',
    logo: null,
  });

  const update = (patch: Partial<CardOptions>) => setOptions((o) => ({ ...o, ...patch }));

  // Perfis já analisados no módulo Google Meu Negócio.
  useEffect(() => {
    db.from('gbp_analyses')
      .select('place_id, business_name, address, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }: any) => {
        const unique = new Map<string, Profile>();
        (data || []).forEach((row: any) => {
          if (row.place_id && !unique.has(row.place_id)) {
            unique.set(row.place_id, { place_id: row.place_id, name: row.business_name, address: row.address });
          }
        });
        setSaved([...unique.values()]);
      });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (!canvasRef.current) return;
      setRendering(true);
      try {
        await drawReviewCard(canvasRef.current, options);
      } finally {
        setRendering(false);
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [options]);

  const choose = (profile: Profile) => {
    update({ businessName: profile.name, reviewUrl: reviewUrlFromPlaceId(profile.place_id) });
    setResults(null);
  };

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('gbp-analyze', { body: { action: 'search', query } });
      if (error || !data?.success) throw new Error(data?.error || error?.message);
      setResults(
        (data.candidates || [])
          .filter((c: any) => c.place_id)
          .map((c: any) => ({ place_id: c.place_id, name: c.title, address: c.address })),
      );
    } catch (err: any) {
      toast({ title: 'Não foi possível buscar', description: err?.message, variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  };

  const upload = async (file: File | undefined, field: 'logo' | 'backgroundImage') => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Imagem muito grande', description: 'Use uma imagem de até 5 MB.', variant: 'destructive' });
      return;
    }
    update({ [field]: await readFile(file) } as Partial<CardOptions>);
  };

  const download = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cartao-avaliacao-${slug(options.businessName || 'empresa')}-${options.format}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  const whatsappMessage = useMemo(
    () =>
      `Olá! 😊 Obrigado por escolher a ${options.businessName || 'nossa empresa'}.\n` +
      `Sua avaliação ajuda muito o nosso trabalho. Leva menos de 1 minuto: ⭐⭐⭐⭐⭐\n${options.reviewUrl}`,
    [options.businessName, options.reviewUrl],
  );

  const ready = Boolean(options.reviewUrl);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <QrCode className="w-6 h-6 text-primary" />
          Cartões de avaliação
        </h1>
        <p className="text-sm text-muted-foreground">
          Gere cartões com QR Code que levam direto para a tela de avaliação do Google do cliente.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Perfil do Google</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {saved.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Perfis já analisados</Label>
                  <Select onValueChange={(id) => choose(saved.find((p) => p.place_id === id)!)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolher um perfil" />
                    </SelectTrigger>
                    <SelectContent>
                      {saved.map((p) => (
                        <SelectItem key={p.place_id} value={p.place_id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="card-search">Buscar outro perfil</Label>
                <div className="flex gap-2">
                  <Input
                    id="card-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && search()}
                    placeholder="Empresa e cidade"
                  />
                  <Button variant="outline" size="icon" onClick={search} disabled={searching} aria-label="Buscar">
                    {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              {results && (
                <div className="rounded-md border divide-y">
                  {results.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nenhum perfil encontrado.</p>}
                  {results.map((r) => (
                    <button
                      key={r.place_id}
                      className="w-full p-2.5 text-left hover:bg-muted"
                      onClick={() => choose(r)}
                    >
                      <p className="text-sm font-medium">{r.name}</p>
                      {r.address && <p className="text-xs text-muted-foreground truncate">{r.address}</p>}
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="card-link" className="flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" />
                  Link de avaliação
                </Label>
                <Input
                  id="card-link"
                  value={options.reviewUrl}
                  onChange={(e) => update({ reviewUrl: e.target.value })}
                  placeholder="Preenchido ao escolher o perfil"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. Personalizar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(CARD_SIZES) as CardFormat[]).map((f) => (
                  <Button
                    key={f}
                    variant={options.format === f ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => update({ format: f })}
                  >
                    {CARD_SIZES[f].label}
                  </Button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="card-name">Nome no cartão</Label>
                <Input
                  id="card-name"
                  value={options.businessName}
                  onChange={(e) => update({ businessName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="card-headline">Chamada</Label>
                <Input
                  id="card-headline"
                  value={options.headline}
                  onChange={(e) => update({ headline: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="card-subtitle">Instrução</Label>
                <Input
                  id="card-subtitle"
                  value={options.subtitle}
                  onChange={(e) => update({ subtitle: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {(['logo', 'backgroundImage'] as const).map((field) => (
                  <div key={field} className="space-y-1.5">
                    <Label>{field === 'logo' ? 'Logo do cliente' : 'Imagem de fundo'}</Label>
                    {options[field] ? (
                      <div className="flex items-center gap-2">
                        <img src={options[field]!} alt="" className="h-10 w-10 rounded object-cover border" />
                        <Button variant="ghost" size="sm" onClick={() => update({ [field]: null } as Partial<CardOptions>)}>
                          <X className="w-4 h-4 mr-1" />
                          Remover
                        </Button>
                      </div>
                    ) : (
                      <label className="flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed text-sm text-muted-foreground hover:bg-muted">
                        <ImagePlus className="w-4 h-4" />
                        Enviar
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => upload(e.target.files?.[0], field)}
                        />
                      </label>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label>Cor de fundo</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => update({ backgroundColor: color })}
                      className={cn(
                        'h-7 w-7 rounded-full border',
                        options.backgroundColor === color && 'ring-2 ring-primary ring-offset-2',
                      )}
                      style={{ background: color }}
                      aria-label={`Cor ${color}`}
                    />
                  ))}
                  <input
                    type="color"
                    value={options.backgroundColor}
                    onChange={(e) => update({ backgroundColor: e.target.value })}
                    className="h-8 w-10 cursor-pointer rounded border bg-transparent"
                    aria-label="Outra cor de fundo"
                  />
                </div>
              </div>

              {options.backgroundImage && (
                <div className="space-y-2">
                  <Label>Opacidade da cor sobre a imagem: {Math.round(options.overlayOpacity * 100)}%</Label>
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={[Math.round(options.overlayOpacity * 100)]}
                    onValueChange={([v]) => update({ overlayOpacity: v / 100 })}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="card-accent">Cor do botão</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="card-accent"
                    type="color"
                    value={options.accentColor}
                    onChange={(e) => update({ accentColor: e.target.value })}
                    className="h-8 w-10 cursor-pointer rounded border bg-transparent"
                  />
                  <span className="text-sm text-muted-foreground">{options.accentColor}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 flex flex-col items-center gap-4">
              <div className="relative w-full max-w-[420px]">
                <canvas ref={canvasRef} className="w-full h-auto rounded-xl shadow-lg border" />
                {rendering && (
                  <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {!ready && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Star className="w-4 h-4" />
                  Escolha o perfil do Google para o QR Code levar à avaliação certa.
                </p>
              )}
              <div className="flex flex-wrap justify-center gap-2">
                <Button className="gap-2" onClick={download} disabled={!ready}>
                  <Download className="w-4 h-4" />
                  Baixar PNG
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={!ready}
                  onClick={async () => {
                    await copy(options.reviewUrl);
                    toast({ title: 'Link copiado' });
                  }}
                >
                  <Copy className="w-4 h-4" />
                  Copiar link
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={!ready}
                  onClick={async () => {
                    await copy(whatsappMessage);
                    toast({ title: 'Mensagem copiada', description: 'Envie para os clientes do seu cliente.' });
                  }}
                >
                  <MessageCircle className="w-4 h-4" />
                  Copiar mensagem
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
