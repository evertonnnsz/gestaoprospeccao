import {
  LayoutDashboard,
  Users,
  Target,
  Settings,
  LogOut,
  UserCheck,
  UsersRound,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  DollarSign,
  Sparkles,
  ClipboardCheck,
  BarChart3,
  ListChecks,
  MapPin,
  FileText,
  QrCode,
  Tags,
  ClipboardList,
  Trophy,
  Moon,
  Sun,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const navGroups = [
  {
    label: 'Visão geral',
    items: [
      { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
      { title: 'Atividades do Dia', url: '/atividades', icon: ListChecks },
      { title: 'Funil', url: '/funnel', icon: Target },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { title: 'Leads', url: '/leads', icon: Users },
      { title: 'Prospecção', url: '/prospecting', icon: Sparkles },
      { title: 'Clientes', url: '/clients', icon: Briefcase },
      { title: 'Orçamentos', url: '/orcamentos', icon: FileText },
    ],
  },
  {
    label: 'Google Meu Negócio',
    items: [
      { title: 'Diagnóstico', url: '/google-meu-negocio', icon: MapPin },
      { title: 'Ranking', url: '/ranking-google', icon: Trophy },
      { title: 'Checklist', url: '/checklist-gmn', icon: ClipboardList },
      { title: 'Categorias', url: '/categorias', icon: Tags },
      { title: 'Cartões de avaliação', url: '/cartoes-avaliacao', icon: QrCode },
    ],
  },
  {
    label: 'Operação',
    items: [
      { title: 'Dashboard de Anúncios', url: '/ads-dashboard', icon: BarChart3 },
      { title: 'Onboarding', url: '/onboarding', icon: ClipboardCheck },
      { title: 'Financeiro', url: '/financial', icon: DollarSign },
    ],
  },
];

const adminItems = [
  { title: 'Aprovações', url: '/approvals', icon: UserCheck },
  { title: 'Usuários', url: '/users', icon: UsersRound },
];

const bottomItems = [{ title: 'Configurações', url: '/settings', icon: Settings }];

export function AppSidebar() {
  const { isAdmin, signOut, profile } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const isDark = resolvedTheme === 'dark';

  // Item ativo: fundo grafite, texto branco, ícone e barra lateral em dourado.
  const linkClassName = (path: string) =>
    cn(
      'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200',
      collapsed && 'justify-center px-0',
      isActive(path)
        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
        : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
    );

  const renderLink = (item: { title: string; url: string; icon: typeof Users }) => (
    <NavLink key={item.url} to={item.url} className={linkClassName(item.url)} title={collapsed ? item.title : undefined}>
      <span
        className={cn(
          'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary transition-all duration-300',
          isActive(item.url) ? 'opacity-100' : 'h-0 opacity-0',
        )}
      />
      <item.icon
        className={cn(
          'h-[18px] w-[18px] shrink-0 transition-colors',
          isActive(item.url) ? 'text-sidebar-primary' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground',
        )}
      />
      {!collapsed && <span className="truncate">{item.title}</span>}
    </NavLink>
  );

  const groupLabel = (label: string) =>
    !collapsed && (
      <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/35">
        {label}
      </p>
    );

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 print:hidden',
        collapsed ? 'w-[68px]' : 'w-64',
      )}
    >
      {/* Marca */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        {profile?.company_logo_url ? (
          <img
            src={profile.company_logo_url}
            alt="Logo"
            className={cn('h-9 w-9 shrink-0 rounded-lg bg-white object-contain p-1', collapsed && 'mx-auto')}
          />
        ) : (
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-gradient shadow-[0_0_24px_-6px_hsl(var(--sidebar-primary)/0.7)]',
              collapsed && 'mx-auto',
            )}
          >
            <Target className="h-5 w-5 text-black" />
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-display text-[15px] font-semibold text-white">
              {profile?.company_name || 'CRM Prospect'}
            </p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-sidebar-primary/80">CRM</p>
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-20 z-10 h-6 w-6 rounded-full border border-sidebar-border bg-sidebar text-sidebar-primary shadow-md hover:bg-sidebar-accent hover:text-sidebar-primary"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </Button>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-0.5">
            {groupLabel(group.label)}
            {group.items.map(renderLink)}
          </div>
        ))}

        {isAdmin && (
          <div className="space-y-0.5">
            {groupLabel('Administração')}
            {adminItems.map(renderLink)}
          </div>
        )}
      </nav>

      <div className="space-y-0.5 border-t border-sidebar-border p-3">
        {bottomItems.map(renderLink)}

        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
            collapsed && 'justify-center px-0',
          )}
          title={isDark ? 'Modo claro' : 'Modo escuro'}
        >
          {isDark ? <Sun className="h-[18px] w-[18px] shrink-0" /> : <Moon className="h-[18px] w-[18px] shrink-0" />}
          {!collapsed && <span>{isDark ? 'Modo claro' : 'Modo escuro'}</span>}
        </button>

        {!collapsed && profile && (
          <div className="mt-2 flex items-center gap-3 rounded-lg bg-sidebar-accent/50 px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-gradient text-sm font-semibold text-black">
              {profile.full_name?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{profile.full_name || 'Usuário'}</p>
              <p className="truncate text-xs text-sidebar-foreground/45">{profile.email}</p>
            </div>
          </div>
        )}

        <button
          onClick={signOut}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/55 transition-colors hover:bg-red-500/10 hover:text-red-400',
            collapsed && 'justify-center px-0',
          )}
          title="Sair"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
