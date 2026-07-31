import React, { useState, useEffect } from 'react';
import { usersApi } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { PAGES } from '@/lib/pages';
import PageHeader from '@/components/ui/PageHeader';
import {
  UserPlus, Trash2, Shield, ShieldCheck, Loader2, X, KeyRound, Check, Users as UsersIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';

const field =
  'w-full rounded-lg bg-background/60 border border-border px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50';

export default function UserManagement() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // user object or 'new'

  const load = async () => {
    setLoading(true);
    try {
      setUsers(await usersApi.list());
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (me && me.role !== 'admin') {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-foreground font-semibold">Acesso restrito</p>
        <p className="text-sm text-muted-foreground">Apenas administradores podem gerenciar usuários.</p>
      </div>
    );
  }

  const remove = async (u) => {
    if (!window.confirm(`Excluir ${u.email}?`)) return;
    try {
      await usersApi.remove(u.id);
      toast.success('Usuário excluído');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title="Controle de Usuários" subtitle="Crie usuários e defina acesso a páginas e recursos" />

      <div className="flex justify-end mb-4">
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground font-semibold py-2 px-4 text-sm hover:opacity-90 glow-primary"
        >
          <UserPlus className="w-4 h-4" /> Novo usuário
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="glass rounded-xl border border-border/60 overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border/60">
                <th className="px-4 py-3">Usuário</th>
                <th className="px-4 py-3">Função</th>
                <th className="px-4 py-3">Acesso</th>
                <th className="px-4 py-3">2FA</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/40 hover:bg-background/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-background/60 border border-border overflow-hidden flex items-center justify-center">
                        {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" alt="" /> : <UsersIcon className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div>
                        <p className="text-foreground">{u.full_name || '—'}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${u.role === 'admin' ? 'bg-accent/15 text-accent' : 'bg-muted/20 text-muted-foreground'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {u.role === 'admin' ? 'Todas as páginas' : `${(u.permissions || []).length} páginas`}
                  </td>
                  <td className="px-4 py-3">
                    {u.totp_enabled ? <ShieldCheck className="w-4 h-4 text-accent" /> : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <button onClick={() => setEditing(u)} className="text-xs text-primary hover:underline">Editar</button>
                    {u.id !== me?.id && (
                      <button onClick={() => remove(u)} className="text-xs text-destructive hover:underline">Excluir</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <UserEditor
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function UserEditor({ initial, onClose, onSaved }) {
  const isNew = !initial;
  const [email, setEmail] = useState(initial?.email || '');
  const [fullName, setFullName] = useState(initial?.full_name || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(initial?.role || 'user');
  const [isActive, setIsActive] = useState(initial ? initial.is_active : true);
  const [perms, setPerms] = useState(new Set(initial?.permissions || []));
  const [saving, setSaving] = useState(false);

  const toggle = (key) => {
    const n = new Set(perms);
    n.has(key) ? n.delete(key) : n.add(key);
    setPerms(n);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        full_name: fullName,
        role,
        is_active: isActive,
        permissions: Array.from(perms),
      };
      if (isNew) {
        if (!email.trim()) throw new Error('E-mail obrigatório');
        await usersApi.create({ ...payload, email: email.trim(), password: password || '123456' });
        toast.success('Usuário criado');
      } else {
        await usersApi.update(initial.id, payload);
        if (password) await usersApi.resetPassword(initial.id, password);
        toast.success('Usuário atualizado');
      }
      onSaved();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-strong rounded-2xl border border-border/60 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-foreground">{isNew ? 'Novo usuário' : 'Editar usuário'}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">E-mail</label>
            <input disabled={!isNew} className={`${field} mt-1 disabled:opacity-60`} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Nome completo</label>
            <input className={`${field} mt-1`} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              {isNew ? 'Senha' : 'Nova senha (opcional)'}
            </label>
            <input type="password" className={`${field} mt-1`} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isNew ? 'padrão: 123456' : 'deixe em branco p/ manter'} />
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Função</label>
            <select className={`${field} mt-1`} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="user">user</option>
              <option value="admin">admin (acesso total)</option>
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground mb-5">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-primary" />
          Usuário ativo
        </label>

        <div className={role === 'admin' ? 'opacity-40 pointer-events-none' : ''}>
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Acesso a páginas / recursos {role === 'admin' && '(admin vê tudo)'}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
            {PAGES.map((p) => (
              <label key={p.key} className="flex items-center gap-2 text-xs text-foreground bg-background/40 border border-border/50 rounded-lg px-3 py-2 cursor-pointer hover:border-primary/50">
                <input type="checkbox" checked={perms.has(p.key)} onChange={() => toggle(p.key)} className="accent-primary" />
                {p.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border py-2 px-4 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground font-semibold py-2 px-4 text-sm hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
