import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, MapPin, Loader2, Building2, Globe } from 'lucide-react';
import { BRAZILIAN_STATES } from '@/lib/constants/brazilianStates';

export interface SearchParams {
  niche: string;
  state: string | null;
  city: string | null;
  limit: number;
}

interface ProspectSearchFormProps {
  onSearch: (params: SearchParams) => void;
  isLoading: boolean;
}

const RESULT_LIMITS = [
  { value: 25, label: '25 resultados' },
  { value: 50, label: '50 resultados' },
  { value: 100, label: '100 resultados' },
];

export function ProspectSearchForm({ onSearch, isLoading }: ProspectSearchFormProps) {
  const [niche, setNiche] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [limit, setLimit] = useState(50);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (niche.trim()) {
      onSearch({ 
        niche: niche.trim(), 
        state: state || null, 
        city: city.trim() || null, 
        limit 
      });
    }
  };

  const isValid = niche.trim();

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Nicho */}
            <div className="space-y-2">
              <Label htmlFor="niche">Nicho / Palavra-chave *</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="niche"
                  className="pl-10"
                  placeholder="Ex: dentistas, academias, restaurantes"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Estado */}
            <div className="space-y-2">
              <Label htmlFor="state">Estado</Label>
              <Select value={state} onValueChange={setState} disabled={isLoading}>
                <SelectTrigger id="state" className="w-full">
                  <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Selecione o estado" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="all">Todo o Brasil</SelectItem>
                  {BRAZILIAN_STATES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label} ({s.value})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cidade */}
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="city"
                  className="pl-10"
                  placeholder="Ex: Recife, São Paulo (opcional)"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Quantidade de Resultados */}
            <div className="space-y-2">
              <Label htmlFor="limit">Quantidade de Resultados</Label>
              <Select 
                value={limit.toString()} 
                onValueChange={(v) => setLimit(Number(v))} 
                disabled={isLoading}
              >
                <SelectTrigger id="limit" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {RESULT_LIMITS.map((l) => (
                    <SelectItem key={l.value} value={l.value.toString()}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full md:w-auto" 
            disabled={isLoading || !isValid}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Buscar Leads
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
