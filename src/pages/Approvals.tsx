import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Profile } from '@/types/crm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Loader2 } from 'lucide-react';

export default function Approvals() {
  const { isAdmin } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (isAdmin) fetchPendingUsers();
  }, [isAdmin]);

  const fetchPendingUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('is_approved', false);
    setPendingUsers((data as Profile[]) || []);
    setLoading(false);
  };

  const handleApprove = async (userId: string) => {
    await supabase.from('profiles').update({ is_approved: true }).eq('id', userId);
    toast({ title: 'Usuário aprovado!' });
    fetchPendingUsers();
  };

  if (!isAdmin) return <div className="p-6">Acesso negado</div>;
  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="app-page">
      <h1 className="text-2xl font-bold">Aprovação de Usuários</h1>
      {pendingUsers.length === 0 ? (
        <Card className="p-8 text-center"><p className="text-muted-foreground">Nenhum usuário pendente</p></Card>
      ) : (
        <div className="grid gap-4">
          {pendingUsers.map((user) => (
            <Card key={user.id} className="p-4 flex items-center justify-between">
              <div><p className="font-medium">{user.full_name || 'Sem nome'}</p><p className="text-sm text-muted-foreground">{user.email}</p></div>
              <Button onClick={() => handleApprove(user.id)} className="gap-2"><Check className="w-4 h-4" />Aprovar</Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
