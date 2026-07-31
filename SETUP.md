# Neurix — Setup & Comandos

Migração concluída: **Base44 → Turso (banco) + Vercel (front + API serverless)**, com login, 2FA por app autenticador, tela de Configurações e Controle de Usuários.

## Arquitetura

- **Front:** Vite + React (o mesmo de antes, sem o SDK Base44).
- **API:** funções serverless em `/api` (rodam na Vercel; em dev, o `server.mjs` roda as MESMAS funções).
- **Banco:** Turso (libSQL). Tabelas: `users`, `files` (CSVs), `records` (todas as entidades em JSON).
- **Auth:** JWT + senha (bcrypt) + 2FA TOTP (Google Authenticator/Authy/Microsoft).
- O SDK antigo foi trocado por um *client* de mesma forma em `src/api/base44Client.js`, então as ~40 páginas continuam funcionando sem alteração.

---

## 1. Instalar dependências

```bash
cd C:\dev\Neurix
npm install
```

## 2. Criar as tabelas no Turso + usuário admin

As credenciais já estão no arquivo `.env`. Rode:

```bash
npm run db:migrate
```

Isso cria as tabelas e o admin:

- **E-mail:** `viniciussouza742@gmail.com`
- **Senha:** `12345678`

## 3. Rodar localmente (front + API juntos)

```bash
npm run dev
```

- Front: http://localhost:5173
- API (dev): http://localhost:3001 (o front já faz proxy de `/api` pra cá)

Faça login com o admin acima. Depois vá em **Configurações → Segurança** para ativar o **2FA** (escaneie o QR no seu app autenticador). No próximo login ele pedirá o código de 6 dígitos.

---

## Uso das telas novas

- **Configurações** (`/settings`): foto de perfil, nome, trocar senha, ativar/desativar 2FA, e status da conexão Turso.
- **Controle de Usuários** (`/users`, só admin): criar usuários, definir função (admin/user), ativar/desativar, resetar senha e marcar **quais páginas/recursos cada usuário acessa**. O menu lateral se ajusta automaticamente às permissões.

## Upload de CSV

Ao criar um projeto e subir um CSV, o arquivo é guardado na tabela `files` do Turso e os dados são analisados localmente (ML 100% local, sem IA externa).

> ⚠️ Na Vercel (plano Hobby) o limite de corpo de requisição é ~4.5 MB por upload. Para CSVs maiores, migre depois o storage para **Vercel Blob** (posso configurar quando quiser).

---

## 4. Subir no GitHub

O `.gitignore` já protege o `.env` (suas credenciais NÃO vão pro Git).

```bash
cd C:\dev\Neurix
git init
git add .
git commit -m "Neurix: migração Base44 -> Turso + Vercel, com login/2FA e RBAC"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/neurix.git
git push -u origin main
```

## 5. Deploy na Vercel

```bash
npm i -g vercel      # se ainda não tiver
vercel login
vercel               # primeira vez: linka o projeto
vercel --prod        # deploy de produção
```

**Importante:** no painel da Vercel (Project → Settings → Environment Variables), cadastre as MESMAS variáveis do `.env`:

| Variável | Valor |
|---|---|
| `TURSO_DATABASE_URL` | `libsql://neurix-viniciuskanh.aws-us-east-1.turso.io` |
| `TURSO_AUTH_TOKEN` | (o token do `.env`) |
| `JWT_SECRET` | (o segredo do `.env`) |
| `TOTP_ISSUER` | `Neurix` |
| `VITE_PUBLIC_TURSO_URL` | `libsql://neurix-viniciuskanh.aws-us-east-1.turso.io` |

Depois de cadastrar, rode `vercel --prod` de novo (ou faça um redeploy) para aplicar.

---

## Comandos de referência

```bash
npm run dev        # front + API em dev
npm run dev:web    # só o front (Vite)
npm run dev:api    # só a API local (server.mjs)
npm run db:migrate # cria tabelas + admin no Turso
npm run build      # build de produção do front
npm run preview    # pré-visualiza o build
npm run lint       # ESLint
```
