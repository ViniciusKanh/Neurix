// Neurix email templates — inline styles for maximum email-client compatibility.

const BRAND = { primary: '#00F0FF', accent: '#00E57A', bg: '#070B12', card: '#0C1119', text: '#C8E6F0', muted: '#7A8499' };

function button(label, href) {
  return `<a href="${href}" style="display:inline-block;background:linear-gradient(90deg,#00F0FF,#00E57A);color:#05141a;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;margin:8px 0;">${label}</a>`;
}

function shell({ title, intro, cta, ctaHref, after, footnoteText }) {
  const body = `
    <p style="color:${BRAND.text};font-size:14px;line-height:1.7;margin:0 0 16px;">${intro}</p>
    ${cta ? button(cta, ctaHref) : ''}
    ${after ? `<p style="color:${BRAND.muted};font-size:12px;line-height:1.6;margin:16px 0 0;">${after}</p>` : ''}
  `;
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:${BRAND.bg};font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:${BRAND.card};border:1px solid #1A2333;border-radius:16px;overflow:hidden;">
        <tr><td style="background:linear-gradient(90deg,${BRAND.primary},${BRAND.accent});height:6px;"></td></tr>
        <tr><td style="padding:28px 32px 8px;">
          <div style="font-size:22px;font-weight:800;letter-spacing:4px;color:${BRAND.primary};">NEURIX</div>
          <div style="font-size:10px;letter-spacing:3px;color:${BRAND.muted};text-transform:uppercase;margin-top:2px;">ML Workbench</div>
        </td></tr>
        <tr><td style="padding:8px 32px 24px;">
          <h1 style="font-size:20px;margin:12px 0 12px;color:#ffffff;">${title}</h1>
          ${body}
        </td></tr>
        <tr><td style="padding:0 32px 28px;">
          <div style="border-top:1px solid #1A2333;padding-top:16px;color:${BRAND.muted};font-size:11px;line-height:1.6;">${footnoteText || 'Se você não solicitou este e-mail, pode ignorá-lo com segurança.'}</div>
        </td></tr>
      </table>
      <div style="color:${BRAND.muted};font-size:11px;margin-top:16px;">Neurix • Machine Learning 100% local</div>
    </td></tr>
  </table>
</body></html>`;
}

export function verifyEmailTemplate({ name, link }) {
  return {
    subject: 'Confirme seu e-mail — Neurix',
    html: shell({
      title: `Bem-vindo(a) ao Neurix, ${name || 'usuário'}! 🧠`,
      intro: 'Falta só um passo para ativar sua conta. Clique no botão abaixo para confirmar seu e-mail:',
      cta: 'Confirmar e-mail',
      ctaHref: link,
      after: `Se o botão não funcionar, copie e cole este link no navegador:<br/><span style="color:#00F0FF;word-break:break-all;">${link}</span><br/><br/>O link expira em 24 horas.`,
    }),
  };
}

export function resetPasswordTemplate({ name, link }) {
  return {
    subject: 'Redefinição de senha — Neurix',
    html: shell({
      title: 'Redefinir sua senha 🔐',
      intro: `Olá ${name || ''}, recebemos um pedido para redefinir a senha da sua conta Neurix. Clique abaixo para criar uma nova senha:`,
      cta: 'Criar nova senha',
      ctaHref: link,
      after: `Se o botão não funcionar, use este link:<br/><span style="color:#00F0FF;word-break:break-all;">${link}</span><br/><br/>O link expira em 1 hora. Se não foi você, ignore este e-mail — sua senha continua a mesma.`,
    }),
  };
}

export function welcomeTemplate({ name, appUrl }) {
  return {
    subject: 'Sua conta está ativa — Neurix',
    html: shell({
      title: `Conta ativada! 🎉`,
      intro: `Tudo certo, ${name || ''}! Sua conta no Neurix está ativa. Você já pode entrar e começar a explorar seus dados, treinar modelos e gerar relatórios.`,
      cta: 'Acessar o Neurix',
      ctaHref: appUrl,
      footnoteText: 'Bons modelos! — Equipe Neurix',
    }),
  };
}

export function reportAlertTemplate({ name, projectName, summary, link }) {
  return {
    subject: `Relatório do projeto ${projectName} — Neurix`,
    html: shell({
      title: `📊 Relatório: ${projectName}`,
      intro: `Olá ${name || ''}, aqui está o resumo do seu projeto:<br/><br/><span style="color:${BRAND.text}">${(summary || '').replace(/\n/g, '<br/>')}</span>`,
      cta: link ? 'Abrir no Neurix' : '',
      ctaHref: link || '#',
      footnoteText: 'Alerta automático de relatório — Neurix',
    }),
  };
}

export function testTemplate() {
  return {
    subject: 'Teste de e-mail — Neurix ✅',
    html: shell({
      title: 'Funcionou! ✅',
      intro: 'Este é um e-mail de teste do Neurix. Se você recebeu esta mensagem, sua configuração SMTP está correta e pronta para enviar verificações, resets e alertas.',
      footnoteText: 'Configuração validada — Neurix',
    }),
  };
}
