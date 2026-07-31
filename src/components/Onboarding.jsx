import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ModaraLogoMark } from '@/components/layout/ModaraLogo';
import { ArrowRight, ArrowLeft, X, Check } from 'lucide-react';

const KEY = 'neurix_onboarded_v1';

const STEPS = [
  { emoji: '🧠', title: 'Bem-vindo ao Neurix', text: 'Sua workbench de Machine Learning 100% local. Vamos dar um tour rápido (1 minuto) para você começar com o pé direito.', accent: false },
  { emoji: '📂', title: '1. Crie um projeto', text: 'Vá em "Projetos → Novo Projeto" e suba um arquivo CSV ou Excel. O dataset fica salvo no seu navegador — nada vai para a nuvem.', to: '/projects/new', cta: 'Criar projeto' },
  { emoji: '📊', title: '2. Explore os dados', text: 'No "Explorador de Dados" você vê distribuições, correlações, outliers, qualidade e o balanceamento das classes.', to: '/explorer', cta: 'Abrir explorador' },
  { emoji: '🤖', title: '3. Treine no ML Studio', text: 'Escolha classificação, regressão ou clustering. Vários modelos reais (Logística, Random Forest, SVM, Gradient Boosting…) treinam sobre todos os dados e você compara as métricas.', to: '/ml-studio', cta: 'Abrir ML Studio' },
  { emoji: '🚀', title: '4. Produção & MLOps', text: 'Faça inferência no Deploy, compare modelos no Champion×Challenger e Testes A/B, e detecte drift no Monitoramento.', to: '/deploy', cta: 'Ver Deploy' },
  { emoji: '🎨', title: 'Pronto! Personalize', text: 'Em Configurações você troca a cor do app, edita seu perfil e ativa o 2FA. Bons modelos! 🚀', to: '/settings', cta: 'Abrir Configurações' },
];

export function shouldShowOnboarding() {
  try { return !localStorage.getItem(KEY); } catch { return false; }
}
export function markOnboarded() {
  try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
}

export default function Onboarding({ onClose }) {
  const [i, setI] = useState(0);
  const navigate = useNavigate();
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const finish = (go) => { markOnboarded(); onClose(); if (go) navigate(go); };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md rounded-2xl glass-strong border border-primary/20 overflow-hidden shadow-2xl"
      >
        <div className="h-1 bg-gradient-to-r from-primary to-accent" />
        <button onClick={() => finish()} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground z-10"><X className="w-4 h-4" /></button>

        <div className="p-7">
          <div className="flex items-center gap-2 mb-5">
            <ModaraLogoMark size={26} />
            <span className="font-display font-bold tracking-[0.2em] text-sm text-gradient-primary">NEURIX</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-4xl mb-4">{step.emoji}</div>
              <h2 className="text-xl font-display font-bold text-foreground mb-2">{step.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed min-h-[64px]">{step.text}</p>
            </motion.div>
          </AnimatePresence>

          {/* dots */}
          <div className="flex items-center gap-1.5 my-5">
            {STEPS.map((_, idx) => (
              <button key={idx} onClick={() => setI(idx)} className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-6 bg-primary' : 'w-1.5 bg-border'}`} />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {i > 0 && (
              <button onClick={() => setI(i - 1)} className="flex items-center gap-1.5 rounded-xl border border-border py-2.5 px-4 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" /> Voltar
              </button>
            )}
            {step.to && (
              <button onClick={() => finish(step.to)} className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-primary/40 text-primary py-2.5 px-4 text-sm font-semibold hover:bg-primary/10">
                {step.cta} <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {!last ? (
              <button onClick={() => setI(i + 1)} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold py-2.5 px-4 text-sm hover:opacity-90 glow-primary">
                Próximo <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={() => finish()} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold py-2.5 px-4 text-sm hover:opacity-90 glow-primary">
                Começar <Check className="w-4 h-4" />
              </button>
            )}
          </div>

          <button onClick={() => finish()} className="w-full text-center text-[11px] text-muted-foreground/60 hover:text-muted-foreground mt-3">Pular tour</button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
