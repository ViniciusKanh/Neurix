import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { Loader2, ShieldCheck, ArrowRight, Lock, Mail, User, CheckCircle2, MailCheck } from 'lucide-react';
import { ModaraLogoMark } from '@/components/layout/ModaraLogo';

export default function Login() {
  const { login, verify2FA } = useAuth();
  const [phase, setPhase] = useState('credentials'); // credentials | 2fa | register | forgot | reset | verify | info
  const [info, setInfo] = useState(null);
  const [emailEnabled, setEmailEnabled] = useState(false);

  // shared fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [password2, setPassword2] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [resetToken, setResetToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle email links (?verify=... / ?reset=...) and load config on mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verify = params.get('verify');
    const reset = params.get('reset');
    const clearUrl = () => window.history.replaceState({}, '', window.location.pathname);

    if (verify) {
      setPhase('verify');
      base44.auth.verifyEmail(verify)
        .then(() => { setPhase('info'); setInfo({ icon: 'check', title: 'E-mail confirmado! ✅', text: 'Sua conta está ativa. Você já pode entrar.' }); })
        .catch((e) => { setPhase('info'); setInfo({ icon: 'error', title: 'Não foi possível confirmar', text: e.message }); })
        .finally(clearUrl);
      return;
    }
    if (reset) { setResetToken(reset); setPhase('reset'); clearUrl(); return; }

    base44.auth.config().then((c) => setEmailEnabled(!!c.email_enabled)).catch(() => {});
  }, []);

  const reset = () => { setError(''); setLoading(false); };
  const go = (p) => { reset(); setPassword(''); setPassword2(''); setCode(''); setPhase(p); };

  const submitCredentials = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await login(email.trim(), password);
      if (res.requires_2fa) { setChallenge(res.challenge); setPhase('2fa'); }
    } catch (err) { setError(err.message || 'Falha no login'); } finally { setLoading(false); }
  };

  const submit2FA = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await verify2FA(challenge, code.trim()); }
    catch (err) { setError(err.message || 'Código inválido'); } finally { setLoading(false); }
  };

  const submitRegister = async (e) => {
    e.preventDefault(); setError('');
    if (password !== password2) return setError('As senhas não coincidem');
    if (password.length < 6) return setError('Senha muito curta (mín. 6)');
    setLoading(true);
    try {
      await base44.auth.register({ email: email.trim(), full_name: fullName, password });
      setPhase('info');
      setInfo({ icon: 'mail', title: 'Confirme seu e-mail 📬', text: `Enviamos um link de confirmação para ${email.trim()}. Abra o e-mail e clique no link para ativar sua conta.` });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const submitForgot = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await base44.auth.forgotPassword(email.trim());
      setPhase('info');
      setInfo({ icon: 'mail', title: 'Verifique seu e-mail 📬', text: 'Se este e-mail estiver cadastrado, enviamos um link para redefinir sua senha (válido por 1 hora).' });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const submitReset = async (e) => {
    e.preventDefault(); setError('');
    if (password !== password2) return setError('As senhas não coincidem');
    if (password.length < 6) return setError('Senha muito curta (mín. 6)');
    setLoading(true);
    try {
      await base44.auth.resetPassword(resetToken, password);
      setPhase('info');
      setInfo({ icon: 'check', title: 'Senha redefinida! 🔐', text: 'Sua nova senha está pronta. Faça login para continuar.' });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const titleByPhase = {
    credentials: ['Acessar plataforma', 'Entre com suas credenciais'],
    register: ['Criar conta', 'Cadastre-se para começar'],
    forgot: ['Recuperar senha', 'Enviaremos um link por e-mail'],
    reset: ['Nova senha', 'Defina sua nova senha'],
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-background bg-grid-pattern px-4 py-8">
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/20 blur-[120px] animate-glow-pulse" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full bg-accent/20 blur-[130px] animate-glow-pulse" style={{ animationDelay: '1s' }} />
      <div className="pointer-events-none absolute inset-0 bg-scan-lines opacity-30" />
      <div className="pointer-events-none absolute right-[8%] top-[12%] opacity-[0.05] hidden lg:block"><ModaraLogoMark size={280} /></div>

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-3">
            <div className="absolute inset-0 rounded-3xl bg-primary/30 blur-2xl scale-150" />
            <ModaraLogoMark size={72} className="relative" />
          </div>
          <h1 className="font-display font-extrabold text-3xl tracking-[0.3em] text-gradient-primary">NEURIX</h1>
          <p className="text-[10px] text-primary/50 font-mono uppercase tracking-[0.35em] mt-2">ML Workbench · 100% Local</p>
        </div>

        <div className="glass-strong rounded-2xl border border-primary/15 p-7 shadow-[0_0_40px_-10px_hsla(185,100%,50%,0.3)]">
          {/* header */}
          {titleByPhase[phase] && (
            <div className="mb-5">
              <h2 className="text-lg font-display font-bold text-foreground tracking-wide">{titleByPhase[phase][0]}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{titleByPhase[phase][1]}</p>
            </div>
          )}

          {/* LOGIN */}
          {phase === 'credentials' && (
            <form onSubmit={submitCredentials} className="space-y-4">
              <Field icon={Mail} label="E-mail"><input type="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} className="login-input" placeholder="voce@exemplo.com" /></Field>
              <Field icon={Lock} label="Senha"><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="login-input" placeholder="••••••••" /></Field>
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <SubmitBtn loading={loading}>Entrar <ArrowRight className="w-4 h-4" /></SubmitBtn>
              {emailEnabled && (
                <div className="flex items-center justify-between text-xs pt-1">
                  <button type="button" onClick={() => go('forgot')} className="text-muted-foreground hover:text-primary">Esqueceu a senha?</button>
                  <button type="button" onClick={() => go('register')} className="text-primary hover:underline">Criar conta</button>
                </div>
              )}
            </form>
          )}

          {/* 2FA */}
          {phase === '2fa' && (
            <form onSubmit={submit2FA} className="space-y-5">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center glow-accent"><ShieldCheck className="w-6 h-6 text-accent" /></div>
                <h2 className="text-lg font-display font-bold text-foreground">Verificação em duas etapas</h2>
                <p className="text-xs text-muted-foreground">Digite o código de 6 dígitos do seu app autenticador</p>
              </div>
              <input inputMode="numeric" autoFocus maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="w-full text-center tracking-[0.6em] font-mono text-2xl rounded-xl bg-background/60 border border-border px-3 py-4 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40" placeholder="000000" />
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <SubmitBtn loading={loading} disabled={code.length < 6}>Verificar</SubmitBtn>
              <button type="button" onClick={() => go('credentials')} className="w-full text-xs text-muted-foreground hover:text-foreground">← Voltar</button>
            </form>
          )}

          {/* REGISTER */}
          {phase === 'register' && (
            <form onSubmit={submitRegister} className="space-y-4">
              <Field icon={User} label="Nome completo"><input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="login-input" placeholder="Seu nome" /></Field>
              <Field icon={Mail} label="E-mail"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="login-input" placeholder="voce@exemplo.com" /></Field>
              <Field icon={Lock} label="Senha"><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="login-input" placeholder="mín. 6 caracteres" /></Field>
              <Field icon={Lock} label="Confirmar senha"><input type="password" required value={password2} onChange={(e) => setPassword2(e.target.value)} className="login-input" placeholder="repita a senha" /></Field>
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <SubmitBtn loading={loading}>Criar conta <ArrowRight className="w-4 h-4" /></SubmitBtn>
              <button type="button" onClick={() => go('credentials')} className="w-full text-xs text-muted-foreground hover:text-foreground">← Já tenho conta</button>
            </form>
          )}

          {/* FORGOT */}
          {phase === 'forgot' && (
            <form onSubmit={submitForgot} className="space-y-4">
              <Field icon={Mail} label="E-mail da conta"><input type="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} className="login-input" placeholder="voce@exemplo.com" /></Field>
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <SubmitBtn loading={loading}>Enviar link <ArrowRight className="w-4 h-4" /></SubmitBtn>
              <button type="button" onClick={() => go('credentials')} className="w-full text-xs text-muted-foreground hover:text-foreground">← Voltar</button>
            </form>
          )}

          {/* RESET */}
          {phase === 'reset' && (
            <form onSubmit={submitReset} className="space-y-4">
              <Field icon={Lock} label="Nova senha"><input type="password" autoFocus required value={password} onChange={(e) => setPassword(e.target.value)} className="login-input" placeholder="mín. 6 caracteres" /></Field>
              <Field icon={Lock} label="Confirmar senha"><input type="password" required value={password2} onChange={(e) => setPassword2(e.target.value)} className="login-input" placeholder="repita a senha" /></Field>
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <SubmitBtn loading={loading}>Redefinir senha</SubmitBtn>
            </form>
          )}

          {/* VERIFY (loading) */}
          {phase === 'verify' && (
            <div className="flex flex-col items-center text-center gap-3 py-6">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Confirmando seu e-mail…</p>
            </div>
          )}

          {/* INFO (success / mail sent / error) */}
          {phase === 'info' && info && (
            <div className="flex flex-col items-center text-center gap-3 py-2">
              {info.icon === 'check' && <CheckCircle2 className="w-12 h-12 text-accent" />}
              {info.icon === 'mail' && <MailCheck className="w-12 h-12 text-primary" />}
              {info.icon === 'error' && <div className="w-12 h-12 rounded-full bg-destructive/15 flex items-center justify-center text-destructive text-2xl">!</div>}
              <h2 className="text-lg font-display font-bold text-foreground">{info.title}</h2>
              <p className="text-sm text-muted-foreground">{info.text}</p>
              <button onClick={() => go('credentials')} className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold py-3 text-sm hover:opacity-90 glow-primary">Ir para o login</button>
            </div>
          )}
        </div>

        <p className="text-center text-[10px] text-muted-foreground/50 mt-6 font-mono tracking-wider">NEURIX © {new Date().getFullYear()} · Machine Learning sem LLM externo</p>
      </div>

      <style>{`
        .login-input { width:100%; border-radius:.6rem; background:hsla(220,40%,8%,.6); border:1px solid hsl(var(--border)); padding:.65rem .75rem; font-size:.875rem; color:hsl(var(--foreground)); transition:border-color .15s, box-shadow .15s; }
        .login-input:focus { outline:none; border-color:hsl(var(--primary)); box-shadow:0 0 0 2px hsla(185,100%,50%,.25); }
        .login-input::placeholder { color:hsl(var(--muted-foreground)); }
      `}</style>
    </div>
  );
}

function Field({ icon: Icon, label, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5"><Icon className="w-3 h-3" /> {label}</label>
      {children}
    </div>
  );
}
function ErrorMsg({ children }) {
  return <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">{children}</p>;
}
function SubmitBtn({ loading, disabled, children }) {
  return (
    <button type="submit" disabled={loading || disabled} className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold py-3 text-sm hover:opacity-90 transition disabled:opacity-40 glow-primary">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : children}
    </button>
  );
}
