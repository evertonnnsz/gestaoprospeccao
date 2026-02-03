import { 
  LayoutDashboard, 
  Users, 
  Target, 
  BarChart3, 
  Settings, 
  LogOut,
  UserCheck,
  UsersRound,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  DollarSign,
  Sparkles,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const navItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Leads', url: '/leads', icon: Users },
  { title: 'Prospecção', url: '/prospecting', icon: Sparkles },
  { title: 'Clientes', url: '/clients', icon: Briefcase },
  { title: 'Financeiro', url: '/financial', icon: DollarSign },
  { title: 'Funil', url: '/funnel', icon: Target },
  { title: 'Métricas', url: '/metrics', icon: BarChart3 },
];

const adminItems = [
  { title: 'Aprovações', url: '/approvals', icon: UserCheck },
  { title: 'Usuários', url: '/users', icon: UsersRound },
];

const bottomItems = [
  { title: 'Configurações', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { isAdmin, signOut, profile } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside 
      className={cn(
        "h-screen bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 relative",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-3">
            {profile?.company_logo_url ? (
              <img 
                src={profile.company_logo_url} 
                alt="Logo" 
                className="w-9 h-9 rounded-lg object-contain"
              />
            ) : (
              <div className="w-9 h-9 bg-sidebar-primary rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-sidebar-primary-foreground" />
              </div>
            )}
            <span className="font-semibold text-lg">{profile?.company_name || 'CRM Prospect'}</span>
          </div>
        )}
        {collapsed && (
          <>
            {profile?.company_logo_url ? (
              <img 
                src={profile.company_logo_url} 
                alt="Logo" 
                className="w-9 h-9 rounded-lg object-contain mx-auto"
              />
            ) : (
              <div className="w-9 h-9 bg-sidebar-primary rounded-lg flex items-center justify-center mx-auto">
                <Target className="w-5 h-5 text-sidebar-primary-foreground" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Toggle button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-sidebar-accent border border-sidebar-border text-sidebar-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground z-10"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </Button>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
              isActive(item.url)
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className={cn("pt-4 pb-2", collapsed ? "hidden" : "")}>
              <span className="text-xs uppercase text-sidebar-foreground/50 font-semibold px-3">
                Admin
              </span>
            </div>
            {adminItems.map((item) => (
              <NavLink
                key={item.url}
                to={item.url}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive(item.url)
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span>{item.title}</span>}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Bottom section */}
      <div className="p-3 space-y-1 border-t border-sidebar-border">
        {bottomItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
              isActive(item.url)
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        ))}

        {!collapsed && profile && (
          <div className="flex items-center gap-3 px-3 py-2 mt-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-medium">
              {profile.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile.full_name || 'Usuário'}</p>
              <p className="text-xs text-sidebar-foreground/50 truncate">{profile.email}</p>
            </div>
          </div>
        )}

        <button
          onClick={signOut}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all w-full",
            "text-destructive hover:bg-destructive/10"
          )}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
