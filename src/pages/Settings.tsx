import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Check, Palette, Building2, User, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

// Modos de aparência do design system (preto, dourado e branco).
const THEME_MODES = [
  { value: 'light', label: 'Claro', icon: Sun, preview: ['#FAF9F6', '#0F0F0F', '#C9A227'] },
  { value: 'dark', label: 'Escuro', icon: Moon, preview: ['#0D0D0D', '#1A1A1A', '#D4AF37'] },
  { value: 'system', label: 'Automático', icon: Monitor, preview: ['#FAF9F6', '#0D0D0D', '#C9A227'] },
];

export default function Settings() {
  const { profile, user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [companyName, setCompanyName] = useState(profile?.company_name || '');
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const { theme, setTheme } = useTheme();
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
        })
        .eq('id', user.id);

      if (error) throw error;

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

        {/* Aparência */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Aparência
            </CardTitle>
            <CardDescription>Identidade visual preto, dourado e branco. Escolha o modo da tela.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {THEME_MODES.map((mode) => {
                const active = (theme || 'light') === mode.value;
                return (
                  <button
                    key={mode.value}
                    onClick={() => setTheme(mode.value)}
                    className={cn(
                      'lift rounded-xl border p-3 text-left',
                      active ? 'border-primary ring-2 ring-primary/30' : 'hover:border-primary/40',
                    )}
                  >
                    <div className="flex h-16 overflow-hidden rounded-lg border">
                      <div className="w-1/4" style={{ background: mode.preview[1] }} />
                      <div className="flex flex-1 items-end gap-1.5 p-2" style={{ background: mode.preview[0] }}>
                        <span className="h-2 w-10 rounded-full" style={{ background: mode.preview[2] }} />
                        <span className="h-2 w-6 rounded-full opacity-30" style={{ background: mode.preview[1] === '#0F0F0F' ? '#0F0F0F' : '#ffffff' }} />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm font-medium">
                      <span className="flex items-center gap-2">
                        <mode.icon className="h-4 w-4" />
                        {mode.label}
                      </span>
                      {active && <Check className="h-4 w-4 text-primary" />}
                    </div>
                  </button>
                );
              })}
            </div>
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
