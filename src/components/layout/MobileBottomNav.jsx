import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderOpen, Database, Brain, Sparkles, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

const BOTTOM_ITEMS = [
  { icon: LayoutDashboard, label: 'Painel', path: '/' },
  { icon: FolderOpen, label: 'Projetos', path: '/projects' },
  { icon: Database, label: 'Dados', path: '/explorer' },
  { icon: Brain, label: 'Modelos', path: '/ml-studio' },
  { icon: Sparkles, label: 'Chat IA', path: '/ai-chat' },
];

export default function MobileBottomNav({ onMenuOpen }) {
  const location = useLocation();

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-sidebar/95 backdrop-blur-md border-t border-sidebar-border safe-area-pb">
      <div className="flex items-center justify-around px-1 py-1">
        {BOTTOM_ITEMS.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-150 min-w-0 flex-1',
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-primary/80'
              )}
            >
              <item.icon className={cn('w-5 h-5', isActive && 'drop-shadow-[0_0_6px_hsl(185,100%,50%)]')} />
              <span className={cn(
                'text-[9px] font-semibold tracking-wide truncate w-full text-center',
                isActive ? 'text-primary' : 'text-muted-foreground/70'
              )}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
        {/* More button */}
        <button
          onClick={onMenuOpen}
          className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-muted-foreground hover:text-primary/80 transition-all flex-1"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[9px] font-semibold tracking-wide text-muted-foreground/70">Mais</span>
        </button>
      </div>
    </nav>
  );
}