import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Settings() {
  const { profile } = useAuth();

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>
      <Card>
        <CardHeader><CardTitle>Perfil</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p><strong>Nome:</strong> {profile?.full_name || '-'}</p>
          <p><strong>Email:</strong> {profile?.email || '-'}</p>
          <p><strong>Empresa:</strong> {profile?.company_name || '-'}</p>
        </CardContent>
      </Card>
    </div>
  );
}
