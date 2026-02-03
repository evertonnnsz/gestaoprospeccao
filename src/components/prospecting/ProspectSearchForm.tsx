import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Search, MapPin, Loader2 } from 'lucide-react';

interface ProspectSearchFormProps {
  onSearch: (niche: string, location: string) => void;
  isLoading: boolean;
}

export function ProspectSearchForm({ onSearch, isLoading }: ProspectSearchFormProps) {
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (niche.trim() && location.trim()) {
      onSearch(niche.trim(), location.trim());
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="niche">Nicho / Palavra-chave *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="niche"
                  className="pl-10"
                  placeholder="Ex: restaurantes, academias, salões de beleza"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Cidade / Estado *</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="location"
                  className="pl-10"
                  placeholder="Ex: São Paulo, SP"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full md:w-auto" 
            disabled={isLoading || !niche.trim() || !location.trim()}
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
