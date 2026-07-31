import React from 'react';

// Catches render errors anywhere in the tree and shows a friendly screen
// instead of a blank page.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Erro capturado pelo ErrorBoundary:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background bg-grid-pattern px-4">
        <div className="glass-strong rounded-2xl border border-destructive/30 p-8 max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-destructive/15 text-destructive text-2xl flex items-center justify-center mx-auto mb-4">!</div>
          <h1 className="text-lg font-display font-bold text-foreground">Ops, algo deu errado</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Ocorreu um erro inesperado nesta tela. Você pode recarregar e tentar de novo — seus dados estão salvos.
          </p>
          {this.state.error?.message && (
            <p className="text-[11px] font-mono text-muted-foreground/70 mt-3 break-words bg-background/60 border border-border rounded-lg px-3 py-2">
              {this.state.error.message}
            </p>
          )}
          <div className="flex gap-2 justify-center mt-5">
            <button onClick={() => window.location.reload()} className="rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold py-2.5 px-5 text-sm hover:opacity-90 glow-primary">
              Recarregar
            </button>
            <button onClick={() => { window.location.href = '/'; }} className="rounded-xl border border-border py-2.5 px-5 text-sm text-foreground hover:border-primary/50">
              Ir para o Painel
            </button>
          </div>
        </div>
      </div>
    );
  }
}
