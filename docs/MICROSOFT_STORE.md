# 🪟 Publicar o Neurix na Microsoft Store

O Neurix é um **PWA** (Progressive Web App). A forma suportada de publicar um site/PWA na
Microsoft Store é gerar um pacote **MSIX** com o **PWABuilder** e enviá-lo pelo **Partner Center**.

---

## ✅ Pré-requisitos

1. O app publicado e acessível por **HTTPS** (ex.: sua URL da Vercel, `https://SEU-APP.vercel.app`).
2. O `manifest.webmanifest`, os ícones e o `service worker` — **já incluídos** neste projeto (pasta `public/`).
3. Uma conta de desenvolvedor no **Microsoft Partner Center** (taxa única ~US$ 19 para conta individual).
4. A **URL da Política de Privacidade**: `https://SEU-APP.vercel.app/privacy` (página já pronta no app).

---

## 🧩 Passo a passo

### 1. Faça deploy da versão com PWA
```bash
git add .
git commit -m "PWA: manifest, icones e service worker para a Microsoft Store"
git push
```
Aguarde a Vercel publicar e confirme que abrindo `https://SEU-APP.vercel.app/manifest.webmanifest` o arquivo aparece.

### 2. Reserve o nome do app no Partner Center
- Entre em **partner.microsoft.com/dashboard** → **Apps and Games** → **New product** → **MSIX or PWA app**.
- Em **Product name**, reserve o nome **Neurix** (ou "Neurix — ML Workbench" se "Neurix" estiver ocupado).

### 3. Gere o pacote no PWABuilder
- Acesse **https://www.pwabuilder.com** e cole a URL do app (`https://SEU-APP.vercel.app`).
- Clique em **Start** — ele analisa o manifest e o service worker (deve dar nota alta).
- Clique em **Package for stores → Windows**.
- Em **Publisher**, preencha com os dados que o Partner Center te dá (veja passo 4): **Publisher ID**, **Publisher display name** e **Package ID** (Store reserved name).
- Baixe o `.zip` — ele contém o **`.msixbundle`** (para enviar) e um **`.msix`** de teste.

### 4. Onde achar os dados do publisher
No Partner Center, na página do produto → **Product management → Product identity**. Copie:
- **Package/Identity/Name** (Package ID)
- **Package/Identity/Publisher** (Publisher ID)
- **Publisher display name**
Cole exatamente esses valores no PWABuilder antes de gerar o pacote.

### 5. Envie o pacote
- No Partner Center, no produto: **Packages** → arraste o **`.msixbundle`**.
- **Store listings** (pt-BR e/ou en-US): use os textos da seção abaixo.
- **Properties**: categoria **Developer tools** (ou **Education**); adicione a **Privacy policy URL**.
- **Age ratings**: responda o questionário (o app não tem conteúdo adulto).
- **Submit** para revisão. A aprovação costuma levar de algumas horas a poucos dias.

> Dica: teste o `.msix` localmente antes (duplo clique instala no Windows) para garantir que abre certinho.

---

## 📝 Textos prontos para a listagem

### Nome
`Neurix — ML Workbench`

### Descrição curta (≤ 100 caracteres)
`Explore dados, treine modelos de Machine Learning e coloque em produção — sem código.`

### Descrição longa
```
O Neurix é uma workbench de Machine Learning que roda no seu navegador — inspirada em ferramentas
como o WEKA, porém moderna, visual e guiada.

Suba um arquivo CSV ou Excel e, sem escrever uma linha de código, você pode:

• Explorar os dados: distribuições, correlações, outliers, qualidade e balanceamento de classes.
• Treinar modelos de verdade: Regressão Logística, Árvore de Decisão, Random Forest, Gradient
  Boosting, SVM, KNN, Naive Bayes (classificação); Linear, Ridge, Lasso, Árvore, Random Forest,
  Gradient Boosting (regressão); e K-Means para agrupamento — treinados sobre todo o dataset,
  com split treino/teste e métricas reais (acurácia, F1, R², RMSE, matriz de confusão).
• Minerar regras de associação, com laudo de aptidão da base.
• Colocar em produção: inferência ao vivo, testes A/B, Champion × Challenger e monitoramento de drift.
• Gerar relatórios técnicos e exportar em PDF.
• Visualizar seus dados em 3D (PCA + clustering).

Privacidade em primeiro lugar: seus datasets ficam no seu dispositivo (não vão para a nuvem) e o
Neurix não usa nenhuma IA generativa externa. Ideal para estudantes, analistas e entusiastas de
ciência de dados.

Recursos: login com autenticação em duas etapas (2FA), múltiplos usuários com controle de acesso,
temas personalizáveis e interface responsiva.
```

### Novidades desta versão (What's new)
```
🚀 Versão 1.0
• Treino real de modelos sobre o dataset completo, com métricas de verdade (holdout).
• Novos algoritmos: Random Forest, Gradient Boosting, SVM, Ridge e Lasso.
• Dataset local (estilo WEKA): seus dados ficam no seu dispositivo, sem limites de nuvem.
• Deploy com predição real, Testes A/B e Champion × Challenger usando seus modelos treinados.
• Monitoramento de drift, relatórios técnicos e exportação em PDF.
• Onboarding interativo, temas personalizáveis e login com 2FA.
```

### Palavras-chave / termos de busca
`machine learning, ciência de dados, data science, WEKA, classificação, regressão, clustering, AutoML, análise de dados, MLOps, no-code`

### Categoria
`Ferramentas de desenvolvimento` (Developer tools) — alternativa: `Educação`

### Idiomas
`Português (Brasil)`, `Inglês`

### URL da Política de Privacidade
`https://SEU-APP.vercel.app/privacy`

---

## 🔎 Observações
- Como é um PWA empacotado, atualizações do site (novos deploys) refletem no app automaticamente
  para o conteúdo; apenas mudanças no manifesto/identidade exigem reenviar o pacote.
- Se preferir não usar a Store, o próprio navegador (Edge/Chrome) permite **"Instalar app"** —
  o Neurix já é instalável como PWA.
