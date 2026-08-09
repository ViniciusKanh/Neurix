import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, Database, BarChart3, BarChart2,
  Brain, FileText, ChevronLeft, ChevronRight,
  Network, Menu, X, GitBranch, Activity, Zap, BookOpen,
  Rocket, Swords, TrendingUp,
  Download, FlaskConical, Settings2, PackageSearch,
  ChevronDown, GitCompare, History, Wand2,
  Settings, UsersRound, LogOut,
  SlidersHorizontal, Layers as LayersIcon, TerminalSquare, Sigma,
  MapPin, Combine
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ModaraWordmark, ModaraLogoMark } from './ModaraLogo';
import { useAuth } from '@/lib/AuthContext';
import { pathToKey } from '@/lib/pages';

const NAV_GROUPS = [
  {
    label: 'Principal',
    items: [
      { icon: LayoutDashboard, label: 'Painel', path: '/' },
      { icon: BarChart3, label: 'Analytics Dashboard', path: '/analytics' },
      { icon: FolderOpen, label: 'Projetos', path: '/projects' },
    ],
  },
  {
    label: 'Análise & Dados',
    items: [
      { icon: Database, label: 'Explorador de Dados', path: '/explorer' },
      { icon: BarChart2, label: 'Perfilamento de Dados', path: '/data-profiling' },
      { icon: TerminalSquare, label: 'Workbench SQL', path: '/sql' },
      { icon: Sigma, label: 'Laboratório Estatístico', path: '/statistics' },
      { icon: Wand2, label: 'Feature Engineering', path: '/feature-lab' },
      { icon: FileText, label: 'Text Mining / NLP', path: '/text-mining' },
      { icon: MapPin, label: 'Mineração Geoespacial', path: '/geo' },
      { icon: Combine, label: 'Join & Blend', path: '/blend' },
      { icon: Download, label: 'Exportar Dataset', path: '/dataset-export' },
    ],
  },
  {
    label: 'Modelagem',
    items: [
      { icon: Brain, label: 'ML Studio', path: '/ml-studio' },
      { icon: SlidersHorizontal, label: 'Laboratório do Modelo', path: '/model-lab' },
      { icon: FlaskConical, label: 'Testes ML Avançados', path: '/advanced-ml' },
      { icon: Zap, label: 'AutoML Pipeline', path: '/automl' },
      { icon: GitBranch, label: 'Comparação de Modelos', path: '/model-comparison' },
      { icon: Settings2, label: 'Hyperparameter Tuning', path: '/hyperparam-tuning' },
      { icon: GitBranch, label: 'Regra de Associação', path: '/association-rules' },
      { icon: GitBranch, label: 'Padrões Sequenciais', path: '/sequences' },
      { icon: TrendingUp, label: 'Séries Temporais', path: '/time-series' },
    ],
  },
  {
    label: 'MLOps',
    items: [
      { icon: Wand2, label: 'Inferência & Retreino', path: '/inference' },
      { icon: LayersIcon, label: 'Scoring em Lote', path: '/batch-score' },
      { icon: Rocket, label: 'Deploy', path: '/deploy' },
      { icon: Activity, label: 'Monitoramento', path: '/monitoring' },
      { icon: History, label: 'Histórico de Runs', path: '/pipeline-history' },
    ],
  },
  {
    label: 'Experimentos',
    items: [
      { icon: Swords, label: 'Champion vs Challenger', path: '/champion-challenger' },
      { icon: Swords, label: 'Testes A/B', path: '/ab-test' },
    ],
  },
  {
    label: 'Relatórios & Docs',
    items: [
      { icon: FileText, label: 'Relatórios', path: '/reports' },
      { icon: FlaskConical, label: 'Exportar PDF', path: '/pdf-export' },
      { icon: PackageSearch, label: 'Docs de Modelos', path: '/model-docs' },
    ],
  },
  {
    label: 'Extra',
    items: [
      { icon: Network, label: 'Visualização 3D', path: '/visualization-3d' },
    ],
  },
];

function NavGroup({ group, collapsed, mobileOpen, onLinkClick }) {
  const location = useLocation();
  const [open, setOpen] = useState(true);
  const isAnyActive = group.items.some(
    item => location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))
  );

  return (
    <div className="mb-1">
      {(!collapsed || mobileOpen) && (
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          <span>{group.label}</span>
          <ChevronDown className={cn('w-3 h-3 transition-transform', !open && '-rotate-90')} />
        </button>
      )}
      <AnimatePresence initial={false}>
        {(open || collapsed) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {group.items.map(item => {
              const isActive = location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onLinkClick}
                  title={collapsed && !mobileOpen ? item.label : undefined}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-md text-[11px] font-semibold tracking-wide transition-all duration-150 relative group',
                    'hover:bg-primary/8',
                    isActive
                      ? 'bg-primary/10 text-primary border-l-2 border-primary'
                      : 'text-sidebar-foreground/60 hover:text-primary/80 border-l-2 border-transparent'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-full"
                    />
                  )}
                  <item.icon className={cn('w-3.5 h-3.5 flex-shrink-0', isActive && 'text-primary')} />
                  <AnimatePresence>
                    {(!collapsed || mobileOpen) && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.15 }}
                        className="truncate whitespace-nowrap overflow-hidden"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {collapsed && !mobileOpen && (
                    <span className="absolute left-14 z-50 pointer-events-none px-2 py-1 rounded-md bg-popover text-popover-foreground text-xs shadow-lg border border-border whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// LogoMark is now handled by ModaraWordmark / ModaraLogoMark

const NavContent = ({ collapsed, mobileOpen, onLinkClick, onToggle }) => {
  const { user, canAccess, logout } = useAuth();

  // Filter nav items by the user's page permissions (admins see everything).
  const visibleGroups = NAV_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        const key = pathToKey(item.path);
        return !key || canAccess(key);
      }),
    }))
    .filter(group => group.items.length > 0);

  // System group (Settings for everyone; Users only for admins)
  const systemItems = [{ icon: Settings, label: 'Configurações', path: '/settings' }];
  if (user?.role === 'admin') {
    systemItems.push({ icon: UsersRound, label: 'Controle de Usuários', path: '/users' });
  }
  const groups = [...visibleGroups, { label: 'Sistema', items: systemItems }];

  return (
    <>
      {/* Logo */}
      <div className="flex items-center px-3 h-14 border-b border-sidebar-border flex-shrink-0">
        {collapsed && !mobileOpen ? (
          <ModaraLogoMark size={30} />
        ) : (
          <ModaraWordmark />
        )}
        {(!collapsed || mobileOpen) && (
          <button
            onClick={onToggle}
            className="ml-auto hidden sm:flex items-center justify-center w-6 h-6 rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 px-2 overflow-y-auto scrollbar-thin">
        {groups.map(group => (
          <NavGroup
            key={group.label}
            group={group}
            collapsed={collapsed}
            mobileOpen={mobileOpen}
            onLinkClick={onLinkClick}
          />
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border flex-shrink-0 p-2">
        {(!collapsed || mobileOpen) ? (
          <div className="flex items-center gap-2 px-1.5 py-1.5">
            <div className="w-7 h-7 rounded-full bg-background/60 border border-border overflow-hidden flex items-center justify-center flex-shrink-0">
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                : <UsersRound className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-sidebar-foreground truncate">{user?.full_name || user?.email}</p>
              <p className="text-[9px] text-muted-foreground truncate capitalize">{user?.role}</p>
            </div>
            <button onClick={logout} title="Sair" className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button onClick={logout} title="Sair" className="w-full flex items-center justify-center py-1.5 rounded-lg hover:bg-sidebar-accent text-muted-foreground hover:text-destructive transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && !mobileOpen && (
        <div className="hidden sm:block p-2 border-t border-sidebar-border flex-shrink-0">
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-center py-1.5 rounded-lg hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
};

export default function Sidebar({ collapsed, onToggle, mobileMenuOpen, onMobileMenuChange }) {
  const mobileOpen = mobileMenuOpen ?? false;
  const closeMobile = () => onMobileMenuChange?.(false);

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            className="sm:hidden fixed inset-0 bg-black z-40"
            onClick={closeMobile}
          />
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: -270 }}
            animate={{ x: 0 }}
            exit={{ x: -270 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="sm:hidden fixed left-0 top-0 h-screen z-50 w-72 flex flex-col bg-sidebar border-r border-sidebar-border shadow-2xl"
          >
            <button
              onClick={closeMobile}
              className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <NavContent collapsed={false} mobileOpen={true} onLinkClick={closeMobile} onToggle={closeMobile} />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className={cn(
        'hidden sm:flex fixed left-0 top-0 h-screen z-40 flex-col transition-all duration-250 ease-out',
        'bg-sidebar border-r border-sidebar-border',
        collapsed ? 'w-14' : 'w-56'
      )}>
        <NavContent collapsed={collapsed} mobileOpen={false} onLinkClick={() => {}} onToggle={onToggle} />
      </aside>
    </>
  );
}