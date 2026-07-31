import React from 'react';
import { ModaraLogoMark } from '@/components/layout/ModaraLogo';

const UPDATED = '31 de julho de 2026';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background bg-grid-pattern">
      <div className="max-w-3xl mx-auto px-5 py-12">
        <a href="/" className="inline-flex items-center gap-2 mb-8">
          <ModaraLogoMark size={34} />
          <span className="font-display font-extrabold tracking-[0.22em] text-gradient-primary">NEURIX</span>
        </a>

        <h1 className="text-3xl font-display font-bold text-foreground mb-1">Política de Privacidade</h1>
        <p className="text-xs text-muted-foreground mb-8">Última atualização: {UPDATED}</p>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <Section title="Resumo">
            O Neurix é uma ferramenta de Machine Learning que roda majoritariamente no seu navegador.
            <strong className="text-foreground"> Seus conjuntos de dados (datasets) permanecem no seu dispositivo</strong> e
            não são enviados para nossos servidores. Não usamos IA generativa externa, não exibimos anúncios e não
            vendemos dados. Não há rastreadores de terceiros.
          </Section>

          <Section title="1. Dados que coletamos">
            <ul className="list-disc ml-5 space-y-1.5">
              <li><strong className="text-foreground">Conta:</strong> e-mail, nome e (opcionalmente) uma foto de perfil, para autenticação.</li>
              <li><strong className="text-foreground">Resultados de análise:</strong> métricas, configurações de modelos, relatórios e o modelo treinado (parâmetros) — armazenados no banco de dados da aplicação para você reabrir depois.</li>
              <li><strong className="text-foreground">Dados técnicos mínimos:</strong> um token de sessão para manter você conectado.</li>
            </ul>
          </Section>

          <Section title="2. Onde ficam os seus datasets">
            Os arquivos que você sobe (CSV/Excel) e as linhas do dataset são guardados <strong className="text-foreground">localmente no seu navegador</strong> (IndexedDB).
            Eles não são transmitidos para a nuvem. Ao trocar de dispositivo ou limpar os dados do navegador, você precisará reenviar o arquivo.
            O treino, a avaliação e as predições acontecem no seu próprio dispositivo.
          </Section>

          <Section title="3. Como usamos os dados">
            Usamos os dados da conta apenas para autenticar você e para salvar/exibir seus projetos, análises e modelos.
            O e-mail pode ser usado para confirmação de cadastro, redefinição de senha e alertas do aplicativo, quando o
            envio de e-mail estiver configurado pelo administrador da instância.
          </Section>

          <Section title="4. Compartilhamento">
            Não vendemos nem compartilhamos seus dados com terceiros para fins de marketing. Não há provedores de IA
            externos processando seus dados. A hospedagem e o banco de dados são operados pelo responsável pela instância do aplicativo.
          </Section>

          <Section title="5. Segurança">
            As senhas são armazenadas com hash (bcrypt). Oferecemos autenticação em duas etapas (2FA) via aplicativo autenticador.
            A comunicação é feita por HTTPS.
          </Section>

          <Section title="6. Retenção e exclusão">
            Você pode excluir um projeto a qualquer momento; ao fazê-lo, removemos as análises e modelos associados, além do
            dataset local correspondente. Para excluir sua conta e os dados relacionados, entre em contato com o administrador da instância.
          </Section>

          <Section title="7. Crianças">
            O Neurix não é direcionado a menores de 13 anos e não coleta intencionalmente dados dessa faixa etária.
          </Section>

          <Section title="8. Alterações">
            Podemos atualizar esta política. A data de "última atualização" no topo indica a versão vigente.
          </Section>

          <Section title="9. Contato">
            Dúvidas sobre privacidade? Entre em contato pelo e-mail do administrador da instância onde você usa o Neurix.
          </Section>
        </div>

        <div className="mt-10 pt-6 border-t border-border/50 text-xs text-muted-foreground">
          <a href="/" className="text-primary hover:underline">← Voltar ao aplicativo</a>
          <span className="mx-2">·</span>
          NEURIX © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-foreground mb-1.5">{title}</h2>
      <div>{children}</div>
    </section>
  );
}
