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
  HeartHandshake,
  ClipboardCheck,
  MessageCircle,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const navGroups = [
  {
    label: 'Vis\u00e3o geral',
    items: [
      { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
      { title: 'Funil', url: '/funnel', icon: Target },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { title: 'Leads', url: '/leads', icon: Users },
      { title: 'Prospec\u00e7\u00e3o', url: '/prospecting', icon: Sparkles },
      { title: 'Clientes', url: '/clients', icon: Briefcase },
    ],
  },
  {
    label: 'Opera\u00e7\u00e3o',
    items: [
      { title: 'Sucesso do Cliente', url: '/customer-success', icon: HeartHandshake },
      { title: 'Onboarding', url: '/onboarding', icon: ClipboardCheck },
      { title: 'Financeiro', url: '/financial', icon: DollarSign },
    ],
  },
];

const adminItems = [
  { title: 'Aprova\u00e7\u00f5es', url: '/approvals', icon: UserCheck },
  { title: 'Usu\u00e1rios', url: '/users', icon: UsersRound },
  { title: 'Follow-ups WhatsApp', url: '/whatsapp-follow-ups', icon: MessageCircle },
];

const bottomItems = [
  { title: 'Configura\u00e7\u00f5es', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { isAdmin, signOut, profile } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const linkClassName = (path: string) =>
    cn(
      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
      isActive(path)
        ? 'bg-sidebar-primary text-primary shadow-sm'
        : 'text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-foreground'
    );

  return (
    <aside
      className={cn(
        'h-screen bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 relative border-r border-sidebar-border',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border/80">
        {!collapsed && (
          <div className="flex items-center gap-3 min-w-0">
            {profile?.company_logo_url ? (
              <img
                src={profile.company_logo_url}
                alt="Logo"
                className="w-9 h-9 rounded-lg object-contain bg-white/95 p-1"
              />
            ) : (
              <div className="w-9 h-9 bg-sidebar-primary rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-primary" />
              </div>
            )}
            <span className="font-semibold text-base tracking-normal truncate">
              {profile?.company_name || 'CRM Prospect'}
            </span>
          </div>
        )}

        {collapsed && (
          <>
            {profile?.company_logo_url ? (
              <img
                src={profile.company_logo_url}
                alt="Logo"
                className="w-9 h-9 rounded-lg object-contain mx-auto bg-white/95 p-1"
              />
            ) : (
              <div className="w-9 h-9 bg-sidebar-primary rounded-lg flex items-center justify-center mx-auto">
                <Target className="w-5 h-5 text-primary" />
              </div>
            )}
          </>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border text-primary hover:bg-accent hover:text-primary z-10 shadow-sm"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </Button>

      <nav className="flex-1 py-4 px-3 space-y-5 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            {!collapsed && (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/45">
                {group.label}
              </p>
            )}
            {group.items.map((item) => (
              <NavLink key={item.url} to={item.url} className={linkClassName(item.url)}>
                <item.icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span>{item.title}</span>}
              </NavLink>
            ))}
          </div>
        ))}

        {isAdmin && (
          <div className="space-y-1">
            {!collapsed && (
              <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/45">
                Administra\u00e7\u00e3o
              </p>
            )}
            {adminItems.map((item) => (
              <NavLink key={item.url} to={item.url} className={linkClassName(item.url)}>
                <item.icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span>{item.title}</span>}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      <div className="p-3 space-y-1 border-t border-sidebar-border/80">
        {bottomItems.map((item) => (
          <NavLink key={item.url} to={item.url} className={linkClassName(item.url)}>
            <item.icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        ))}

        {!collapsed && profile && (
          <div className="flex items-center gap-3 px-3 py-2 mt-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-primary text-primary flex items-center justify-center text-sm font-semibold">
              {profile.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile.full_name || 'Usu\u00e1rio'}</p>
              <p className="text-xs text-sidebar-foreground/50 truncate">{profile.email}</p>
            </div>
          </div>
        )}

        <button
          onClick={signOut}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all w-full',
            'text-destructive hover:bg-destructive/10'
          )}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
