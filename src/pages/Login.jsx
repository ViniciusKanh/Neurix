import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Loader2, ShieldCheck, ArrowRight, Lock, Mail } from 'lucide-react';
import { ModaraLogoMark } from '@/components/layout/ModaraLogo';

export default function Login() {
  const { login, verify2FA } = useAuth();
  const [phase, setPhase] = useState('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submitCredentials = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await login(email.trim(), password);
      if (res.requires_2fa) { setChallenge(res.challenge); setPhase('2fa'); }
    } catch (err) {
      setError(err.message || 'Falha no login');
    } finally { setLoading(false); }
  };

  const submit2FA = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await verify2FA(challenge, code.trim());
    } catch (err) {
      setError(err.message || 'Código inválido');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-background bg-grid-pattern px-4">
      {/* Animated glow orbs */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/20 blur-[120px] animate-glow-pulse" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full bg-accent/20 blur-[130px] animate-glow-pulse" style={{ animationDelay: '1s' }} />
      <div className="pointer-events-none absolute inset-0 bg-scan-lines opacity-30" />

      {/* Floating logo mark watermark */}
      <div className="pointer-events-none absolute right-[8%] top-[12%] opacity-[0.05] hidden lg:block">
        <ModaraLogoMark size={280} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-3">
            <div className="absolute inset-0 rounded-3xl bg-primary/30 blur-2xl scale-150" />
            <ModaraLogoMark size={72} className="relative" />
          </div>
          <h1 className="font-display font-extrabold text-3xl tracking-[0.3em] text-gradient-primary">NEURIX</h1>
          <p className="text-[10px] text-primary/50 font-mono uppercase tracking-[0.35em] mt-2">
            ML Workbench · 100% Local
          </p>
        </div>

        {/* Card */}
        <div className="glass-strong rounded-2xl border border-primary/15 p-7 shadow-[0_0_40px_-10px_hsla(185,100%,50%,0.3)]">
          {phase === 'credentials' ? (
            <form onSubmit={submitCredentials} className="space-y-5">
              <div>
                <h2 className="text-lg font-display font-bold text-foreground tracking-wide">Acessar plataforma</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Entre com suas credenciais</p>
              </div>

              <Field icon={Mail} label="E-mail">
                <input type="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="login-input" placeholder="voce@exemplo.com" />
              </Field>

              <Field icon={Lock} label="Senha">
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="login-input" placeholder="••••••••" />
              </Field>

              {error && <ErrorMsg>{error}</ErrorMsg>}

              <SubmitBtn loading={loading}>Entrar <ArrowRight className="w-4 h-4" /></SubmitBtn>
            </form>
          ) : (
            <form onSubmit={submit2FA} className="space-y-5">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center glow-accent">
                  <ShieldCheck className="w-6 h-6 text-accent" />
                </div>
                <h2 className="text-lg font-display font-bold text-foreground">Verificação em duas etapas</h2>
                <p className="text-xs text-muted-foreground">Digite o código de 6 dígitos do seu app autenticador</p>
              </div>

              <input inputMode="numeric" autoFocus maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center tracking-[0.6em] font-mono text-2xl rounded-xl bg-background/60 border border-border px-3 py-4 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="000000" />

              {error && <ErrorMsg>{error}</ErrorMsg>}

              <SubmitBtn loading={loading} disabled={code.length < 6}>Verificar</SubmitBtn>
              <button type="button" onClick={() => { setPhase('credentials'); setCode(''); setError(''); }}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors">← Voltar</button>
            </form>
          )}
        </div>

        <p className="text-center text-[10px] text-muted-foreground/50 mt-6 font-mono tracking-wider">
          NEURIX © {new Date().getFullYear()} · Machine Learning sem LLM externo
        </p>
      </div>

      <style>{`
        .login-input {
          width: 100%;
          border-radius: 0.6rem;
          background: hsla(220, 40%, 8%, 0.6);
          border: 1px solid hsl(var(--border));
          padding: 0.65rem 0.75rem;
          font-size: 0.875rem;
          color: hsl(var(--foreground));
          transition: border-color .15s, box-shadow .15s;
        }
        .login-input:focus { outline: none; border-color: hsl(var(--primary)); box-shadow: 0 0 0 2px hsla(185,100%,50%,0.25); }
        .login-input::placeholder { color: hsl(var(--muted-foreground)); }
      `}</style>
    </div>
  );
}

function Field({ icon: Icon, label, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
        <Icon className="w-3 h-3" /> {label}
      </label>
      {children}
    </div>
  );
}

function ErrorMsg({ children }) {
  return <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">{children}</p>;
}

function SubmitBtn({ loading, disabled, children }) {
  return (
    <button type="submit" disabled={loading || disabled}
      className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold py-3 text-sm hover:opacity-90 transition disabled:opacity-40 glow-primary">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : children}
    </button>
  );
}
