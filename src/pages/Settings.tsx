import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Check, Palette, Building2, User } from 'lucide-react';

const THEME_COLORS = [
  { name: 'Azul', value: '#2563EB', hsl: '217 91% 60%' },
  { name: 'Verde', value: '#16A34A', hsl: '142 76% 36%' },
  { name: 'Roxo', value: '#9333EA', hsl: '270 91% 56%' },
  { name: 'Laranja', value: '#EA580C', hsl: '21 90% 48%' },
  { name: 'Rosa', value: '#DB2777', hsl: '330 81% 50%' },
  { name: 'Ciano', value: '#0891B2', hsl: '189 94% 37%' },
  { name: 'Vermelho', value: '#DC2626', hsl: '0 84% 50%' },
  { name: 'Índigo', value: '#4F46E5', hsl: '243 75% 59%' },
];

export default function Settings() {
  const { profile, user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [companyName, setCompanyName] = useState(profile?.company_name || '');
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [selectedColor, setSelectedColor] = useState(profile?.theme_color || '#2563EB');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState(profile?.company_logo_url || '');

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Erro',
        description: 'Por favor, selecione uma imagem válida.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Erro',
        description: 'A imagem deve ter no máximo 2MB.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      setLogoUrl(publicUrl);

      await supabase
        .from('profiles')
        .update({ company_logo_url: publicUrl })
        .eq('id', user.id);

      toast({
        title: 'Logo atualizada',
        description: 'Sua logo foi atualizada com sucesso.',
      });

      refreshProfile();
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: 'Erro ao enviar logo',
        description: 'Não foi possível enviar a logo. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          company_name: companyName,
          theme_color: selectedColor,
        })
        .eq('id', user.id);

      if (error) throw error;

      // Apply theme color to CSS
      applyThemeColor(selectedColor);

      toast({
        title: 'Perfil atualizado',
        description: 'Suas configurações foram salvas com sucesso.',
      });

      refreshProfile();
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const applyThemeColor = (hexColor: string) => {
    const color = THEME_COLORS.find(c => c.value === hexColor);
    if (color) {
      document.documentElement.style.setProperty('--primary', color.hsl);
      document.documentElement.style.setProperty('--accent', color.hsl);
      document.documentElement.style.setProperty('--ring', color.hsl);
      document.documentElement.style.setProperty('--sidebar-primary', color.hsl);
      document.documentElement.style.setProperty('--sidebar-ring', color.hsl);
      document.documentElement.style.setProperty('--chart-1', color.hsl);
    }
  };

  // Apply saved theme color on mount
  useState(() => {
    if (profile?.theme_color) {
      applyThemeColor(profile.theme_color);
    }
  });

  return (
    <div className="app-page max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Personalize sua conta e aparência do sistema</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Perfil
            </CardTitle>
            <CardDescription>Informações da sua conta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={profile?.email || ''}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Nome da Empresa</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Sua empresa"
              />
            </div>
          </CardContent>
        </Card>

        {/* Logo Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Logo da Empresa
            </CardTitle>
            <CardDescription>Imagem exibida na sidebar (máx. 2MB)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full"
                >
                  {uploading ? (
                    'Enviando...'
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Enviar Logo
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Theme Color Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Cor do Tema
            </CardTitle>
            <CardDescription>Escolha a cor principal do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
              {THEME_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setSelectedColor(color.value)}
                  className="group relative aspect-square rounded-lg border-2 transition-all hover:scale-105"
                  style={{
                    backgroundColor: color.value,
                    borderColor: selectedColor === color.value ? color.value : 'transparent',
                    boxShadow: selectedColor === color.value ? `0 0 0 2px white, 0 0 0 4px ${color.value}` : 'none',
                  }}
                  title={color.name}
                >
                  {selectedColor === color.value && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check className="h-5 w-5 text-white drop-shadow-md" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Cor selecionada: <span className="font-medium">{THEME_COLORS.find(c => c.value === selectedColor)?.name || 'Azul'}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSaveProfile} disabled={saving} size="lg">
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </div>
  );
}
