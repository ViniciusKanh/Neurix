import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  ChevronDown, Settings, UsersRound, LogOut, User as UserIcon,
  ShieldCheck, Shield, Mail,
} from 'lucide-react';

export default function UserMenu({ compact = false }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) return null;

  const go = (path) => { setOpen(false); navigate(path); };

  const Avatar = ({ size = 28 }) => (
    <div
      className="rounded-full overflow-hidden bg-background/60 border border-primary/40 flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {user.avatar_url
        ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
        : <UserIcon className="text-muted-foreground" style={{ width: size * 0.5, height: size * 0.5 }} />}
    </div>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-colors"
      >
        <Avatar size={compact ? 26 : 28} />
        {!compact && (
          <span className="text-xs font-semibold text-foreground max-w-[130px] truncate hidden md:block">
            {user.full_name || user.email}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl glass-strong border border-border/60 shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-border/50 flex items-center gap-3">
            <Avatar size={44} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{user.full_name || 'Sem nome'}</p>
              <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                <Mail className="w-3 h-3" /> {user.email}
              </p>
            </div>
          </div>

          {/* Meta */}
          <div className="px-4 py-3 space-y-2 border-b border-border/50">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Função</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${user.role === 'admin' ? 'bg-accent/15 text-accent' : 'bg-muted/30 text-muted-foreground'}`}>
                {user.role}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">2FA</span>
              {user.totp_enabled
                ? <span className="flex items-center gap-1 text-accent text-[11px]"><ShieldCheck className="w-3.5 h-3.5" /> Ativado</span>
                : <span className="flex items-center gap-1 text-muted-foreground text-[11px]"><Shield className="w-3.5 h-3.5" /> Desativado</span>}
            </div>
          </div>

          {/* Actions */}
          <div className="p-1.5">
            <button onClick={() => go('/settings')} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-primary/10 transition-colors">
              <Settings className="w-4 h-4 text-muted-foreground" /> Configurações
            </button>
            {user.role === 'admin' && (
              <button onClick={() => go('/users')} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-primary/10 transition-colors">
                <UsersRound className="w-4 h-4 text-muted-foreground" /> Controle de Usuários
              </button>
            )}
            <div className="my-1 border-t border-border/50" />
            <button onClick={logout} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors">
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
