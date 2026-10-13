import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardList,
  ExternalLink,
  FileDown,
  Loader2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ScoreRing } from '@/components/gbp/GbpAnalysisView';
import { CHECKLIST_SECTIONS, ChecklistState, checklistProgress } from '@/lib/gbpChecklist';

// gbp_checklists e gbp_analyses ainda não estão nos tipos gerados do Supabase.
const db = supabase as any;

type Checklist = {
  id: string;
  client_id: string | null;
  place_id: string | null;
  business_name: string;
  items: ChecklistState;
  updated_at: string;
};

type ProfileOption = { place_id: string | null; name: string };

const isMissingTable = (error: any) => error?.code === '42P01' || error?.code === 'PGRST205';

export default function GbpChecklist() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [tableMissing, setTableMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ProfileOption[] | null>(null);

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const selected = checklists.find((c) => c.id === selectedId) || null;
  const progress = useMemo(() => checklistProgress(selected?.items || {}), [selected]);

  useEffect(() => {
    const load = async () => {
      const [listRes, analysesRes] = await Promise.all([
        db.from('gbp_checklists').select('*').order('updated_at', { ascending: false }),
        db.from('gbp_analyses').select('place_id, business_name, created_at').order('created_at', { ascending: false }),
      ]);
      setTableMissing(isMissingTable(listRes.error));
      setChecklists(listRes.data || []);
      const unique = new Map<string, ProfileOption>();
      (analysesRes.data || []).forEach((r: any) => {
        if (r.place_id && !unique.has(r.place_id)) unique.set(r.place_id, { place_id: r.place_id, name: r.business_name });
      });
      setProfiles([...unique.values()]);
      if (listRes.data?.length) setSelectedId(listRes.data[0].id);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    const timer = window.setTimeout(() => window.print(), 300);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', done);
    };
  }, [printing]);

  const createFor = async (profile: ProfileOption) => {
    if (!user) return;
    const existing = profile.place_id ? checklists.find((c) => c.place_id === profile.place_id) : null;
    if (existing) {
      setSelectedId(existing.id);
      return;
    }
    const { data, error } = await db
      .from('gbp_checklists')
      .insert({ user_id: user.id, place_id: profile.place_id, business_name: profile.name, items: {} })
      .select()
      .single();
    if (error) {
      toast({
        title: 'Não foi possível criar o checklist',
        description: tableMissing ? 'Falta aplicar no Lovable a atualização de banco gbp_checklists.' : error.message,
        variant: 'destructive',
      });
      return;
    }
    setChecklists((current) => [data, ...current]);
    setSelectedId(data.id);
    setResults(null);
    setNewName('');
  };

  // Vindo do diagnóstico: ?place=...&nome=... abre (ou cria) o checklist do perfil.
  useEffect(() => {
    const place = searchParams.get('place');
    const name = searchParams.get('nome');
    if (loading || !place || !name) return;
    createFor({ place_id: place, name });
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, searchParams]);

  const search = async () => {
    if (!newName.trim()) return;
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('gbp-analyze', {
        body: { action: 'search', query: newName },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message);
      setResults((data.candidates || []).map((c: any) => ({ place_id: c.place_id, name: c.title })));
    } catch (err: any) {
      toast({ title: 'Não foi possível buscar', description: err?.message, variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  };

  const saveItems = async (items: ChecklistState) => {
    if (!selected) return;
    setChecklists((current) => current.map((c) => (c.id === selected.id ? { ...c, items } : c)));
    const { error } = await db.from('gbp_checklists').update({ items }).eq('id', selected.id);
    if (error) toast({ title: 'Não foi possível salvar', description: error.message, variant: 'destructive' });
  };

  const toggle = (itemId: string) => {
    if (!selected) return;
    const items = { ...selected.items };
    if (items[itemId]?.done_at) {
      const { note } = items[itemId];
      if (note) items[itemId] = { done_at: '', note };
      else delete items[itemId];
    } else {
      items[itemId] = { ...items[itemId], done_at: new Date().toISOString() };
    }
    saveItems(items);
  };

  const setSection = (sectionId: string, done: boolean) => {
    if (!selected) return;
    const section = CHECKLIST_SECTIONS.find((s) => s.id === sectionId)!;
    const items = { ...selected.items };
    const now = new Date().toISOString();
    section.items.forEach((i) => {
      if (done && !items[i.id]?.done_at) items[i.id] = { ...items[i.id], done_at: now };
      if (!done && items[i.id]?.done_at) items[i.id] = { ...items[i.id], done_at: '' };
    });
    saveItems(items);
  };

  const setNote = (itemId: string, note: string) => {
    if (!selected) return;
    const current = selected.items[itemId];
    if ((current?.note || '') === note) return;
    saveItems({ ...selected.items, [itemId]: { done_at: current?.done_at || '', note } });
  };

  const remove = async () => {
    if (!selected) return;
    const { error } = await db.from('gbp_checklists').delete().eq('id', selected.id);
    if (error) return toast({ title: 'Não foi possível excluir', description: error.message, variant: 'destructive' });
    const rest = checklists.filter((c) => c.id !== selected.id);
    setChecklists(rest);
    setSelectedId(rest[0]?.id || null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Checklist de otimização
          </h1>
          <p className="text-sm text-muted-foreground">
            Passo a passo para otimizar o Perfil da Empresa no Google de cada cliente e acompanhar o progresso.
          </p>
        </div>
        {selected && (
          <Button variant="outline" className="gap-2" onClick={() => setPrinting(true)}>
            <FileDown className="w-4 h-4" />
            Exportar PDF
          </Button>
        )}
      </div>

      {tableMissing && (
        <Card className="border-warning/40 bg-warning/5 print:hidden">
          <CardContent className="pt-6 text-sm">
            Falta aplicar no Lovable a atualização de banco <code className="text-xs">gbp_checklists</code> para salvar os
            checklists.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr] print:block">
        {/* Lista e criação */}
        <div className="space-y-4 print:hidden">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Novo checklist
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profiles.length > 0 && (
                <Select onValueChange={(id) => createFor(profiles.find((p) => p.place_id === id)!)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Perfis já analisados" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.place_id!} value={p.place_id!}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="checklist-search">Ou busque o perfil</Label>
                <div className="flex gap-2">
                  <Input
                    id="checklist-search"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && search()}
                    placeholder="Empresa e cidade"
                  />
                  <Button variant="outline" size="icon" onClick={search} disabled={searching} aria-label="Buscar perfil">
                    {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              {results && (
                <div className="rounded-md border divide-y">
                  {results.map((r) => (
                    <button
                      key={r.place_id || r.name}
                      className="w-full p-2.5 text-left text-sm hover:bg-muted"
                      onClick={() => createFor(r)}
                    >
                      {r.name}
                    </button>
                  ))}
                  {newName.trim() && (
                    <button
                      className="w-full p-2.5 text-left text-sm text-muted-foreground hover:bg-muted"
                      onClick={() => createFor({ place_id: null, name: newName.trim() })}
                    >
                      Criar sem vincular ao Google: "{newName.trim()}"
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Checklists ({checklists.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              {!loading && checklists.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum checklist ainda.</p>
              )}
              {checklists.map((c) => {
                const p = checklistProgress(c.items);
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      'w-full rounded-md px-2.5 py-2 text-left hover:bg-muted',
                      selectedId === c.id && 'bg-primary/10',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium truncate">{c.business_name}</span>
                      <span className="text-xs text-muted-foreground">{p.percent}%</span>
                    </div>
                    <Progress value={p.percent} className="h-1.5 mt-1.5" />
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Checklist selecionado */}
        {selected ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6 flex flex-col sm:flex-row gap-6 sm:items-center">
                <ScoreRing score={progress.percent} />
                <div className="flex-1 space-y-3 min-w-0">
                  <div>
                    <h2 className="text-xl font-semibold">{selected.business_name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {progress.done} de {progress.total} itens concluídos · atualizado em{' '}
                      {format(parseISO(selected.updated_at), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    {progress.sections.map((s) => (
                      <div key={s.id} className="text-xs">
                        <div className="flex justify-between mb-1">
                          <span>{s.title}</span>
                          <span className="text-muted-foreground">
                            {s.done}/{s.total}
                          </span>
                        </div>
                        <Progress value={(s.done / s.total) * 100} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="self-start text-muted-foreground hover:text-destructive print:hidden"
                  onClick={remove}
                  aria-label="Excluir checklist"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>

            {CHECKLIST_SECTIONS.map((section) => {
              const sectionProgress = progress.sections.find((s) => s.id === section.id)!;
              const isOpen = printing || open[section.id] !== false;
              const allDone = sectionProgress.done === sectionProgress.total;
              return (
                <Card key={section.id} className="break-inside-avoid">
                  <CardHeader className="py-4">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        className="flex items-center gap-2 text-left"
                        onClick={() => setOpen((o) => ({ ...o, [section.id]: !isOpen }))}
                      >
                        {isOpen ? <ChevronDown className="w-4 h-4 print:hidden" /> : <ChevronRight className="w-4 h-4" />}
                        <span className="font-semibold">{section.title}</span>
                        <span className="text-sm text-muted-foreground">
                          {sectionProgress.done}/{sectionProgress.total}
                        </span>
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="print:hidden"
                        onClick={() => setSection(section.id, !allDone)}
                      >
                        {allDone ? 'Desmarcar seção' : 'Marcar seção'}
                      </Button>
                    </div>
                  </CardHeader>
                  {isOpen && (
                    <CardContent className="pt-0 divide-y">
                      {section.items.map((item) => {
                        const entry = selected.items[item.id];
                        const done = Boolean(entry?.done_at);
                        const showDetails = printing ? Boolean(entry?.note) : expanded === item.id;
                        return (
                          <div key={item.id} className="py-2.5 break-inside-avoid">
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => toggle(item.id)}
                                className={cn('mt-0.5 shrink-0', done ? 'text-emerald-600' : 'text-muted-foreground')}
                                aria-label={done ? 'Desmarcar item' : 'Marcar item como feito'}
                              >
                                {done ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                              </button>
                              <button
                                className="flex-1 min-w-0 text-left"
                                onClick={() => setExpanded((e) => (e === item.id ? null : item.id))}
                              >
                                <p className={cn('text-sm font-medium', done && 'text-muted-foreground')}>{item.title}</p>
                                {done && (
                                  <p className="text-xs text-emerald-600">
                                    Concluído em {format(parseISO(entry!.done_at), 'dd/MM/yyyy')}
                                  </p>
                                )}
                              </button>
                            </div>
                            {showDetails && (
                              <div className="ml-8 mt-2 space-y-2 text-sm">
                                {!printing && (
                                  <>
                                    <p>
                                      <span className="font-medium">Por que importa: </span>
                                      <span className="text-muted-foreground">{item.why}</span>
                                    </p>
                                    <p>
                                      <span className="font-medium">Como fazer: </span>
                                      <span className="text-muted-foreground">{item.how}</span>
                                    </p>
                                    {item.tool && (
                                      <Link
                                        to={item.tool.path}
                                        className="inline-flex items-center gap-1 text-primary hover:underline"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        {item.tool.label}
                                      </Link>
                                    )}
                                    <Textarea
                                      defaultValue={entry?.note || ''}
                                      onBlur={(e) => setNote(item.id, e.target.value.trim())}
                                      placeholder="Anotação (opcional): o que foi feito, pendências..."
                                      className="min-h-[60px]"
                                    />
                                  </>
                                )}
                                {printing && entry?.note && <p className="text-muted-foreground">Obs.: {entry.note}</p>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          !loading && (
            <Card className="print:hidden">
              <CardContent className="pt-6 text-sm text-muted-foreground">
                Crie um checklist escolhendo um perfil ao lado.
              </CardContent>
            </Card>
          )
        )}
      </div>
    </div>
  );
}
