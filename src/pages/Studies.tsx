import { useMemo, useState } from 'react';
import { BookOpen, Brain, CheckCircle2, Clock, Megaphone, PenTool, Target, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const initialCourses = [
  { id: 'comercial', category: 'Comercial', icon: Users, progress: 20, hours: 2, lastClass: 'Diagnóstico consultivo', nextClass: 'Follow-up de proposta' },
  { id: 'operacional', category: 'Operacional', icon: Target, progress: 35, hours: 4, lastClass: 'Rotina de contas', nextClass: 'Checklist de campanhas' },
  { id: 'google', category: 'Google Ads', icon: Megaphone, progress: 10, hours: 1, lastClass: 'Estrutura de conta', nextClass: 'Conversões' },
  { id: 'meta', category: 'Meta Ads', icon: Megaphone, progress: 40, hours: 5, lastClass: 'Criativos', nextClass: 'Testes A/B' },
  { id: 'copy', category: 'Copywriting', icon: PenTool, progress: 15, hours: 2, lastClass: 'Oferta', nextClass: 'Headline' },
  { id: 'ia', category: 'IA', icon: Brain, progress: 25, hours: 3, lastClass: 'Prompts operacionais', nextClass: 'Automações' },
  { id: 'gestao', category: 'Gestão', icon: BookOpen, progress: 30, hours: 3, lastClass: 'Prioridades', nextClass: 'Indicadores' },
];

export default function Studies() {
  const [courses, setCourses] = useState(initialCourses);
  const totalHours = useMemo(() => courses.reduce((total, course) => total + course.hours, 0), [courses]);
  const averageProgress = useMemo(
    () => courses.reduce((total, course) => total + course.progress, 0) / courses.length,
    [courses],
  );

  const addStudyHour = (id: string) => {
    setCourses((current) =>
      current.map((course) =>
        course.id === id
          ? { ...course, hours: course.hours + 1, progress: Math.min(course.progress + 5, 100) }
          : course,
      ),
    );
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <p className="text-sm font-medium text-warning">Missão recorrente</p>
        <h1 className="text-2xl font-bold">Estudos</h1>
        <p className="text-muted-foreground">
          Painel por categoria para acompanhar progresso, horas estudadas, última e próxima aula.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Summary title="Horas estudadas" value={`${totalHours}h`} icon={Clock} />
        <Summary title="Progresso médio" value={`${averageProgress.toFixed(0)}%`} icon={CheckCircle2} />
        <Summary title="Categorias" value={String(courses.length)} icon={BookOpen} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {courses.map((course) => (
          <Card key={course.id} className="shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <course.icon className="w-5 h-5" />
                </div>
                <CardTitle className="text-lg">{course.category}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-medium">{course.progress}%</span>
                </div>
                <Progress value={course.progress} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Horas" value={`${course.hours}h`} />
                <Info label="Última aula" value={course.lastClass} />
                <Info label="Próxima aula" value={course.nextClass} />
              </div>
              <Button variant="outline" className="w-full" onClick={() => addStudyHour(course.id)}>
                Registrar 1h de estudo
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Summary({ title, value, icon: Icon }: { title: string; value: string; icon: any }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
