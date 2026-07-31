import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44, settingsApi } from '@/api/base44Client';
import PageHeader from '@/components/ui/PageHeader';
import {
  User as UserIcon, Shield, Database, Camera, Loader2, Check,
  KeyRound, ShieldCheck, ShieldOff, Palette, Mail, Send,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { THEMES, applyTheme, getThemeId } from '@/lib/theme';
import { ModaraLogoMark } from '@/components/layout/ModaraLogo';

const BASE_TABS = [
  { key: 'profile', label: 'Perfil', icon: UserIcon },
  { key: 'appearance', label: 'Aparência', icon: Palette },
  { key: 'security', label: 'Segurança', icon: Shield },
  { key: 'connection', label: 'Conexão Turso', icon: Database },
];

export default function Settings() {
  const { user, setUser, refreshUser } = useAuth();
  const [tab, setTab] = useState('profile');

  if (!user) return null;

  const isAdmin = user.role === 'admin';
  const TABS = isAdmin
    ? [...BASE_TABS.slice(0, 3), { key: 'email', label: 'Email', icon: Mail }, ...BASE_TABS.slice(3)]
    : BASE_TABS;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Configurações" subtitle="Gerencie seu perfil, segurança e conexão" />

      <div className="flex gap-1 sm:gap-2 mb-6 border-b border-border/60 overflow-x-auto scrollbar-thin">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && <ProfileTab user={user} setUser={setUser} refreshUser={refreshUser} />}
      {tab === 'appearance' && <AppearanceTab />}
      {tab === 'email' && isAdmin && <EmailTab />}
      {tab === 'security' && <SecurityTab user={user} refreshUser={refreshUser} />}
      {tab === 'connection' && <ConnectionTab />}
    </div>
  );
}

function Card({ children, title, desc }) {
  return (
    <div className="glass rounded-xl border border-border/60 p-6 mb-5">
      {title && <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>}
      {desc && <p className="text-xs text-muted-foreground mb-4">{desc}</p>}
      {children}
    </div>
  );
}

const field =
  'w-full rounded-lg bg-background/60 border border-border px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50';
const btn =
  'flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-semibold py-2.5 px-4 text-sm hover:opacity-90 transition disabled:opacity-50';

// ---------------------------------------------------------------- Profile
function ProfileTab({ user, setUser, refreshUser }) {
  const [fullName, setFullName] = useState(user.full_name || '');
  const [avatar, setAvatar] = useState(user.avatar_url || '');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const pickAvatar = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast.error('Selecione um arquivo de imagem');
    // Resize client-side (max 256px, JPEG) so any photo works and stays small.
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 256;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0C1119';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        setAvatar(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => toast.error('Não foi possível ler a imagem');
      img.src = String(reader.result);
    };
    reader.onerror = () => toast.error('Falha ao carregar o arquivo');
    reader.readAsDataURL(f);
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await base44.auth.updateProfile({ full_name: fullName, avatar_url: avatar });
      setUser(updated);
      await refreshUser();
      toast.success('Perfil atualizado');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Dados do perfil" desc="Nome e foto exibidos no aplicativo.">
      <div className="flex items-center gap-5 mb-5">
        <div className="relative">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-background/60 border border-border flex items-center justify-center">
            {avatar ? (
              <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickAvatar} />
        </div>
        <div className="text-sm">
          <p className="text-foreground font-medium">{user.email}</p>
          <p className="text-muted-foreground text-xs capitalize">Função: {user.role}</p>
        </div>
      </div>

      <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Nome completo</label>
      <input className={`${field} mt-1 mb-4`} value={fullName} onChange={(e) => setFullName(e.target.value)} />

      <button onClick={save} disabled={saving} className={btn}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        Salvar alterações
      </button>
    </Card>
  );
}

// ---------------------------------------------------------------- Appearance
function AppearanceTab() {
  const [current, setCurrent] = useState(getThemeId());

  const choose = (id) => { applyTheme(id); setCurrent(id); toast.success('Aparência atualizada'); };

  return (
    <>
      <Card title="Cor de destaque" desc="Personalize a cor principal do Neurix. A mudança é aplicada em todo o app, incluindo o logo.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {THEMES.map((t) => {
            const active = current === t.id;
            return (
              <button
                key={t.id}
                onClick={() => choose(t.id)}
                className={`relative rounded-xl border p-3 flex flex-col items-center gap-2 transition ${
                  active ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/40'
                }`}
              >
                <div className="flex -space-x-2">
                  <span className="w-7 h-7 rounded-full border-2 border-background" style={{ background: `hsl(${t.primary})` }} />
                  <span className="w-7 h-7 rounded-full border-2 border-background" style={{ background: `hsl(${t.accent})` }} />
                </div>
                <span className="text-[11px] font-medium text-foreground">{t.name}</span>
                {active && <Check className="w-3.5 h-3.5 text-primary absolute top-2 right-2" />}
              </button>
            );
          })}
        </div>
      </Card>

      <Card title="Pré-visualização">
        <div className="flex flex-wrap items-center gap-4">
          <ModaraLogoMark size={48} />
          <button className="rounded-lg bg-primary text-primary-foreground font-semibold py-2 px-4 text-sm glow-primary">Botão primário</button>
          <span className="px-3 py-1 rounded-full text-xs bg-accent/15 text-accent">Badge de destaque</span>
          <span className="text-gradient-primary font-display font-bold text-lg tracking-widest">NEURIX</span>
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- Security
function SecurityTab({ user, refreshUser }) {
  return (
    <>
      <PasswordCard />
      <TwoFactorCard user={user} refreshUser={refreshUser} />
    </>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (next.length < 6) return toast.error('Nova senha muito curta (mín. 6)');
    setSaving(true);
    try {
      await base44.auth.changePassword(current, next);
      setCurrent(''); setNext('');
      toast.success('Senha alterada');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Alterar senha">
      <input type="password" placeholder="Senha atual" className={`${field} mb-3`} value={current} onChange={(e) => setCurrent(e.target.value)} />
      <input type="password" placeholder="Nova senha" className={`${field} mb-4`} value={next} onChange={(e) => setNext(e.target.value)} />
      <button onClick={save} disabled={saving} className={btn}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
        Atualizar senha
      </button>
    </Card>
  );
}

function TwoFactorCard({ user, refreshUser }) {
  const [setup, setSetup] = useState(null); // { secret, qr, otpauth_url }
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const startSetup = async () => {
    setLoading(true);
    try {
      const res = await base44.auth.setup2FA();
      setSetup(res);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const enable = async () => {
    setLoading(true);
    try {
      await base44.auth.enable2FA(code);
      await refreshUser();
      setSetup(null); setCode('');
      toast.success('2FA ativado');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const disable = async () => {
    const c = window.prompt('Digite um código do autenticador para desativar o 2FA:');
    if (!c) return;
    setLoading(true);
    try {
      await base44.auth.disable2FA(c);
      await refreshUser();
      toast.success('2FA desativado');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Autenticação em duas etapas (2FA)" desc="Use um app autenticador (Google Authenticator, Authy, Microsoft Authenticator).">
      {user.totp_enabled ? (
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-accent">
            <ShieldCheck className="w-4 h-4" /> 2FA está ativado
          </span>
          <button onClick={disable} disabled={loading} className="flex items-center gap-2 rounded-lg border border-destructive/50 text-destructive py-2 px-3 text-sm hover:bg-destructive/10">
            <ShieldOff className="w-4 h-4" /> Desativar
          </button>
        </div>
      ) : setup ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3">
            <img src={setup.qr} alt="QR 2FA" className="w-44 h-44 rounded-lg bg-white p-2" />
            <p className="text-xs text-muted-foreground text-center">
              Escaneie o QR ou insira a chave manualmente:
            </p>
            <code className="text-[11px] font-mono bg-background/60 border border-border rounded px-2 py-1 break-all text-center">
              {setup.secret}
            </code>
          </div>
          <input
            inputMode="numeric"
            maxLength={6}
            placeholder="Código de 6 dígitos"
            className={`${field} text-center tracking-[0.4em] font-mono`}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button onClick={enable} disabled={loading || code.length < 6} className={btn}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Confirmar e ativar
          </button>
        </div>
      ) : (
        <button onClick={startSetup} disabled={loading} className={btn}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
          Configurar 2FA
        </button>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- Email (admin)
function EmailTab() {
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState('');

  useEffect(() => {
    settingsApi.getEmail()
      .then((c) => setCfg({ enabled: false, host: 'smtp.gmail.com', port: 465, from_name: 'Neurix', user: '', pass: '', ...c }))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const saved = await settingsApi.saveEmail(cfg);
      setCfg((c) => ({ ...c, ...saved }));
      toast.success('Configuração de e-mail salva');
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true);
    try {
      await settingsApi.testEmail({ ...cfg, to: testTo || undefined });
      toast.success('E-mail de teste enviado! Verifique a caixa de entrada.');
    } catch (e) { toast.error(e.message); } finally { setTesting(false); }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <>
      <Card title="Servidor de e-mail (SMTP)" desc="Usado para confirmação de cadastro, redefinição de senha e alertas. Com o Gmail, gere uma 'senha de app' em myaccount.google.com/apppasswords e cole abaixo.">
        <label className="flex items-center gap-2 text-sm text-foreground mb-4">
          <input type="checkbox" checked={cfg.enabled} onChange={(e) => set('enabled', e.target.checked)} className="accent-primary" />
          Ativar envio de e-mails
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Host SMTP</label>
            <input className={`${field} mt-1`} value={cfg.host} onChange={(e) => set('host', e.target.value)} placeholder="smtp.gmail.com" />
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Porta</label>
            <input className={`${field} mt-1`} value={cfg.port} onChange={(e) => set('port', e.target.value)} placeholder="465" />
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">E-mail (usuário)</label>
            <input className={`${field} mt-1`} value={cfg.user} onChange={(e) => set('user', e.target.value)} placeholder="voce@gmail.com" />
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Senha de app</label>
            <input type="password" className={`${field} mt-1`} value={cfg.pass} onChange={(e) => set('pass', e.target.value)} placeholder="•••• •••• •••• ••••" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Nome do remetente</label>
            <input className={`${field} mt-1`} value={cfg.from_name} onChange={(e) => set('from_name', e.target.value)} placeholder="Neurix" />
          </div>
        </div>

        <button onClick={save} disabled={saving} className={`${btn} mt-4`}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Salvar configuração
        </button>
      </Card>

      <Card title="Testar envio" desc="Envie um e-mail de teste para confirmar que está tudo certo.">
        <div className="flex flex-col sm:flex-row gap-3">
          <input className={field} value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="destinatário (opcional — padrão: seu e-mail)" />
          <button onClick={test} disabled={testing} className={btn}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar teste
          </button>
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- Connection
function ConnectionTab() {
  const dbUrl = import.meta.env.VITE_PUBLIC_TURSO_URL || 'não configurado';
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    try {
      const r = await fetch('/api/auth/health').then((x) => x.json());
      setStatus(r);
    } catch (e) {
      setStatus({ ok: false, error: e.message });
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card title="Banco de dados Turso" desc="A conexão é feita no servidor. O token de acesso fica em variáveis de ambiente e nunca é exposto ao navegador.">
      <div className="space-y-3 text-sm">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Database URL</span>
          <p className="font-mono text-xs bg-background/60 border border-border rounded px-3 py-2 mt-1 break-all">{dbUrl}</p>
        </div>
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Auth token</span>
          <p className="font-mono text-xs bg-background/60 border border-border rounded px-3 py-2 mt-1">
            •••••••••• (definido via TURSO_AUTH_TOKEN no .env / Vercel)
          </p>
        </div>

        <button onClick={check} disabled={checking} className={btn}>
          {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          Testar conexão
        </button>

        {status && (
          <p className={`text-sm ${status.ok ? 'text-accent' : 'text-destructive'}`}>
            {status.ok ? '✓ Conectado ao Turso' : `✗ ${status.error || 'Falha na conexão'}`}
          </p>
        )}

        <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/50">
          Para alterar as credenciais, edite <code className="font-mono">.env</code> (local) ou as Environment
          Variables no painel da Vercel e reinicie o servidor.
        </p>
      </div>
    </Card>
  );
}
