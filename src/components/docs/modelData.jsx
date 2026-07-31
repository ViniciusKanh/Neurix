export const MODEL_LIBRARY = [
  // ─── CLASSIFICAÇÃO LINEAR ───────────────────────────────────────────────
  {
    id: 'logistic_regression', name: 'Regressão Logística', category: 'Classificação', family: 'Linear',
    description: 'Modelo linear probabilístico que estima P(y=1|x) via função sigmóide. Baseline mais utilizado em classificação binária e multiclasse (One-vs-Rest ou Softmax).',
    theory: 'P(y=1|x) = σ(wᵀx + b) onde σ(z) = 1/(1+e⁻ᶻ). A função de custo é a cross-entropy (log-loss): L = -Σ[yᵢlog(ŷᵢ)+(1-yᵢ)log(1-ŷᵢ)]. Regularização L1 induz esparsidade; L2 encolhe coeficientes. Solvers: LBFGS (default), SAG/SAGA (grandes datasets), liblinear (L1/binário).',
    pros: ['Altamente interpretável — coeficientes = log-odds', 'Probabilidades bem calibradas nativamente', 'Regularização L1/L2/ElasticNet integrada', 'Muito rápido para treinar e inferir', 'Sem hiperparâmetros críticos além de C', 'Suporta multiclasse nativo (OvR/Multinomial)'],
    cons: ['Apenas fronteira de decisão linear', 'Não captura interações sem feature engineering', 'Sensível a outliers extremos', 'Feature scaling obrigatório', 'Coeficientes sob alta multicolinearidade são instáveis'],
    use_cases: ['Previsão de churn', 'Detecção de spam', 'Scoring de crédito', 'Diagnóstico médico binário', 'Propensity model em marketing'],
    params: [
      { name: 'C', desc: 'Inverso da regularização. C pequeno = mais regularização. Default=1.0' },
      { name: 'penalty', desc: 'l1 (esparsidade), l2 (shrinkage), elasticnet, none' },
      { name: 'solver', desc: 'lbfgs (default), saga (l1+grandes), liblinear (l1/binário)' },
      { name: 'max_iter', desc: 'Máximo de iterações. Aumentar se não convergir. Default=100' },
      { name: 'class_weight', desc: 'balanced para dados desbalanceados' },
      { name: 'multi_class', desc: 'ovr ou multinomial (softmax)' },
    ],
    complexity: 'Treino O(n·p·iter) | Inferência O(p) | Memória O(p)',
    when_to_use: 'Baseline rápido, interpretabilidade crítica, probabilidades calibradas necessárias, dados linearmente separáveis.',
    avoid_when: 'Relações não-lineares, muitas interações entre features não engineerizadas, dados com alta multicolinearidade (use Ridge/Lasso).',
    metrics: { Classificação: ['Accuracy', 'AUC-ROC', 'AUC-PR', 'F1-Score', 'Log-Loss', 'Precision', 'Recall', 'MCC'] },
    implementation: `from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

pipe = Pipeline([
    ('scaler', StandardScaler()),
    ('clf', LogisticRegression(
        C=1.0,
        penalty='l2',
        solver='lbfgs',
        max_iter=1000,
        class_weight='balanced',  # se desbalanceado
        random_state=42
    ))
])
pipe.fit(X_train, y_train)
proba = pipe.predict_proba(X_test)[:, 1]  # probabilidade classe 1`,
    tuning: `from sklearn.model_selection import GridSearchCV
param_grid = {'clf__C': [0.001, 0.01, 0.1, 1, 10, 100], 'clf__penalty': ['l1','l2']}
gs = GridSearchCV(pipe, param_grid, cv=5, scoring='roc_auc')
gs.fit(X_train, y_train)`,
    related: ['Ridge Classifier', 'SVM Linear', 'ElasticNet'],
    references: ['Hastie et al., The Elements of Statistical Learning (2009)', 'Scikit-learn: LogisticRegression docs'],
  },

  {
    id: 'ridge_classifier', name: 'Ridge Classifier', category: 'Classificação', family: 'Linear',
    description: 'Reformula classificação como regressão com regularização L2 e usa o sinal da predição como classe. Extremamente rápido via solução analítica.',
    theory: 'Resolve (XᵀX + αI)β = Xᵀy onde y é a classe codificada. A matriz (XᵀX + αI) é sempre inversível, resolvendo multicolinearidade. Equivalente ao LDA em certos casos.',
    pros: ['Solução analítica — sem iterações', 'Estável com multicolinearidade', 'Muito rápido em dados esparsos', 'Funciona bem com alta dimensionalidade'],
    cons: ['Não produz probabilidades calibradas nativamente', 'Menos expressivo que Logistic para multiclasse', 'Não produz coeficientes interpretáveis como log-odds'],
    use_cases: ['Classificação de texto (TF-IDF esparso)', 'Dados genômicos (p >> n)', 'Baseline ultra-rápido'],
    params: [
      { name: 'alpha', desc: 'Força da regularização L2. Default=1.0' },
      { name: 'fit_intercept', desc: 'Se deve estimar o intercepto. Default=True' },
      { name: 'solver', desc: 'auto, svd, cholesky, lsqr, sparse_cg, sag, saga' },
    ],
    complexity: 'Treino O(n·p²) ou O(p³) | Inferência O(p)',
    when_to_use: 'Dados esparsos de alta dimensão (NLP), quando velocidade é crítica e probabilidades não são necessárias.',
    avoid_when: 'Quando precisa de probabilidades bem calibradas — use Logistic Regression.',
    metrics: { Classificação: ['Accuracy', 'F1-Score', 'Precision', 'Recall'] },
    implementation: `from sklearn.linear_model import RidgeClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

model = Pipeline([
    ('scaler', StandardScaler()),
    ('clf', RidgeClassifier(alpha=1.0))
])`,
    tuning: `from sklearn.linear_model import RidgeClassifierCV
# Seleciona alpha automaticamente via LOO-CV
model = RidgeClassifierCV(alphas=[0.1, 1.0, 10.0, 100.0])`,
    related: ['Logistic Regression', 'Linear SVC', 'Perceptron'],
    references: ['Scikit-learn: RidgeClassifier docs'],
  },

  // ─── ENSEMBLE BAGGING ──────────────────────────────────────────────────
  {
    id: 'random_forest', name: 'Random Forest', category: 'Classificação / Regressão', family: 'Ensemble — Bagging',
    description: 'Ensemble de árvores de decisão treinadas com Bootstrap Aggregating (Bagging) e seleção aleatória de features em cada split para reduzir correlação entre árvores.',
    theory: 'Cada árvore é treinada em subconjunto bootstrap D_b ⊂ D. Em cada nó, apenas m = √p (classificação) ou p/3 (regressão) features são candidatas ao split. Predição = média (regressão) ou voto majoritário (classificação). O erro OOB é estimado com ~37% das amostras excluídas por bootstrap.',
    pros: ['Robusto a outliers e ruído', 'Feature importance via MDI e permutation', 'OOB error gratuito (equivale a CV)', 'Sem necessidade de feature scaling', 'Paralelizável (n_jobs=-1)', 'Estima variância da predição'],
    cons: ['Alto uso de memória para muitas árvores', 'Inferência lenta com 1000+ árvores', 'Não extrapola além do range de treino', 'Viés para features com mais categorias (MDI)', 'Menos interpretável que árvore simples'],
    use_cases: ['Diagnóstico médico', 'Detecção de fraude', 'Previsão de preços', 'Feature selection', 'Dados mistos (numérico + categórico)'],
    params: [
      { name: 'n_estimators', desc: 'Número de árvores. Mais árvores = mais estável. 100-500 típico.' },
      { name: 'max_depth', desc: 'Profundidade máxima. None = expansão total. Limitar evita overfitting.' },
      { name: 'max_features', desc: 'Features por split: sqrt (class), log2, float ou None (todas).' },
      { name: 'min_samples_split', desc: 'Mínimo de amostras para dividir nó. Default=2.' },
      { name: 'min_samples_leaf', desc: 'Mínimo de amostras em folha. Maior = mais smooth.' },
      { name: 'oob_score', desc: 'True para calcular OOB error gratuitamente.' },
      { name: 'class_weight', desc: 'balanced para classes desbalanceadas.' },
      { name: 'criterion', desc: 'gini, entropy (classif) | mse, mae (regress).' },
    ],
    complexity: 'Treino O(n·p·k·log n) | Inferência O(k·log n) | Memória O(k·n·p/3)',
    when_to_use: 'Solução robusta geral, feature importance necessária, sem tempo para tuning extensivo, dados mistos.',
    avoid_when: 'Dados esparsos (texto), quando memória é limitada, velocidade de inferência crítica em produção.',
    metrics: { Classificação: ['Accuracy', 'AUC-ROC', 'F1', 'OOB Score'], Regressão: ['RMSE', 'MAE', 'R²', 'OOB R²'] },
    implementation: `from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance

model = RandomForestClassifier(
    n_estimators=300,
    max_depth=None,
    max_features='sqrt',
    min_samples_leaf=2,
    oob_score=True,
    class_weight='balanced',
    n_jobs=-1,
    random_state=42
)
model.fit(X_train, y_train)
print(f"OOB Score: {model.oob_score_:.4f}")

# Feature importance
importances = model.feature_importances_
# Permutation importance (mais robusto)
perm_imp = permutation_importance(model, X_val, y_val, n_repeats=10)`,
    tuning: `from sklearn.model_selection import RandomizedSearchCV
param_dist = {
    'n_estimators': [100, 200, 300, 500],
    'max_depth': [None, 5, 10, 20],
    'max_features': ['sqrt', 'log2', 0.3],
    'min_samples_leaf': [1, 2, 5],
    'class_weight': ['balanced', None]
}
rs = RandomizedSearchCV(model, param_dist, n_iter=30, cv=5, scoring='roc_auc', n_jobs=-1)`,
    related: ['Extra Trees', 'XGBoost', 'LightGBM', 'Bagging Classifier'],
    references: ['Breiman, "Random Forests" (2001)', 'Hastie et al., ESL Cap. 15'],
  },

  {
    id: 'extra_trees', name: 'Extra Trees', category: 'Classificação / Regressão', family: 'Ensemble — Bagging',
    description: 'Variante do Random Forest que usa splits completamente aleatórios (feature E threshold). Mais rápido que RF pois elimina a busca pelo melhor threshold.',
    theory: 'Como RF, mas em cada nó: sorteia k features aleatórias E para cada feature sorteia threshold aleatório dentro do range. Escolhe o melhor entre esses splits aleatórios. Elimina completamente a otimização de threshold, reduzindo variância mas aumentando bias levemente.',
    pros: ['Mais rápido que Random Forest para treinar', 'Menor variância em alguns datasets', 'Mesmas vantagens de paralelismo', 'Às vezes supera RF por aleatoriedade extra'],
    cons: ['Bias ligeiramente maior que RF', 'Não tem OOB nativo (sem bootstrap)', 'Mesmas limitações de extrapolação que RF'],
    use_cases: ['Quando RF é lento demais', 'Dados com muito ruído', 'Feature selection rápida'],
    params: [
      { name: 'n_estimators', desc: 'Número de árvores. Típico 100-500.' },
      { name: 'max_features', desc: 'Features candidatas por split. Default=sqrt.' },
      { name: 'bootstrap', desc: 'False por padrão (usa todo o dataset).' },
    ],
    complexity: 'Treino O(n·p·k) — mais rápido que RF | Inferência O(k·log n)',
    when_to_use: 'Alternativa mais rápida ao RF, quando treino é gargalo.',
    avoid_when: 'Quando OOB error é necessário sem CV separado.',
    metrics: { Classificação: ['Accuracy', 'AUC-ROC', 'F1'], Regressão: ['RMSE', 'MAE', 'R²'] },
    implementation: `from sklearn.ensemble import ExtraTreesClassifier
model = ExtraTreesClassifier(n_estimators=300, max_features='sqrt', n_jobs=-1, random_state=42)`,
    tuning: `param_dist = {'n_estimators': [100,300,500], 'max_features': ['sqrt',0.3,0.5], 'min_samples_leaf': [1,2,5]}`,
    related: ['Random Forest', 'XGBoost'],
    references: ['Geurts et al., "Extremely randomized trees" (2006)'],
  },

  // ─── ENSEMBLE BOOSTING ─────────────────────────────────────────────────
  {
    id: 'xgboost', name: 'XGBoost', category: 'Classificação / Regressão', family: 'Ensemble — Boosting',
    description: 'Gradient Boosting otimizado com regularização L1/L2, tratamento nativo de NaN, tree pruning via max_delta_step e suporte a GPU. Estado da arte em dados tabulares.',
    theory: 'Objetivo: L(φ) = Σloss(yᵢ, ŷᵢ) + Ω(f) onde Ω(f) = γT + ½λ||w||² penaliza número de folhas T e pesos w. Usa aproximação de segunda ordem (Newton) para minimização: Gain = ½[G_L²/H_L+λ + G_R²/H_R+λ - (G_L+G_R)²/H_L+H_R+λ] - γ. Column subsampling e row subsampling adicionam regularização estocástica.',
    pros: ['Máxima acurácia em dados tabulares', 'Regularização integrada (L1+L2+γ)', 'NaN nativo: aprende a direção do split para NaN', 'SHAP values nativo para interpretabilidade', 'GPU suporte (device=cuda)', 'Early stopping com conjunto de validação'],
    cons: ['Muitos hiperparâmetros para otimizar', 'Sequencial por natureza (mais lento que LightGBM)', 'Sensível a outliers extremos sem clipping', 'Pode overfittar sem regularização adequada'],
    use_cases: ['Competições Kaggle (padrão ouro)', 'Scoring de crédito', 'CTR prediction', 'Detecção de fraude', 'Previsão de demanda'],
    params: [
      { name: 'n_estimators', desc: 'Número de árvores. Usar com early_stopping_rounds.' },
      { name: 'learning_rate (eta)', desc: '0.01-0.3. Menor = mais árvores necessárias, melhor generalização.' },
      { name: 'max_depth', desc: '3-8. Profundidade máxima por árvore.' },
      { name: 'subsample', desc: '0.6-1.0. Fração de linhas por árvore.' },
      { name: 'colsample_bytree', desc: '0.6-1.0. Fração de colunas por árvore.' },
      { name: 'reg_alpha', desc: 'Regularização L1 nos pesos (sparsidade).' },
      { name: 'reg_lambda', desc: 'Regularização L2 nos pesos. Default=1.' },
      { name: 'min_child_weight', desc: 'Peso mínimo de instâncias em folha.' },
      { name: 'gamma', desc: 'Ganho mínimo para fazer split. Default=0.' },
      { name: 'scale_pos_weight', desc: 'sum(neg)/sum(pos) para desbalanceamento.' },
    ],
    complexity: 'Treino O(n·p·k·log n) | Inferência O(k·depth) | Muito paralelo por coluna',
    when_to_use: 'Máxima performance em dados tabulares, tempo disponível para tuning, quando SHAP interpretability é necessária.',
    avoid_when: 'Datasets muito pequenos (<500 amostras), dados de texto sem feature engineering, quando LightGBM é mais rápido com mesma acurácia.',
    metrics: { Classificação: ['AUC-ROC', 'Accuracy', 'F1', 'Log-Loss', 'AUC-PR'], Regressão: ['RMSE', 'MAE', 'MAPE', 'R²'] },
    implementation: `import xgboost as xgb
from sklearn.model_selection import train_test_split

X_tr, X_val, y_tr, y_val = train_test_split(X_train, y_train, test_size=0.2)

model = xgb.XGBClassifier(
    n_estimators=1000,           # alto, com early stopping
    learning_rate=0.05,
    max_depth=6,
    subsample=0.8,
    colsample_bytree=0.8,
    reg_alpha=0.1,
    reg_lambda=1.0,
    scale_pos_weight=neg/pos,    # para desbalanceamento
    eval_metric='auc',
    early_stopping_rounds=50,
    device='cuda',               # GPU se disponível
    random_state=42
)
model.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], verbose=100)

# SHAP values
import shap
explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test)
shap.summary_plot(shap_values, X_test)`,
    tuning: `import optuna
def objective(trial):
    params = {
        'learning_rate': trial.suggest_float('lr', 0.01, 0.3, log=True),
        'max_depth': trial.suggest_int('max_depth', 3, 8),
        'subsample': trial.suggest_float('subsample', 0.5, 1.0),
        'colsample_bytree': trial.suggest_float('colsample', 0.5, 1.0),
        'reg_alpha': trial.suggest_float('alpha', 1e-3, 10, log=True),
    }
    model = xgb.XGBClassifier(**params, n_estimators=300, random_state=42)
    return cross_val_score(model, X_train, y_train, cv=5, scoring='roc_auc').mean()
study = optuna.create_study(direction='maximize')
study.optimize(objective, n_trials=100)`,
    related: ['LightGBM', 'CatBoost', 'Random Forest', 'Gradient Boosting'],
    references: ['Chen & Guestrin, "XGBoost: A Scalable Tree Boosting System" (KDD 2016)', 'XGBoost docs: xgboost.readthedocs.io'],
  },

  {
    id: 'lightgbm', name: 'LightGBM', category: 'Classificação / Regressão', family: 'Ensemble — Boosting',
    description: 'Gradient Boosting da Microsoft com GOSS (Gradient-based One-Side Sampling) e EFB (Exclusive Feature Bundling). 3-10x mais rápido que XGBoost em datasets grandes.',
    theory: 'GOSS: mantém instâncias com |gradiente| grande; amostra aleatoriamente instâncias com gradiente pequeno, multiplicando por fator (1-a)/b para compensar. EFB: agrupa features mutuamente exclusivas em um único feature, reduzindo dimensionalidade. Crescimento leaf-wise (profundidade variável) vs level-wise do XGBoost.',
    pros: ['3-10x mais rápido que XGBoost em grandes datasets', 'Menor uso de memória via histogramas', 'Features categóricas nativas sem OHE', 'Suporte GPU e treinamento distribuído', 'Alta acurácia competitiva com XGBoost'],
    cons: ['Leaf-wise pode overfittar em datasets pequenos (<1000 linhas)', 'num_leaves controla complexidade (não max_depth diretamente)', 'Mais instável que XGBoost em dados muito pequenos'],
    use_cases: ['Grandes datasets (>100k linhas)', 'Sistemas de recomendação em tempo real', 'Features categóricas de alta cardinalidade', 'Ranking e CTR prediction'],
    params: [
      { name: 'num_leaves', desc: 'Principal parâmetro de complexidade. Default=31. Relaciona-se com 2^max_depth.' },
      { name: 'learning_rate', desc: '0.01-0.1. Usar com early stopping.' },
      { name: 'n_estimators', desc: 'Alto (1000+) com early stopping.' },
      { name: 'max_depth', desc: '-1 (ilimitado). Controlar via num_leaves.' },
      { name: 'min_child_samples', desc: 'Mínimo de amostras em folha. Aumentar para regularizar.' },
      { name: 'feature_fraction', desc: 'Fração de features por árvore (colsample_bytree).' },
      { name: 'bagging_fraction + bagging_freq', desc: 'Row sampling estocástico.' },
      { name: 'lambda_l1, lambda_l2', desc: 'Regularização L1 e L2.' },
      { name: 'cat_smooth', desc: 'Suavização para features categóricas.' },
    ],
    complexity: 'Treino O(n·k·b) onde b = bins do histograma | 3-10x mais rápido que XGBoost',
    when_to_use: 'Datasets grandes onde XGBoost é lento, features categóricas de alta cardinalidade, quando velocidade é essencial.',
    avoid_when: 'Datasets muito pequenos — risco de overfitting leaf-wise. Use XGBoost com mais regularização.',
    metrics: { Classificação: ['AUC-ROC', 'Accuracy', 'F1', 'Log-Loss'], Regressão: ['RMSE', 'MAE', 'MAPE', 'R²'] },
    implementation: `import lightgbm as lgb

model = lgb.LGBMClassifier(
    num_leaves=127,
    learning_rate=0.05,
    n_estimators=1000,
    min_child_samples=20,
    feature_fraction=0.8,
    bagging_fraction=0.8,
    bagging_freq=5,
    lambda_l1=0.1,
    lambda_l2=0.1,
    is_unbalance=True,           # para desbalanceamento
    n_jobs=-1,
    random_state=42
)

callbacks = [lgb.early_stopping(50), lgb.log_evaluation(100)]
model.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], callbacks=callbacks)`,
    tuning: `# Optuna com LightGBM
def objective(trial):
    params = {
        'num_leaves': trial.suggest_int('num_leaves', 20, 300),
        'learning_rate': trial.suggest_float('lr', 0.01, 0.3, log=True),
        'min_child_samples': trial.suggest_int('min_child', 5, 100),
        'feature_fraction': trial.suggest_float('ff', 0.4, 1.0),
        'bagging_fraction': trial.suggest_float('bf', 0.4, 1.0),
        'lambda_l1': trial.suggest_float('l1', 1e-8, 10.0, log=True),
    }
    ...`,
    related: ['XGBoost', 'CatBoost', 'Random Forest'],
    references: ['Ke et al., "LightGBM: A Highly Efficient Gradient Boosting Decision Tree" (NeurIPS 2017)'],
  },

  {
    id: 'catboost', name: 'CatBoost', category: 'Classificação / Regressão', family: 'Ensemble — Boosting',
    description: 'Gradient Boosting da Yandex com Ordered Target Statistics para features categóricas nativas. Boa performance out-of-the-box sem feature engineering extensivo.',
    theory: 'Ordered Boosting: para cada amostra, calcula resíduos usando apenas amostras ordenadas anteriores, prevenindo target leakage. Target encoding de features categóricas: P(target|category) estimado de forma causal usando histórico passado. Simetric trees: árvores oblivious (mesma feature em todo o nível) → rápida inferência.',
    pros: ['Categorical features nativas (sem OHE manual)', 'Boa performance out-of-the-box (menos tuning)', 'Oblivious trees → inferência muito rápida', 'Resistente a overfitting por Ordered Boosting', 'Suporte GPU'],
    cons: ['Mais lento para treinar que LightGBM', 'Menos flexível em loss functions customizadas', 'Maior uso de memória que LightGBM'],
    use_cases: ['Dados com muitas features categóricas', 'Ranking', 'Dados de negócio mistos', 'Quando quer bom resultado sem muito tuning'],
    params: [
      { name: 'iterations', desc: 'Número de árvores. Com early_stopping_rounds.' },
      { name: 'learning_rate', desc: 'Default automático (~0.03). Menor = mais estável.' },
      { name: 'depth', desc: 'Profundidade. 4-8 típico (simetric trees).' },
      { name: 'l2_leaf_reg', desc: 'Regularização L2. Default=3.' },
      { name: 'cat_features', desc: 'Lista de índices/nomes das features categóricas.' },
      { name: 'auto_class_weights', desc: 'Balanced para desbalanceamento.' },
    ],
    complexity: 'Treino similar ao XGBoost | Inferência mais rápida por oblivious trees',
    when_to_use: 'Muitas features categóricas, bom resultado com pouco tuning, dados de negócio.',
    avoid_when: 'Dados puramente numéricos onde LightGBM é mais rápido.',
    metrics: { Classificação: ['AUC-ROC', 'Accuracy', 'F1', 'Log-Loss'], Regressão: ['RMSE', 'MAE', 'R²'] },
    implementation: `from catboost import CatBoostClassifier, Pool

train_pool = Pool(X_train, y_train, cat_features=['col_cat1', 'col_cat2'])
val_pool = Pool(X_val, y_val, cat_features=['col_cat1', 'col_cat2'])

model = CatBoostClassifier(
    iterations=1000,
    depth=6,
    learning_rate=0.05,
    l2_leaf_reg=3,
    auto_class_weights='Balanced',
    eval_metric='AUC',
    early_stopping_rounds=50,
    random_seed=42,
    verbose=100
)
model.fit(train_pool, eval_set=val_pool)`,
    tuning: `model.randomized_search({'depth': [4,6,8], 'learning_rate': [0.01,0.05,0.1], 'l2_leaf_reg': [1,3,5,9]}, X_train, y_train, cv=5)`,
    related: ['XGBoost', 'LightGBM', 'Random Forest'],
    references: ['Prokhorenkova et al., "CatBoost: unbiased boosting with categorical features" (NeurIPS 2018)'],
  },

  {
    id: 'gradient_boosting', name: 'Gradient Boosting (sklearn)', category: 'Classificação / Regressão', family: 'Ensemble — Boosting',
    description: 'Implementação original de Friedman. Adiciona sequencialmente árvores rasas nos pseudo-resíduos da função de perda. Base conceitual de XGBoost/LightGBM.',
    theory: 'F₀(x) = argmin_γ Σl(yᵢ,γ). Em cada iteração m: rᵢₘ = -[∂l(yᵢ,F(xᵢ))/∂F(xᵢ)]; fit hₘ(x) nos rᵢₘ; F(x) += ν·γₘ·hₘ(x). Suporta perda arbitrária diferenciável: deviance (logística), exponential (AdaBoost), huber (robusto a outliers).',
    pros: ['Sem dependências externas (sklearn puro)', 'Flexível em loss functions', 'Huber loss robusto a outliers'],
    cons: ['Mais lento que XGBoost/LightGBM', 'Sequencial — não paraleliza', 'HistGradientBoosting é alternativa mais rápida'],
    use_cases: ['Baseline boosting sem dependências externas', 'Quando Huber loss é necessária'],
    params: [
      { name: 'n_estimators', desc: 'Número de árvores. 100-500.' },
      { name: 'learning_rate', desc: '0.05-0.2. Balancear com n_estimators.' },
      { name: 'max_depth', desc: '3-5. Árvores rasas são a norma.' },
      { name: 'subsample', desc: 'Stochastic GB: <1.0 reduz variância.' },
      { name: 'loss', desc: 'log_loss (class), squared_error, huber, quantile.' },
    ],
    complexity: 'Treino O(n·p·k·log n) — 2-5x mais lento que XGBoost',
    when_to_use: 'Quando quer GB puro sem deps, ou HistGradientBoosting para datasets grandes.',
    avoid_when: 'Datasets grandes — use XGBoost ou LightGBM.',
    metrics: { Classificação: ['Accuracy', 'AUC-ROC', 'F1'], Regressão: ['RMSE', 'MAE', 'R²'] },
    implementation: `from sklearn.ensemble import GradientBoostingClassifier, HistGradientBoostingClassifier

# Clássico
model = GradientBoostingClassifier(n_estimators=300, learning_rate=0.05, max_depth=4, subsample=0.8)

# Mais rápido para datasets grandes
model = HistGradientBoostingClassifier(max_iter=500, learning_rate=0.05, max_depth=6, early_stopping=True)`,
    tuning: `param_grid = {'n_estimators':[100,300], 'learning_rate':[0.05,0.1], 'max_depth':[3,4,5], 'subsample':[0.8,1.0]}`,
    related: ['XGBoost', 'LightGBM', 'AdaBoost'],
    references: ['Friedman, "Greedy Function Approximation: A Gradient Boosting Machine" (2001)'],
  },

  {
    id: 'adaboost', name: 'AdaBoost', category: 'Classificação', family: 'Ensemble — Boosting',
    description: 'Primeiro algoritmo de boosting prático. Treina classificadores fracos sequencialmente aumentando o peso de amostras mal classificadas.',
    theory: 'Wₜ(i) = exp(-αₜyᵢhₜ(xᵢ)) / Z. O peso do classificador αₜ = ½ln((1-εₜ)/εₜ). Predição: H(x) = sign(Σ αₜhₜ(x)). O SAMME.R usa probabilidades em vez de classes, convergindo mais rápido.',
    pros: ['Simples e intuitivo', 'Baseado em teoria PAC-learning sólida', 'Poucos parâmetros'],
    cons: ['Muito sensível a outliers (pesos explodem)', 'Mais fraco que XGBoost/LightGBM', 'Apenas classificação na forma original'],
    use_cases: ['Detecção de faces (Viola-Jones)', 'Baseline boosting simples', 'Quando dados são limpos sem outliers'],
    params: [
      { name: 'n_estimators', desc: '50-200. Mais = melhor fit, risco de overfit com outliers.' },
      { name: 'learning_rate', desc: 'Shrinkage. Default=1.0. Reduzir com mais estimators.' },
      { name: 'base_estimator', desc: 'Default: DecisionTreeClassifier(max_depth=1).' },
      { name: 'algorithm', desc: 'SAMME ou SAMME.R (usa probabilidades, padrão).' },
    ],
    complexity: 'Treino O(n·p·k) | Inferência O(k)',
    when_to_use: 'Dados limpos, baseline de boosting, entendimento didático.',
    avoid_when: 'Dados com outliers — use XGBoost com regularização.',
    metrics: { Classificação: ['Accuracy', 'AUC-ROC', 'F1'] },
    implementation: `from sklearn.ensemble import AdaBoostClassifier
from sklearn.tree import DecisionTreeClassifier

model = AdaBoostClassifier(
    estimator=DecisionTreeClassifier(max_depth=1),
    n_estimators=100,
    learning_rate=0.5,
    algorithm='SAMME.R',
    random_state=42
)`,
    tuning: `param_grid = {'n_estimators': [50, 100, 200], 'learning_rate': [0.01, 0.1, 0.5, 1.0]}`,
    related: ['Gradient Boosting', 'XGBoost'],
    references: ['Freund & Schapire, "A Decision-Theoretic Generalization of On-Line Learning" (1997)'],
  },

  // ─── TREE-BASED ────────────────────────────────────────────────────────
  {
    id: 'decision_tree', name: 'Árvore de Decisão', category: 'Classificação / Regressão', family: 'Tree-based',
    description: 'Particiona o espaço de features em regiões homogêneas via regras if-then-else. Máxima interpretabilidade — pode ser visualizada como fluxograma de decisões.',
    theory: 'Split greedy: em cada nó escolhe feature j e threshold t que minimiza impureza: Δimpureza = impureza(pai) - (N_L/N)·impureza(L) - (N_R/N)·impureza(R). Gini = Σᵢ pᵢ(1-pᵢ); Entropia = -Σᵢ pᵢlog₂(pᵢ); MSE (regressão). Cost-Complexity Pruning: α regula trade-off entre tamanho e erro.',
    pros: ['Interpretabilidade máxima (white-box)', 'Nenhuma normalização necessária', 'Features mistas (numéricas + categóricas)', 'Detecta interações e relações não-lineares', 'Visualizável com plot_tree ou graphviz'],
    cons: ['Alta variância — instável a pequenas perturbações nos dados', 'Propenso a overfitting sem pruning', 'Não captura relações lineares eficientemente', 'Viés para features com muitos valores (sem correção)'],
    use_cases: ['Regras de negócio interpretáveis', 'Base para ensembles', 'Segmentação de clientes', 'EDA de splits naturais'],
    params: [
      { name: 'max_depth', desc: '3-8. None = overfitting total. Começar com 3-5.' },
      { name: 'min_samples_split', desc: 'Mínimo para dividir nó. Default=2.' },
      { name: 'min_samples_leaf', desc: 'Mínimo em folha. Maior = mais suave.' },
      { name: 'criterion', desc: 'gini ou entropy (class) | mse ou mae (regress).' },
      { name: 'ccp_alpha', desc: 'Cost-Complexity Pruning. ccp_alpha>0 poda a árvore.' },
      { name: 'max_features', desc: 'Features candidatas por split.' },
    ],
    complexity: 'Treino O(n·p·log n) | Inferência O(log n)',
    when_to_use: 'Interpretabilidade crítica, regras de negócio, EDA, base para ensembles.',
    avoid_when: 'Quando acurácia é prioritária — use ensemble. Dados linearmente separáveis — use regressão.',
    metrics: { Classificação: ['Accuracy', 'F1', 'Precision', 'Recall'], Regressão: ['RMSE', 'MAE', 'R²'] },
    implementation: `from sklearn.tree import DecisionTreeClassifier, export_text, plot_tree
import matplotlib.pyplot as plt

model = DecisionTreeClassifier(
    max_depth=5,
    criterion='gini',
    min_samples_leaf=10,
    ccp_alpha=0.01,              # pruning
    class_weight='balanced',
    random_state=42
)
model.fit(X_train, y_train)

# Visualização
plt.figure(figsize=(20, 10))
plot_tree(model, feature_names=feature_names, class_names=class_names, filled=True, rounded=True)
print(export_text(model, feature_names=feature_names))`,
    tuning: `# ccp_alpha ótimo via cross-validation
path = model.cost_complexity_pruning_path(X_train, y_train)
for alpha in path.ccp_alphas:
    clf = DecisionTreeClassifier(ccp_alpha=alpha)
    scores = cross_val_score(clf, X_train, y_train, cv=5)`,
    related: ['Random Forest', 'XGBoost', 'Decision Rules'],
    references: ['Breiman et al., "Classification and Regression Trees" (1984)'],
  },

  // ─── KERNEL / SVM ─────────────────────────────────────────────────────
  {
    id: 'svm', name: 'SVM — Support Vector Machine', category: 'Classificação / Regressão', family: 'Kernel Methods',
    description: 'Encontra o hiperplano de máxima margem entre classes. Com kernel trick, opera em espaços de dimensão infinita sem computação explícita das features transformadas.',
    theory: 'Minimiza ½||w||² + C·Σξᵢ s.a. yᵢ(wᵀxᵢ+b) ≥ 1-ξᵢ. Dual: maximize Σαᵢ - ½ΣΣαᵢαⱼyᵢyⱼK(xᵢ,xⱼ). Kernel trick: K(xᵢ,xⱼ) = φ(xᵢ)·φ(xⱼ). Kernels: linear, RBF K=exp(-γ||xᵢ-xⱼ||²), poly K=(γxᵢᵀxⱼ+r)^d, sigmoid. Predição usa apenas support vectors.',
    pros: ['Eficaz em alta dimensionalidade (NLP, genômica)', 'Kernel trick para não-linearidade', 'Máxima margem → boa generalização com poucos dados', 'Funciona bem com poucos exemplos'],
    cons: ['O(n²·p)-O(n³) para treinar — inviável para >100k amostras', 'Feature scaling obrigatório', 'Escolha do kernel é não-trivial', 'Probabilidades requerem calibração de Platt (lento)', 'Difícil de interpretar'],
    use_cases: ['Classificação de texto (com linear kernel)', 'Bioinformática e genômica', 'Reconhecimento facial', 'Dados de alta dimensão com poucas amostras'],
    params: [
      { name: 'C', desc: 'Penalidade por violação da margem. Alto=menos margem, mais fit.' },
      { name: 'kernel', desc: 'rbf (default), linear, poly, sigmoid.' },
      { name: 'gamma', desc: 'RBF: scale=1/(p·Var(X)), auto=1/p. Controla raio de influência.' },
      { name: 'degree', desc: 'Grau do kernel poly. Default=3.' },
      { name: 'probability', desc: 'True para predict_proba (lento — usa Platt scaling).' },
      { name: 'class_weight', desc: 'balanced para desbalanceamento.' },
    ],
    complexity: 'Treino O(n²·p)-O(n³) | Inferência O(n_sv·p)',
    when_to_use: 'Alta dimensionalidade, poucos dados (<10k), quando kernel pode capturar a estrutura.',
    avoid_when: 'Datasets grandes (>100k), quando velocidade é crítica, quando interpretabilidade necessária.',
    metrics: { Classificação: ['Accuracy', 'AUC-ROC', 'F1', 'SVM Margin'], Regressão: ['RMSE', 'MAE', 'R²'] },
    implementation: `from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

pipe = Pipeline([
    ('scaler', StandardScaler()),
    ('svm', SVC(
        C=1.0,
        kernel='rbf',
        gamma='scale',
        probability=True,        # para predict_proba
        class_weight='balanced',
        random_state=42
    ))
])
# Para datasets grandes, usar LinearSVC ou SGDClassifier(loss='hinge')`,
    tuning: `param_grid = {'svm__C': [0.1, 1, 10, 100], 'svm__gamma': ['scale', 'auto', 0.001, 0.01]}
gs = GridSearchCV(pipe, param_grid, cv=5, scoring='roc_auc')`,
    related: ['Logistic Regression', 'Linear SVC', 'Kernel PCA'],
    references: ['Cortes & Vapnik, "Support-Vector Networks" (1995)', 'Scholkopf & Smola, "Learning with Kernels" (2002)'],
  },

  // ─── PROBABILÍSTICO ───────────────────────────────────────────────────
  {
    id: 'naive_bayes', name: 'Naive Bayes', category: 'Classificação', family: 'Probabilístico',
    description: 'Classificador probabilístico baseado no Teorema de Bayes com suposição de independência condicional entre features dada a classe. Surpreendentemente eficaz em NLP.',
    theory: 'P(y|x) ∝ P(y) · Πᵢ P(xᵢ|y). Apesar da suposição "naive" frequentemente violada, ainda minimiza corretamente a probabilidade de erro na classificação (argmax). Variantes: Gaussian (contínuo, assume N(μ,σ²)), Multinomial (contagens, TF-IDF, Bag-of-Words), Bernoulli (binário).',
    pros: ['Treino O(n·p) — extremamente rápido', 'Funciona com poucos dados', 'Excelente para NLP (Multinomial NB)', 'Sem overfitting em alta dimensionalidade', 'Atualização online trivial'],
    cons: ['Suposição de independência raramente válida', 'Probabilidades pouco calibradas', 'Zero frequency → Laplace smoothing necessário', 'Péssimo com features fortemente correlacionadas'],
    use_cases: ['Classificação de texto e spam', 'Análise de sentimentos (Bag-of-Words)', 'Diagnóstico com features independentes', 'Baseline rápido em NLP'],
    params: [
      { name: 'var_smoothing (GaussianNB)', desc: 'Suavização de variância. Default=1e-9.' },
      { name: 'alpha (MultinomialNB)', desc: 'Laplace/Lidstone smoothing. Default=1.0.' },
      { name: 'fit_prior', desc: 'Usar priors de classe. False = uniforme.' },
      { name: 'binarize (BernoulliNB)', desc: 'Threshold para binarizar features.' },
    ],
    complexity: 'Treino O(n·p) | Inferência O(k·p)',
    when_to_use: 'NLP/texto, baseline rápido, poucos dados, features binárias.',
    avoid_when: 'Features fortemente correlacionadas, quando probabilidades calibradas são críticas.',
    metrics: { Classificação: ['Accuracy', 'AUC-ROC', 'F1', 'Log-Loss'] },
    implementation: `from sklearn.naive_bayes import MultinomialNB, GaussianNB, BernoulliNB
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline

# Para texto (NLP)
text_model = Pipeline([
    ('tfidf', TfidfVectorizer(max_features=10000, ngram_range=(1,2))),
    ('clf', MultinomialNB(alpha=0.1))
])

# Para features contínuas
num_model = GaussianNB(var_smoothing=1e-9)

# Para features binárias
bin_model = BernoulliNB(alpha=1.0, binarize=0.5)`,
    tuning: `alpha_range = [0.001, 0.01, 0.1, 0.5, 1.0, 5.0, 10.0]
scores = [cross_val_score(MultinomialNB(alpha=a), X, y, cv=5).mean() for a in alpha_range]`,
    related: ['Logistic Regression (NLP)', 'Linear SVC (NLP)', 'Complement NB'],
    references: ['Mitchell, "Machine Learning" Cap. 6 (1997)', 'McCallum & Nigam, "A comparison of event models for NB classifiers" (1998)'],
  },

  // ─── INSTANCE-BASED ───────────────────────────────────────────────────
  {
    id: 'knn', name: 'K-Nearest Neighbors (KNN)', category: 'Classificação / Regressão', family: 'Instance-based',
    description: 'Algoritmo de aprendizado preguiçoso (lazy learning). Classifica com base na classe majoritária (ou média) dos K vizinhos mais próximos no espaço de features.',
    theory: 'Sem fase de treino — memoriza todos os dados. Na inferência: calcula d(x, xᵢ) ∀ xᵢ ∈ D (Euclidiana, Manhattan, Minkowski p, Cosine). Seleciona K menores distâncias. Votação: ŷ = mode({yᵢ : xᵢ ∈ N_K(x)}) ou ponderada por 1/d. Para regressão: ŷ = mean({yᵢ : xᵢ ∈ N_K(x)}).',
    pros: ['Sem fase de treino (O(1))', 'Naturalmente multiclasse', 'Não-paramétrico — sem suposições', 'Decisões locais e adaptáveis'],
    cons: ['O(n·p) por predição — inviável para datasets grandes', 'Alto uso de memória (guarda tudo)', 'Feature scaling obrigatório', 'Curse of dimensionality severa em p>20', 'Sem suporte nativo a NaN'],
    use_cases: ['Sistemas de recomendação simples', 'Imputação KNN de valores ausentes', 'Datasets pequenos (<10k) com estrutura local clara'],
    params: [
      { name: 'n_neighbors (K)', desc: 'Número de vizinhos. Default=5. K grande = mais suave.' },
      { name: 'weights', desc: 'uniform ou distance (1/d penaliza vizinhos distantes).' },
      { name: 'metric', desc: 'euclidean, manhattan, minkowski(p), cosine.' },
      { name: 'algorithm', desc: 'ball_tree, kd_tree (eficiente), brute (força bruta).' },
      { name: 'p', desc: 'Minkowski: p=1 Manhattan, p=2 Euclidiana.' },
    ],
    complexity: 'Treino O(1) | Inferência O(n·p) | Memória O(n·p)',
    when_to_use: 'Datasets pequenos, imputação KNN, quando a localidade das predições é essencial.',
    avoid_when: 'Datasets grandes, alta dimensionalidade sem redução, inferência em tempo real.',
    metrics: { Classificação: ['Accuracy', 'F1', 'AUC-ROC'], Regressão: ['RMSE', 'MAE', 'R²'] },
    implementation: `from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

pipe = Pipeline([
    ('scaler', StandardScaler()),
    ('knn', KNeighborsClassifier(n_neighbors=7, weights='distance', metric='euclidean', n_jobs=-1))
])

# Encontrar K ótimo via CV
k_scores = [cross_val_score(Pipeline([('sc',StandardScaler()),('knn',KNeighborsClassifier(k))]), X, y, cv=5).mean() for k in range(1,21)]`,
    tuning: `param_grid = {'knn__n_neighbors': range(1,21), 'knn__weights': ['uniform','distance'], 'knn__metric': ['euclidean','manhattan']}`,
    related: ['Radius Neighbors', 'DBSCAN', 'LOF (Anomaly)'],
    references: ['Cover & Hart, "Nearest Neighbor Pattern Classification" (1967)'],
  },

  // ─── DEEP LEARNING ────────────────────────────────────────────────────
  {
    id: 'neural_network', name: 'Rede Neural MLP', category: 'Classificação / Regressão', family: 'Deep Learning',
    description: 'Perceptron Multicamadas com camadas densas totalmente conectadas. Aprende representações hierárquicas via backpropagation. Universal approximator (Teorema de Cybenko).',
    theory: 'Cada camada: zˡ = Wˡaˡ⁻¹ + bˡ; aˡ = f(zˡ). Backpropagation: δˡ = (Wˡ⁺¹)ᵀδˡ⁺¹ ⊙ f\'(zˡ); ∂L/∂Wˡ = δˡ(aˡ⁻¹)ᵀ. Ativações: ReLU f(z)=max(0,z) evita vanishing gradient; LeakyReLU f(z)=max(αz,z); GELU usado em Transformers. Regularização: Dropout p, L2 (weight decay), Batch Normalization.',
    pros: ['Aproxima funções arbitrariamente complexas', 'Escalável com GPU/TPU', 'Flexível — múltiplas arquiteturas', 'Transfer learning possível'],
    cons: ['Requer muito dados para generalizar', 'Caixa preta — baixa interpretabilidade', 'Computacionalmente intensivo', 'Muitos hiperparâmetros sensíveis', 'Propenso a overfitting sem regularização'],
    use_cases: ['Padrões complexos em dados tabulares grandes', 'NLP (embedding + MLP)', 'Dados com muitas interações', 'Quando ensembles de árvores não chegam'],
    params: [
      { name: 'hidden_layer_sizes', desc: 'Arquitetura ex: (256,128,64). Mais camadas = mais capacidade.' },
      { name: 'activation', desc: 'relu (padrão), tanh, logistic.' },
      { name: 'solver', desc: 'adam (padrão, adaptativo), sgd (com momentum).' },
      { name: 'alpha', desc: 'Regularização L2 (weight decay). Default=0.0001.' },
      { name: 'learning_rate_init', desc: 'LR inicial. Default=0.001.' },
      { name: 'batch_size', desc: 'auto (min(200,n)) ou int. Menor = mais ruído = melhor generalização.' },
      { name: 'max_iter', desc: 'Épocas máximas. Usar early_stopping=True.' },
      { name: 'dropout', desc: 'Via PyTorch/Keras — não disponível no sklearn MLP.' },
    ],
    complexity: 'Treino O(épocas·n·Σlayers) | Inferência O(Σlayers)',
    when_to_use: 'Grandes volumes (>50k) com padrões complexos, quando ensembles de árvores não bastam.',
    avoid_when: 'Dados tabulares pequenos — XGBoost supera. Quando interpretabilidade é crítica.',
    metrics: { Classificação: ['Accuracy', 'AUC-ROC', 'F1', 'Log-Loss'], Regressão: ['RMSE', 'MAE', 'R²'] },
    implementation: `from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

pipe = Pipeline([
    ('scaler', StandardScaler()),
    ('mlp', MLPClassifier(
        hidden_layer_sizes=(256, 128, 64),
        activation='relu',
        solver='adam',
        alpha=0.001,              # L2 regularization
        learning_rate_init=0.001,
        batch_size=256,
        max_iter=500,
        early_stopping=True,
        validation_fraction=0.1,
        n_iter_no_change=20,
        random_state=42
    ))
])

# Para maior controle: usar PyTorch ou Keras
# import torch.nn as nn
# model = nn.Sequential(nn.Linear(p,256), nn.ReLU(), nn.Dropout(0.3),
#                       nn.Linear(256,128), nn.ReLU(), nn.Linear(128,1))`,
    tuning: `param_grid = {
    'mlp__hidden_layer_sizes': [(64,), (128,64), (256,128,64)],
    'mlp__alpha': [0.0001, 0.001, 0.01],
    'mlp__learning_rate_init': [0.0001, 0.001, 0.01]
}`,
    related: ['XGBoost', 'TabNet', 'PyTorch Lightning', 'Keras'],
    references: ['LeCun et al., "Gradient-based learning applied to document recognition" (1998)', 'Glorot & Bengio, "Understanding the difficulty of training DNNs" (2010)'],
  },

  // ─── REGRESSÃO LINEAR ─────────────────────────────────────────────────
  {
    id: 'linear_regression', name: 'Regressão Linear (OLS)', category: 'Regressão', family: 'Linear',
    description: 'Baseline fundamental de regressão. Minimiza a Soma dos Quadrados dos Resíduos (OLS). Solução analítica exata, coeficientes com p-valores e intervalos de confiança.',
    theory: 'ŷ = Xβ. OLS: β = (XᵀX)⁻¹Xᵀy. Pressupõe: (1) linearidade, (2) homocedasticidade, (3) independência dos erros, (4) normalidade dos resíduos, (5) ausência de multicolinearidade perfeita. Teorema Gauss-Markov: OLS é BLUE (Best Linear Unbiased Estimator).',
    pros: ['Solução analítica exata', 'Coeficientes interpretáveis (∂ŷ/∂xⱼ = βⱼ)', 'p-valores e intervalos de confiança', 'Diagnóstico via resíduos (QQ-plot, Durbin-Watson, VIF)', 'Baseline obrigatório'],
    cons: ['Apenas relações lineares', 'Sensível a outliers (minimiza quadrados → outlier influencia muito)', 'Instável com multicolinearidade', 'Assume variância constante dos erros'],
    use_cases: ['Econometria e análise causal', 'Precificação com interpretação de coeficientes', 'Baseline de regressão', 'Dados com relação linear confirmada por teoria'],
    params: [
      { name: 'fit_intercept', desc: 'Se deve estimar β₀. Default=True.' },
      { name: 'positive', desc: 'Força coeficientes não-negativos. Default=False.' },
    ],
    complexity: 'Treino O(n·p²) | Inferência O(p)',
    when_to_use: 'Baseline, interpretação de coeficientes necessária, dados com relação linear, análise causal.',
    avoid_when: 'Relações não-lineares, outliers extremos (use HuberRegressor), multicolinearidade (use Ridge/Lasso).',
    metrics: { Regressão: ['RMSE', 'MAE', 'R²', 'Adjusted R²', 'MAPE', 'AIC', 'BIC'] },
    implementation: `from sklearn.linear_model import LinearRegression
import statsmodels.api as sm

# sklearn (simples)
model = LinearRegression()
model.fit(X_train, y_train)
print(f"Coeficientes: {dict(zip(feature_names, model.coef_))}")
print(f"R²: {model.score(X_test, y_test):.4f}")

# statsmodels (p-valores, IC, diagnósticos)
X_sm = sm.add_constant(X_train)
ols = sm.OLS(y_train, X_sm).fit()
print(ols.summary())
# Diagnóstico de multicolinearidade
from statsmodels.stats.outliers_influence import variance_inflation_factor
vif = [variance_inflation_factor(X_train.values, i) for i in range(X_train.shape[1])]`,
    tuning: 'OLS não tem hiperparâmetros. Para regularização, use Ridge, Lasso ou ElasticNet.',
    related: ['Ridge', 'Lasso', 'ElasticNet', 'HuberRegressor', 'Polynomial Regression'],
    references: ['Gauss-Markov Theorem', 'Greene, "Econometric Analysis" (2012)'],
  },

  {
    id: 'ridge', name: 'Ridge Regression (L2)', category: 'Regressão', family: 'Linear Regularizado',
    description: 'Regressão linear com penalidade L2. Encolhe coeficientes em direção a zero sem eliminá-los. Solução estável mesmo com multicolinearidade severa.',
    theory: 'Minimiza ||y - Xβ||² + α||β||². Solução: β = (XᵀX + αI)⁻¹Xᵀy. A matriz (XᵀX + αI) é sempre inversível. Visão Bayesiana: equivalente a prior Gaussiano N(0, σ²/α) sobre β. Bias-variance trade-off: maior α → maior bias, menor variância.',
    pros: ['Estável com multicolinearidade', 'Todos coeficientes mantidos', 'Solução analítica', 'RidgeCV seleciona α automaticamente por LOO-CV'],
    cons: ['Não faz seleção de features (todos coeficientes ≠ 0)', 'Feature scaling obrigatório', 'Menos interpretável que OLS'],
    use_cases: ['Multicolinearidade severa (VIF > 10)', 'Genomics e proteomics (p >> n)', 'Features correlacionadas sem querer eliminá-las'],
    params: [
      { name: 'alpha', desc: 'Intensidade da regularização. Maior = mais shrinkage. Usar RidgeCV.' },
      { name: 'solver', desc: 'auto, svd (estável), cholesky, sag (grande), lsqr.' },
      { name: 'fit_intercept', desc: 'Intercepto não é regularizado. Default=True.' },
    ],
    complexity: 'Treino O(n·p²) | Inferência O(p)',
    when_to_use: 'Features correlacionadas, p próximo ou maior que n, quando quer manter todas as features.',
    avoid_when: 'Quando precisa de seleção automática de features → use Lasso.',
    metrics: { Regressão: ['RMSE', 'MAE', 'R²', 'CV-MSE'] },
    implementation: `from sklearn.linear_model import Ridge, RidgeCV
import numpy as np

# Seleciona alpha automaticamente (LOO-CV eficiente)
alphas = np.logspace(-3, 3, 100)
model = RidgeCV(alphas=alphas, cv=5, scoring='neg_mean_squared_error')
model.fit(X_train, y_train)
print(f"Alpha ótimo: {model.alpha_:.4f}")
print(f"R²: {model.score(X_test, y_test):.4f}")`,
    tuning: 'Use RidgeCV — seleciona alpha ótimo por LOO-CV em O(n²p) sem cross-validation manual.',
    related: ['Lasso', 'ElasticNet', 'Linear Regression', 'Bayesian Ridge'],
    references: ['Tikhonov, "Regularization of ill-posed problems" (1963)'],
  },

  {
    id: 'lasso', name: 'Lasso Regression (L1)', category: 'Regressão', family: 'Linear Regularizado',
    description: 'Regressão linear com penalidade L1. Induz esparsidade — coeficientes não-importantes são zerados exatamente, realizando seleção automática de features.',
    theory: 'Minimiza ||y - Xβ||² + α·Σ|βⱼ|. Sem solução analítica fechada — usa coordinate descent. A norma L1 cria região viável com "cantos" nos eixos, onde a solução frequentemente recai com βⱼ = 0. Lasso Bayesiano: equivalente a prior Laplace (double exponential) sobre β.',
    pros: ['Seleção automática de features (coeficientes = 0)', 'Modelo esparso e interpretável', 'Ideal para p >> n com poucas features relevantes', 'LassoCV seleciona α por CV'],
    cons: ['Instável com features fortemente correlacionadas (seleciona arbitrariamente uma)', 'Mais lento que Ridge (sem analítica)', 'Pode eliminar features relevantes com α muito alto'],
    use_cases: ['Alta dimensionalidade — poucas features relevantes', 'Genômica (GWAS)', 'Seleção de variáveis em modelos económétricos', 'NLP (bag-of-words esparso)'],
    params: [
      { name: 'alpha', desc: 'Maior α = mais zeros. Usar LassoCV.' },
      { name: 'max_iter', desc: 'Aumentar se não convergir. Default=1000.' },
      { name: 'selection', desc: 'cyclic (default) ou random (mais rápido em alta dim).' },
    ],
    complexity: 'Treino O(n·p·iter) via coordinate descent',
    when_to_use: 'Esparsidade desejada, poucas features relevantes, seleção automática de variáveis.',
    avoid_when: 'Features fortemente correlacionadas → use ElasticNet.',
    metrics: { Regressão: ['RMSE', 'MAE', 'R²', 'Nº features não-zero'] },
    implementation: `from sklearn.linear_model import LassoCV, Lasso
import numpy as np

# Alpha selecionado por CV
model = LassoCV(alphas=None, cv=10, max_iter=10000, n_jobs=-1)
model.fit(X_train, y_train)
print(f"Alpha ótimo: {model.alpha_:.6f}")

# Features selecionadas (coef != 0)
selected = [f for f, c in zip(feature_names, model.coef_) if c != 0]
print(f"Features selecionadas ({len(selected)}): {selected}")`,
    tuning: 'Use LassoCV com cv=10 para seleção automática de alpha.',
    related: ['Ridge', 'ElasticNet', 'Lasso Lars', 'Group Lasso'],
    references: ['Tibshirani, "Regression Shrinkage and Selection via the Lasso" (1996)'],
  },

  {
    id: 'elasticnet', name: 'ElasticNet', category: 'Regressão', family: 'Linear Regularizado',
    description: 'Combina penalidades L1 (Lasso) e L2 (Ridge). Produz modelos esparsos como Lasso mas estáveis em grupos de features correlacionadas como Ridge.',
    theory: 'Minimiza ||y-Xβ||² + α·ρ·Σ|βⱼ| + α·(1-ρ)/2·Σβⱼ². O parâmetro l1_ratio=ρ controla o balanço: ρ=1 → Lasso; ρ=0 → Ridge. Grouping effect: features correlacionadas tendem a ter coeficientes parecidos.',
    pros: ['Combina esparsidade do Lasso com estabilidade do Ridge', 'Estável com grupos de features correlacionadas', 'ElasticNetCV para tuning automático'],
    cons: ['2 parâmetros para tunar (alpha e l1_ratio)', 'Mais lento que Ridge', 'Mais complexo que Lasso/Ridge puros'],
    use_cases: ['Features correlacionadas onde Lasso é instável', 'Alta dimensionalidade com grupos de features relevantes'],
    params: [
      { name: 'alpha', desc: 'Força total da regularização.' },
      { name: 'l1_ratio', desc: 'Balanço L1/L2. 0=Ridge, 1=Lasso, 0.5=meio-a-meio.' },
    ],
    complexity: 'Treino O(n·p·iter) similar ao Lasso',
    when_to_use: 'Features correlacionadas com esparsidade desejada. Default recomendado: l1_ratio=0.5.',
    avoid_when: 'Quando Ridge ou Lasso puro atende — ElasticNet adiciona hiperparâmetro extra.',
    metrics: { Regressão: ['RMSE', 'MAE', 'R²', 'Nº features não-zero'] },
    implementation: `from sklearn.linear_model import ElasticNetCV
model = ElasticNetCV(l1_ratio=[0.1, 0.5, 0.7, 0.9, 0.95, 1.0], alphas=None, cv=10, max_iter=10000, n_jobs=-1)
model.fit(X_train, y_train)
print(f"l1_ratio: {model.l1_ratio_:.2f} | alpha: {model.alpha_:.6f}")`,
    tuning: 'Use ElasticNetCV — testa múltiplos l1_ratio e alpha automaticamente.',
    related: ['Ridge', 'Lasso', 'Sparse Linear Models'],
    references: ['Zou & Hastie, "Regularization and Variable Selection via the Elastic Net" (2005)'],
  },

  // ─── CLUSTERING ───────────────────────────────────────────────────────
  {
    id: 'kmeans', name: 'K-Means Clustering', category: 'Clustering', family: 'Particionamento',
    description: 'Particiona n observações em k clusters minimizando a variância intra-cluster (WCSS/inércia). Algoritmo iterativo Lloyd alternando atribuição e atualização de centroides.',
    theory: 'Minimiza Σᵢ Σₓ∈Cᵢ ||x-μᵢ||². K-Means++: primeiro centroide aleatório; os seguintes com P(x) ∝ d(x, centroide mais próximo)², acelerando convergência. Converge para mínimo local — n_init inicializações independentes. Elbow method: plotar inércia vs K.',
    pros: ['Simples e escalável O(n·k·iter·p)', 'K-Means++ garante convergência 8·ln(k) da solução ótima', 'Fácil de interpretar (centroides)', 'MiniBatchKMeans para datasets enormes'],
    cons: ['k deve ser especificado a priori', 'Assume clusters esféricos e tamanho similar', 'Sensível à inicialização e outliers', 'Não detecta clusters não-convexos', 'Distância Euclidiana — mal em alta dimensão'],
    use_cases: ['Segmentação de clientes (RFM)', 'Compressão de imagens (quantização de cores)', 'Inicialização de GMM', 'Document clustering'],
    params: [
      { name: 'n_clusters (k)', desc: 'Definir via Elbow, Silhouette ou conhecimento de domínio.' },
      { name: 'init', desc: "k-means++ (padrão, muito melhor que random)." },
      { name: 'n_init', desc: 'Inicializações independentes. Default=10. Aumentar para estabilidade.' },
      { name: 'max_iter', desc: 'Iterações por inicialização. Default=300.' },
      { name: 'algorithm', desc: 'lloyd (padrão), elkan (mais rápido para baixa dimensão).' },
    ],
    complexity: 'Treino O(n·k·iter·p) | Inferência O(k·p)',
    when_to_use: 'Clustering exploratório, clusters bem separados e esféricos, quando k é estimável.',
    avoid_when: 'Clusters irregulares → DBSCAN. Diferentes densidades → HDBSCAN. Outliers → DBSCAN/Spectral.',
    metrics: { Clustering: ['Inércia (WCSS)', 'Silhouette Score (-1 a 1)', 'Davies-Bouldin Index', 'Calinski-Harabasz', 'ARI (se labels disponíveis)'] },
    implementation: `from sklearn.cluster import KMeans, MiniBatchKMeans
from sklearn.metrics import silhouette_score, davies_bouldin_score
import matplotlib.pyplot as plt

# Elbow method para escolher K
inertias = [KMeans(k, n_init=10, random_state=42).fit(X).inertia_ for k in range(2, 15)]

# K ótimo via Silhouette
scores = [silhouette_score(X, KMeans(k, n_init=10).fit_predict(X)) for k in range(2, 15)]
k_opt = range(2,15)[scores.index(max(scores))]

model = KMeans(n_clusters=k_opt, init='k-means++', n_init=20, random_state=42)
labels = model.fit_predict(X)
print(f"Silhouette: {silhouette_score(X, labels):.4f}")
print(f"Davies-Bouldin: {davies_bouldin_score(X, labels):.4f}")`,
    tuning: 'Principal hiperparâmetro é k. Use Elbow + Silhouette Score em conjunto.',
    related: ['Gaussian Mixture Models', 'DBSCAN', 'Agglomerative Clustering', 'Spectral Clustering'],
    references: ['MacQueen, "Some methods for classification and analysis of multivariate observations" (1967)', 'Arthur & Vassilvitskii, "k-means++: The advantages of careful seeding" (2007)'],
  },

  {
    id: 'dbscan', name: 'DBSCAN', category: 'Clustering', family: 'Baseado em Densidade',
    description: 'Density-Based Spatial Clustering of Applications with Noise. Descobre clusters de forma arbitrária baseado em densidade e identifica outliers como noise points.',
    theory: 'Core point: ≥ min_samples vizinhos em raio ε. Border point: alcançável por core point mas com < min_samples vizinhos. Noise: não alcançável por nenhum core. Clusters = componentes conexos de core points. Não assume forma ou número de clusters.',
    pros: ['Clusters de forma arbitrária', 'Identifica outliers automaticamente (label=-1)', 'Não precisa especificar k', 'Robusto a outliers nos clusters encontrados'],
    cons: ['Sensível à escolha de ε e min_samples', 'Degrada em alta dimensionalidade', 'Falha com clusters de densidades muito diferentes (use HDBSCAN)', 'O(n²) sem índices espaciais'],
    use_cases: ['Detecção de anomalias geoespaciais', 'Clusters de forma irregular', 'Remoção de outliers', 'Análise de densidade de eventos'],
    params: [
      { name: 'eps (ε)', desc: 'Raio de vizinhança. Estimar via k-distance plot (cotovelo).' },
      { name: 'min_samples', desc: 'Mínimo de pontos para core point. Maior = menos clusters, mais noise.' },
      { name: 'metric', desc: 'euclidean, manhattan, cosine, haversine (geo).' },
      { name: 'algorithm', desc: 'auto, ball_tree, kd_tree (eficientes), brute.' },
    ],
    complexity: 'Treino O(n·log n) com índice espacial | O(n²) sem',
    when_to_use: 'Clusters irregulares, detecção de outliers, número de clusters desconhecido e variável.',
    avoid_when: 'Clusters de densidades muito diferentes → HDBSCAN. Alta dimensão sem PCA prévia.',
    metrics: { Clustering: ['Silhouette Score', 'Davies-Bouldin', 'Noise fraction (%)', 'Número de clusters encontrados'] },
    implementation: `from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler
import numpy as np

# Estimar eps via k-distance plot
from sklearn.neighbors import NearestNeighbors
nn = NearestNeighbors(n_neighbors=5).fit(X_scaled)
distances, _ = nn.kneighbors(X_scaled)
k_distances = np.sort(distances[:, -1])  # plotar e achar cotovelo = eps ótimo

model = DBSCAN(eps=0.5, min_samples=10, metric='euclidean', n_jobs=-1)
labels = model.fit_predict(StandardScaler().fit_transform(X))
n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
n_noise = (labels == -1).sum()
print(f"Clusters: {n_clusters} | Noise: {n_noise} ({n_noise/len(labels)*100:.1f}%)")`,
    tuning: 'eps: k-distance plot (cotovelo) com k=min_samples. min_samples: regra ~2·p ou usar validação.',
    related: ['HDBSCAN', 'OPTICS', 'KMeans', 'LOF'],
    references: ['Ester et al., "A Density-Based Algorithm for Discovering Clusters in Large Spatial Databases with Noise" (KDD 1996)'],
  },

  // ─── ANOMALY DETECTION ────────────────────────────────────────────────
  {
    id: 'isolation_forest', name: 'Isolation Forest', category: 'Anomaly Detection', family: 'Ensemble',
    description: 'Detecta anomalias via isolamento aleatório. Anomalias são isoladas mais facilmente (menor profundidade nas árvores). Eficiente e sem suposições sobre distribuição.',
    theory: 'Score: s(x,n) = 2^(-E[h(x)]/c(n)) onde h(x) = profundidade média nas iTrees e c(n) = 2H(n-1) - 2(n-1)/n (fator de normalização). s→1: anomalia; s→0.5: normal; s<0.5: inlier. Não requer dados "normais" para treinar.',
    pros: ['Não requer rótulos de anomalia', 'Robusto à alta dimensionalidade', 'Eficiente O(n·t·ψ)', 'Sem normalização necessária', 'Poucos hiperparâmetros'],
    cons: ['Menos eficaz para anomalias em subespaços locais', 'Score não é probabilidade direta', 'Subótimo para anomalias coletivas/contextuais'],
    use_cases: ['Detecção de fraude financeira', 'Intrusão em redes', 'Monitoramento industrial (sensores)', 'Controle de qualidade'],
    params: [
      { name: 'n_estimators', desc: 'Número de iTrees. 100-200 geralmente suficiente.' },
      { name: 'max_samples', desc: 'Subconjunto por árvore. auto=min(256, n).' },
      { name: 'contamination', desc: 'Fração esperada de anomalias. Define threshold. Default=auto.' },
      { name: 'max_features', desc: 'Features por árvore. Default=1.0.' },
    ],
    complexity: 'Treino O(t·ψ·log ψ) | Inferência O(t·log ψ)',
    when_to_use: 'Detecção não-supervisionada, dados de alta dimensão, quando a fração de anomalias é <10%.',
    avoid_when: 'Anomalias em subespaços locais → LOF. Anomalias temporais → Séries Temporais específicos.',
    metrics: { Anomaly: ['AUC-ROC (se labels)', 'Average Precision', 'F1 na classe anomalia', 'Contamination rate'] },
    implementation: `from sklearn.ensemble import IsolationForest
from sklearn.metrics import roc_auc_score, average_precision_score

model = IsolationForest(
    n_estimators=200,
    max_samples='auto',
    contamination=0.05,          # 5% de anomalias esperadas
    n_jobs=-1,
    random_state=42
)
scores = model.fit_predict(X)    # -1=anomalia, 1=normal
decision_scores = model.decision_function(X)  # score contínuo

# Se tiver labels reais:
# auc = roc_auc_score(y_true, -decision_scores)  # negado pois scores menores = mais anômalo`,
    tuning: 'contamination é o principal parâmetro. Calibrar com base na taxa real de anomalias no domínio.',
    related: ['Local Outlier Factor (LOF)', 'One-Class SVM', 'HBOS', 'Autoencoder para anomalias'],
    references: ['Liu et al., "Isolation Forest" (ICDM 2008)'],
  },

  // ─── DIMENSIONALITY REDUCTION ─────────────────────────────────────────
  {
    id: 'pca', name: 'PCA — Principal Component Analysis', category: 'Redução de Dimensionalidade', family: 'Linear',
    description: 'Transforma features correlacionadas em componentes ortogonais que maximizam variância explicada. Técnica de redução linear mais utilizada em ML.',
    theory: 'Calcula SVD de X: X = UΣVᵀ. As colunas de V = autovetores da matriz de covariância C = (1/n)XᵀX. Componentes = XVₖ ∈ ℝ^(n×k). Variância explicada do componente j = σⱼ² / Σσᵢ². Whitening: divide por σⱼ para variância unitária.',
    pros: ['Remove multicolinearidade', 'Reduz ruído (componentes de baixa variância = ruído)', 'Visualização em 2D/3D', 'Acelera algoritmos subsequentes', 'Compressão sem perda controlada'],
    cons: ['Componentes = combinações lineares — menos interpretáveis', 'Perde interpretabilidade das features originais', 'Scaling obrigatório', 'Não preserva estrutura não-linear'],
    use_cases: ['Pré-processamento antes de SVM/KNN', 'Visualização de dados', 'Eigenfaces (reconhecimento facial)', 'Remoção de multicolinearidade', 'Compressão de imagens'],
    params: [
      { name: 'n_components', desc: 'int (k componentes), float (% variância, ex: 0.95), mle (auto), None (todas).' },
      { name: 'svd_solver', desc: 'auto, full (acurado), randomized (rápido, grande p), arpack (sparse).' },
      { name: 'whiten', desc: 'True para variância unitária em cada componente.' },
    ],
    complexity: 'SVD completo O(min(n,p)·p²) | SVD truncado O(n·p·k)',
    when_to_use: 'Features correlacionadas, visualização, pré-processamento para SVM/KNN, quando quer manter k% da variância.',
    avoid_when: 'Interpretabilidade das features originais necessária, estrutura não-linear (use t-SNE/UMAP).',
    metrics: { Reducao: ['Variância explicada/componente (%)', 'Variância acumulada (%)', 'Reconstruction error', 'Scree plot'] },
    implementation: `from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
import matplotlib.pyplot as plt
import numpy as np

# Pipeline com scaling
from sklearn.pipeline import Pipeline
pipe = Pipeline([('scaler', StandardScaler()), ('pca', PCA(n_components=0.95))])  # 95% variância
X_reduced = pipe.fit_transform(X)
pca = pipe.named_steps['pca']

# Análise de componentes
print(f"Componentes selecionados: {pca.n_components_}")
print(f"Variância acumulada: {np.cumsum(pca.explained_variance_ratio_)}")

# Scree plot
plt.bar(range(1, len(pca.explained_variance_ratio_)+1), pca.explained_variance_ratio_)
plt.xlabel('Componente'); plt.ylabel('Variância explicada'); plt.title('Scree Plot')`,
    tuning: 'Principal decisão: n_components. Use 0.95 como default (95% da variância). Visualize Scree Plot.',
    related: ['t-SNE', 'UMAP', 'Kernel PCA', 'Factor Analysis', 'ICA'],
    references: ['Pearson, "On lines and planes of closest fit to systems of points in space" (1901)', 'Jolliffe, "Principal Component Analysis" (2002)'],
  },

  // ─── REGRESSÃO ESPECIAL ───────────────────────────────────────────────
  {
    id: 'huber_regressor', name: 'HuberRegressor', category: 'Regressão', family: 'Linear Regularizado',
    description: 'Regressão robusta que usa função de perda Huber: quadrática para erros pequenos e linear para erros grandes. Muito menos sensível a outliers que OLS.',
    theory: 'L(r) = r²/2 se |r| ≤ ε; ε·(|r| - ε/2) se |r| > ε. O parâmetro ε controla a transição quadrático→linear. Outliers têm influência limitada (linear) enquanto inliers usam OLS (quadrático). Equivalente a M-estimators da estatística robusta.',
    pros: ['Robusto a outliers — não remove, apenas reduz influência', 'Parâmetro epsilon intuitivo', 'Combinação ótima entre MSE (baixo ruído) e MAE (alta robustez)', 'Bom em dados de engenharia e finanças com anomalias'],
    cons: ['Mais lento que LinearRegression', 'ε deve ser tuneado', 'Sem solução analítica — iterativo'],
    use_cases: ['Dados financeiros com outliers (preços, retornos)', 'Sensores com leituras anômalas', 'Dados de produção industrial'],
    params: [
      { name: 'epsilon', desc: 'Ponto de transição quadrático→linear. Default=1.35. Maior=mais robustez.' },
      { name: 'alpha', desc: 'Regularização L2. Default=0.0001.' },
      { name: 'max_iter', desc: 'Iterações máximas. Default=100.' },
    ],
    complexity: 'Treino O(n·p·iter) | Inferência O(p)',
    when_to_use: 'Dados com outliers conhecidos onde OLS se deteriora drasticamente.',
    avoid_when: 'Dados limpos sem outliers — OLS é mais eficiente.',
    metrics: { Regressão: ['RMSE', 'MAE', 'R²', 'Huber Loss'] },
    implementation: `from sklearn.linear_model import HuberRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

pipe = Pipeline([
    ('scaler', StandardScaler()),
    ('huber', HuberRegressor(epsilon=1.35, alpha=0.0001, max_iter=200))
])
pipe.fit(X_train, y_train)
print(f"R²: {pipe.score(X_test, y_test):.4f}")

# Identificar outliers via resíduos
preds = pipe.predict(X_train)
residuals = y_train - preds
outliers_mask = pipe.named_steps['huber'].outliers_`,
    tuning: `from sklearn.model_selection import GridSearchCV
param_grid = {'huber__epsilon': [1.0, 1.35, 1.5, 2.0], 'huber__alpha': [1e-5, 1e-4, 1e-3]}
gs = GridSearchCV(pipe, param_grid, cv=5, scoring='r2')`,
    related: ['Linear Regression', 'Ridge', 'TheilSen Regressor', 'RANSAC'],
    references: ['Huber, "Robust Estimation of a Location Parameter" (1964)', 'Scikit-learn: HuberRegressor docs'],
  },

  {
    id: 'quantile_regression', name: 'Quantile Regression', category: 'Regressão', family: 'Linear',
    description: 'Estima quantis condicionais da distribuição da variável resposta, em vez da média condicional. Fornece intervalos de predição e é robusto a outliers.',
    theory: 'Minimiza L_q(y, ŷ) = Σ ρ_q(yᵢ - ŷᵢ) onde ρ_q(u) = u·(q - 1{u<0}). Para q=0.5 (mediana): equivale a MAE. Para q=0.9: estima 90º percentil. Não assume homocedasticidade dos erros.',
    pros: ['Estima qualquer quantil — não apenas a média', 'Heteroscedasticidade nativa', 'Intervalos de predição sem suposição gaussiana', 'Robusto a outliers no quantil 0.5'],
    cons: ['Mais lento que OLS', 'Interpretação mais complexa', 'Múltiplos modelos para múltiplos quantis'],
    use_cases: ['Precificação com bandas (P10/P50/P90)', 'Intervalos de confiança sem assumir normalidade', 'Modelagem de risco — cauda da distribuição'],
    params: [
      { name: 'quantile', desc: 'Quantil alvo 0-1. Default=0.5 (mediana).' },
      { name: 'alpha', desc: 'Regularização L1. Default=1.0.' },
      { name: 'solver', desc: 'highs (recomendado), interior-point, revised simplex.' },
    ],
    complexity: 'Treino via LP O(n·p) | Inferência O(p)',
    when_to_use: 'Distribuição assimétrica dos erros, intervalos de predição, análise de cauda (risco).',
    avoid_when: 'Dados com distribuição simétrica e sem outliers — use OLS.',
    metrics: { Regressão: ['Pinball Loss', 'Coverage (P10-P90)', 'CRPS', 'MAE'] },
    implementation: `from sklearn.linear_model import QuantileRegressor
import numpy as np

# Treinar 3 quantis para intervalo de predição
models = {}
for q in [0.1, 0.5, 0.9]:
    qr = QuantileRegressor(quantile=q, alpha=0.01, solver='highs')
    qr.fit(X_train, y_train)
    models[q] = qr

# Predições com intervalo
p10 = models[0.1].predict(X_test)
p50 = models[0.5].predict(X_test)
p90 = models[0.9].predict(X_test)
coverage = np.mean((y_test >= p10) & (y_test <= p90))
print(f"Coverage P10-P90: {coverage:.1%}")`,
    tuning: `# Quantil é o principal hyperparâmetro — escolher conforme necessidade de negócio
# alpha controla regularização: valores pequenos (0.01-0.1) geralmente ideais`,
    related: ['Linear Regression', 'Gradient Boosting', 'HuberRegressor'],
    references: ['Koenker & Bassett, "Regression Quantiles" (Econometrica 1978)', 'Koenker, "Quantile Regression" (2005)'],
  },

  // ─── ENSEMBLE STACKING ─────────────────────────────────────────────────
  {
    id: 'stacking', name: 'Stacking (Model Stacking)', category: 'Classificação / Regressão', family: 'Ensemble — Stacking',
    description: 'Meta-ensemble que combina predições de múltiplos modelos base (nível 0) como features para um meta-modelo (nível 1). Geralmente supera modelos individuais.',
    theory: 'Nível 0: treinar k modelos base {f₁,...,fₖ} em fold-cross-validation para evitar leakage. Nível 1 (meta-modelo): treinar g(f₁(x),...,fₖ(x), x) → y usando predições OOF (out-of-fold) como features. O meta-modelo aprende como combinar as predições de forma ótima.',
    pros: ['Geralmente melhor que qualquer modelo individual', 'Combina modelos complementares', 'Meta-modelo aprende pesos ótimos adaptativos', 'Amplamente vencedor em competições Kaggle'],
    cons: ['Lento: treina k+1 modelos com k-fold CV', 'Risco de leakage se CV não for feito corretamente', 'Difícil de interpretar', 'Overhead de manutenção em produção'],
    use_cases: ['Competições ML (Kaggle)', 'Maximização de performance em produção', 'Combinação de modelos especializados'],
    params: [
      { name: 'estimators', desc: 'Lista de (nome, modelo) — modelos base do nível 0.' },
      { name: 'final_estimator', desc: 'Meta-modelo. Default: LogisticRegression. Ridge é comum para regressão.' },
      { name: 'cv', desc: 'Folds para OOF predictions. Default=5. Aumentar = mais dados para meta-modelo.' },
      { name: 'stack_method', desc: 'predict_proba (class), predict, decision_function, auto.' },
      { name: 'passthrough', desc: 'True para incluir features originais no meta-modelo.' },
    ],
    complexity: 'Treino O(k·cv·n·p) — muito mais lento | Inferência O(k) paralela',
    when_to_use: 'Quando modelos individuais chegaram ao limite. Competições, produção crítica.',
    avoid_when: 'Restrições de tempo/recursos, datasets pequenos (<1000), quando interpretabilidade é necessária.',
    metrics: { Classificação: ['AUC-ROC', 'F1', 'Accuracy'], Regressão: ['RMSE', 'R²', 'MAE'] },
    implementation: `from sklearn.ensemble import StackingClassifier, StackingRegressor
from sklearn.linear_model import LogisticRegression, RidgeCV
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

# Modelos base (nível 0)
estimators = [
    ('rf', RandomForestClassifier(n_estimators=300, n_jobs=-1, random_state=42)),
    ('gb', GradientBoostingClassifier(n_estimators=200, learning_rate=0.05, random_state=42)),
    ('svm', Pipeline([('sc', StandardScaler()), ('svc', SVC(probability=True, random_state=42))])),
]

# Meta-modelo (nível 1)
stack = StackingClassifier(
    estimators=estimators,
    final_estimator=LogisticRegression(C=1.0, max_iter=1000),
    cv=5,
    stack_method='predict_proba',
    passthrough=False,   # True para incluir features originais
    n_jobs=-1
)
stack.fit(X_train, y_train)`,
    tuning: `# Tunar os modelos base individualmente primeiro, depois ajustar o meta-modelo
# Meta-modelo com regularização: LogisticRegressionCV ou RidgeCV
from sklearn.linear_model import LogisticRegressionCV
stack = StackingClassifier(estimators=estimators,
    final_estimator=LogisticRegressionCV(cv=5, scoring='roc_auc'), cv=5)`,
    related: ['Blending', 'Voting Classifier', 'XGBoost', 'LightGBM'],
    references: ['Wolpert, "Stacked Generalization" (1992)', 'Breiman, "Stacked Regressions" (1996)'],
  },

  {
    id: 'voting', name: 'Voting Classifier / Regressor', category: 'Classificação / Regressão', family: 'Ensemble — Stacking',
    description: 'Combina predições de múltiplos modelos por votação (hard/soft) ou média. Mais simples que Stacking mas surpreendentemente eficaz.',
    theory: 'Hard voting: ŷ = mode(ŷ₁,...,ŷₖ). Soft voting: ŷ = argmax(Σwᵢ·P̂ᵢ(y=c|x)) — média ponderada de probabilidades. Soft voting geralmente superior pois usa informação de confiança. Para regressão: ŷ = Σwᵢ·ŷᵢ.',
    pros: ['Simples de implementar e entender', 'Reduz variância por agregação', 'Pesos ajustáveis por modelo', 'Rápido — sem meta-treino'],
    cons: ['Pesos manuais ou por CV simples', 'Não aprende combinação ótima como Stacking', 'Todos modelos contribuem igualmente sem tuning'],
    use_cases: ['Baseline de ensemble rápido', 'Quando modelos base são muito diferentes', 'Produção onde simplicidade importa'],
    params: [
      { name: 'estimators', desc: 'Lista de (nome, modelo) a combinar.' },
      { name: 'voting', desc: 'hard (classe majoritária) ou soft (probabilidades médias).' },
      { name: 'weights', desc: 'Pesos por modelo. None = uniforme.' },
    ],
    complexity: 'Treino O(k·treino_individual) | Inferência O(k) paralela',
    when_to_use: 'Combinação rápida de modelos complementares sem overhead de meta-treino.',
    avoid_when: 'Quando máxima performance é necessária — use Stacking.',
    metrics: { Classificação: ['AUC-ROC', 'F1', 'Accuracy'], Regressão: ['RMSE', 'R²'] },
    implementation: `from sklearn.ensemble import VotingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier

clf1 = LogisticRegression(C=1.0, max_iter=1000, random_state=42)
clf2 = RandomForestClassifier(n_estimators=300, random_state=42)
clf3 = GradientBoostingClassifier(n_estimators=200, learning_rate=0.05, random_state=42)

# Soft voting (recomendado)
model = VotingClassifier(
    estimators=[('lr', clf1), ('rf', clf2), ('gb', clf3)],
    voting='soft',
    weights=[1, 2, 2],   # RF e GB com peso maior
    n_jobs=-1
)
model.fit(X_train, y_train)`,
    tuning: `# Otimizar pesos via GridSearchCV
from sklearn.model_selection import GridSearchCV
param_grid = {'weights': [[1,1,1],[1,2,2],[1,1,2],[2,1,1],[1,3,3]]}
gs = GridSearchCV(model, param_grid, cv=5, scoring='roc_auc')`,
    related: ['Stacking', 'Bagging', 'Random Forest'],
    references: ['Dietterich, "Ensemble Methods in Machine Learning" (2000)'],
  },

  // ─── GAUSSIAN PROCESSES ────────────────────────────────────────────────
  {
    id: 'gaussian_process', name: 'Gaussian Process', category: 'Classificação / Regressão', family: 'Bayesian',
    description: 'Modelo não-paramétrico Bayesiano que define distribuição sobre funções. Fornece predições com incerteza calibrada. Estado da arte em otimização Bayesiana.',
    theory: 'f(x) ~ GP(μ(x), k(x,x\')). Posterior: p(f*|X,y,x*) = N(μ*, Σ*) onde μ* = kᵀ(K+σ²I)⁻¹y; Σ* = k** - kᵀ(K+σ²I)⁻¹k. Kernels: RBF k=σ²exp(-||x-x\'||²/2l²), Matérn, Periodic, Linear. Escalabilidade via sparse GP e inducing points.',
    pros: ['Incerteza calibrada por design', 'Priori informativa via escolha de kernel', 'Excelente para dados pequenos (<1000)', 'Não-paramétrico — flexível', 'Base do Bayesian Optimization'],
    cons: ['O(n³) para treino — inviável para n>10k', 'Escolha de kernel é crítica', 'Escalabilidade limitada', 'Alta dimensionalidade degrada'],
    use_cases: ['Otimização Bayesiana (tuning de hiperparâmetros)', 'Séries temporais pequenas', 'Modelagem de experimentos físicos', 'Quando incerteza da predição é essencial'],
    params: [
      { name: 'kernel', desc: 'RBF, Matérn, RationalQuadratic, WhiteKernel. Pode combinar com + e *.' },
      { name: 'alpha', desc: 'Ruído de observação. Default=1e-10. Aumentar para dados ruidosos.' },
      { name: 'normalize_y', desc: 'True para normalizar target. Recomendado.' },
      { name: 'n_restarts_optimizer', desc: 'Reinícios para otimização de hiperparâmetros do kernel. Default=0.' },
    ],
    complexity: 'Treino O(n³) | Inferência O(n²) | Memória O(n²)',
    when_to_use: 'Poucos dados (<1000), incerteza necessária, otimização Bayesiana, séries temporais suaves.',
    avoid_when: 'n>5000 sem aproximações sparse. Alta dimensionalidade. Quando velocidade é crítica.',
    metrics: { Regressão: ['RMSE', 'MAE', 'NLL (Negative Log-Likelihood)', 'Calibration'], Classificação: ['AUC-ROC', 'Log-Loss'] },
    implementation: `from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, ConstantKernel, WhiteKernel, Matern
from sklearn.preprocessing import StandardScaler
import numpy as np

# Kernel composto: sinal + ruído
kernel = ConstantKernel(1.0) * RBF(length_scale=1.0, length_scale_bounds=(1e-2, 1e3)) + WhiteKernel(noise_level=0.1)

gpr = GaussianProcessRegressor(
    kernel=kernel,
    alpha=1e-10,
    normalize_y=True,
    n_restarts_optimizer=10,
    random_state=42
)

X_sc = StandardScaler().fit_transform(X_train)
gpr.fit(X_sc, y_train)

# Predição com incerteza
y_pred, y_std = gpr.predict(X_test_sc, return_std=True)
print(f"Kernel otimizado: {gpr.kernel_}")

# Intervalo 95%
lower = y_pred - 1.96 * y_std
upper = y_pred + 1.96 * y_std`,
    tuning: `# O kernel e seus hyperparâmetros são otimizados automaticamente via MLE
# Para n>5000, usar GPyTorch com sparse approximations
# pip install gpytorch`,
    related: ['Bayesian Optimization', 'Kriging', 'Neural Process', 'SVR'],
    references: ['Rasmussen & Williams, "Gaussian Processes for Machine Learning" (2006)'],
  },

  // ─── BAYESIAN / PROBABILISTIC ──────────────────────────────────────────
  {
    id: 'bayesian_ridge', name: 'Bayesian Ridge Regression', category: 'Regressão', family: 'Bayesian',
    description: 'Ridge com inferência Bayesiana completa sobre os pesos. Otimiza automaticamente os hiperparâmetros α (regularização) e λ (precisão do ruído) por evidência marginal.',
    theory: 'Prior: p(w|α) = N(0, α⁻¹I). Likelihood: p(y|X,w,λ) = N(Xw, λ⁻¹I). Posterior: p(w|X,y,α,λ) = N(mₙ, Sₙ) onde mₙ = λSₙXᵀy e Sₙ = (αI + λXᵀX)⁻¹. Hyperparâmetros α,λ otimizados por maximização da evidência (type-II MLE = Empirical Bayes).',
    pros: ['Seleção automática de α sem cross-validation', 'Incerteza epistêmica nas predições', 'Regularização adaptativa por feature', 'Estável com multicolinearidade'],
    cons: ['Mais lento que Ridge padrão', 'Suposição Gaussiana nos erros', 'Menos interpretável'],
    use_cases: ['Quando Ridge precisa de tuning automático', 'Incerteza nas predições relevante', 'Dados médicos e científicos'],
    params: [
      { name: 'n_iter', desc: 'Iterações para estimar α e λ. Default=300.' },
      { name: 'alpha_1, alpha_2', desc: 'Hiperpriors sobre α (Gamma). Default=1e-6.' },
      { name: 'lambda_1, lambda_2', desc: 'Hiperpriors sobre λ (Gamma). Default=1e-6.' },
      { name: 'compute_score', desc: 'True para log-marginal-likelihood por iter.' },
    ],
    complexity: 'Treino O(n·p²·iter) | Inferência O(p) + incerteza O(p²)',
    when_to_use: 'Quando Ridge sem tuning manual é desejado + incerteza da predição.',
    avoid_when: 'Dados muito grandes — Ridge com RidgeCV é mais rápido.',
    metrics: { Regressão: ['RMSE', 'MAE', 'R²', 'NLL', 'Calibration'] },
    implementation: `from sklearn.linear_model import BayesianRidge
import numpy as np

model = BayesianRidge(n_iter=300, compute_score=True)
model.fit(X_train, y_train)

print(f"Alpha (precisão dos pesos): {model.alpha_:.4f}")
print(f"Lambda (precisão do ruído): {model.lambda_:.4f}")

# Predição com incerteza
y_pred, y_std = model.predict(X_test, return_std=True)
print(f"R²: {model.score(X_test, y_test):.4f}")`,
    tuning: 'Hiperparâmetros otimizados automaticamente. Ajustar apenas os hiperpriors alpha_1/alpha_2/lambda_1/lambda_2 para dados específicos.',
    related: ['Ridge', 'ARD Regression', 'Gaussian Process', 'Lasso Bayesiano'],
    references: ['Tipping, "Sparse Bayesian Learning and the RVM" (JMLR 2001)'],
  },

  // ─── NEURAL NETWORKS AVANÇADOS ─────────────────────────────────────────
  {
    id: 'tabnet', name: 'TabNet', category: 'Classificação / Regressão', family: 'Deep Learning',
    description: 'Rede neural para dados tabulares da Google com seleção sequencial de features via attention. Combina vantagens de árvores de decisão com deep learning. Interpretável.',
    theory: 'Usa feature selection via sparsemax attention em múltiplos steps: hₗ = f(M̃[l] ⊙ a[l-1]) onde M̃[l] é a máscara de attention aprendida. A máscara é esparsa (sparsemax vs softmax) — seleciona poucas features por step. Agrega steps: ŷ = Σₗ hₗ. Feature importância = Σₗ M̃[l]ᵢⱼ.',
    pros: ['Feature selection interpretável (masks de attention)', 'Supera XGBoost em alguns cenários', 'Sem pré-processamento obrigatório', 'Aprendizado few-shot possível'],
    cons: ['Mais lento para treinar que XGBoost/LightGBM', 'Muitos hiperparâmetros sensíveis', 'Requer GPU para competir em performance', 'Nem sempre supera boosting'],
    use_cases: ['Dados tabulares com features esparsas', 'Quando interpretabilidade de DL é necessária', 'Transfer learning em dados tabulares'],
    params: [
      { name: 'n_d, n_a', desc: 'Dimensão dos embedding (decision steps e attention). Default=8.' },
      { name: 'n_steps', desc: 'Número de steps sequenciais. Default=3. 3-10.' },
      { name: 'gamma', desc: 'Coeficiente para reutilização de features. Default=1.3.' },
      { name: 'n_independent, n_shared', desc: 'Camadas GLU independentes/compartilhadas.' },
      { name: 'momentum', desc: 'Para batch normalization. Default=0.02.' },
    ],
    complexity: 'Treino O(n·steps·d·iter) com GPU | Inferência O(steps·d)',
    when_to_use: 'Dados tabulares grandes onde DL interpretável é desejado, few-shot learning.',
    avoid_when: 'Datasets pequenos (<10k) — XGBoost supera. Sem GPU — LightGBM é mais rápido.',
    metrics: { Classificação: ['AUC-ROC', 'F1', 'Accuracy'], Regressão: ['RMSE', 'MAE', 'R²'] },
    implementation: `# pip install pytorch-tabnet
from pytorch_tabnet.tab_model import TabNetClassifier
import numpy as np

model = TabNetClassifier(
    n_d=32, n_a=32,
    n_steps=5,
    gamma=1.3,
    n_independent=2,
    n_shared=2,
    momentum=0.02,
    mask_type='sparsemax',  # ou 'entmax'
    optimizer_fn=torch.optim.Adam,
    optimizer_params=dict(lr=2e-2),
    scheduler_fn=torch.optim.lr_scheduler.StepLR,
    scheduler_params={'step_size': 50, 'gamma': 0.9},
    verbose=1,
    seed=42,
)

model.fit(
    X_train=X_train.values, y_train=y_train.values,
    eval_set=[(X_val.values, y_val.values)],
    eval_name=['val'],
    eval_metric=['auc'],
    max_epochs=200,
    patience=20,
    batch_size=1024,
)

# Feature importance via masks
importances = model.feature_importances_`,
    tuning: `# Principais: n_d, n_a (tamanho embedding), n_steps, gamma, learning_rate
# Usar optuna para tuning automático`,
    related: ['Neural Network MLP', 'XGBoost', 'LightGBM', 'NODE'],
    references: ['Arik & Pfister, "TabNet: Attentive Interpretable Tabular Learning" (AAAI 2021)'],
  },

  {
    id: 'tsne', name: 't-SNE', category: 'Redução de Dimensionalidade', family: 'Não-Linear',
    description: 't-Distributed Stochastic Neighbor Embedding. Visualização não-linear que preserva estrutura local (vizinhanças) em 2D/3D. Padrão ouro para visualização de embeddings.',
    theory: 'Alta dim: pⱼ|ᵢ = exp(-||xᵢ-xⱼ||²/2σᵢ²) / Σₖ exp(-||xᵢ-xₖ||²/2σᵢ²). Baixa dim: qᵢⱼ = (1+||yᵢ-yⱼ||²)⁻¹ / Σₖₗ(1+||yₖ-yₗ||²)⁻¹ (t-Student 1 grau). Minimiza KL(P||Q) via gradient descent. t-Student evita crowding problem do SNE original.',
    pros: ['Excelente visualização de clusters', 'Revela subgrupos não visíveis', 'Preserva vizinhanças locais muito bem'],
    cons: ['O(n²) — impraticável para n>10k sem aproximações', 'Resultados não-determinísticos (random_state)', 'Não preserva distâncias globais', 'Não pode transformar novos pontos', 'Apenas 2-3D'],
    use_cases: ['Visualização de word embeddings/BERT', 'scRNA-seq em bioinformática', 'Exploração de clusters em alta dimensão', 'Visualização de features de CNNs'],
    params: [
      { name: 'perplexity', desc: 'Vizinhos efetivos. 5-50. Típico: 30. Para clusters pequenos, <10.' },
      { name: 'n_components', desc: '2 (visualização) ou 3.' },
      { name: 'learning_rate', desc: 'auto (n/early_exaggeration) ou float. Típico 200.' },
      { name: 'n_iter', desc: 'Iterações. Mínimo 250. Default=1000. Mais=melhor.' },
      { name: 'metric', desc: 'euclidean, cosine (para embeddings).' },
      { name: 'init', desc: "pca (padrão, mais estável) ou random." },
    ],
    complexity: 'O(n²·iter) — use openTSNE ou cuML para n>10k',
    when_to_use: 'Visualização exploratória de alta dimensão, verificar estrutura de clusters.',
    avoid_when: 'Inferência em produção, novos pontos, n>10k sem GPU, quando UMAP é mais apropriado.',
    metrics: { Reducao: ['KL Divergence final', 'Trustworthiness', 'Continuity', 'Qualidade visual'] },
    implementation: `from sklearn.manifold import TSNE
from sklearn.preprocessing import StandardScaler
import matplotlib.pyplot as plt

# Pré-reduzir com PCA para n>5k (recomendado)
from sklearn.decomposition import PCA
X_pca = PCA(n_components=50).fit_transform(StandardScaler().fit_transform(X))

tsne = TSNE(n_components=2, perplexity=30, learning_rate='auto', n_iter=1000, init='pca', metric='euclidean', random_state=42)
X_2d = tsne.fit_transform(X_pca)
print(f"KL Divergence: {tsne.kl_divergence_:.4f}")`,
    tuning: 'Testar perplexity=[5,30,50]. Para dados grandes, usar openTSNE ou UMAP (mais rápido).',
    related: ['UMAP', 'PCA', 'Kernel PCA', 'PHATE'],
    references: ['van der Maaten & Hinton, "Visualizing Data using t-SNE" (JMLR 2008)'],
  },

  // ─── MAIS CLUSTERING ──────────────────────────────────────────────────
  {
    id: 'agglomerative', name: 'Agglomerative Clustering (Hierárquico)', category: 'Clustering', family: 'Hierárquico',
    description: 'Clustering hierárquico bottom-up: começa com cada ponto como cluster e vai mesclando iterativamente os pares mais próximos. Produz dendrograma que permite escolha de k a posteriori.',
    theory: 'Começa com n clusters singleton. A cada passo: mescla os dois clusters com menor linkage distance. Linkage: single (min), complete (max), average (UPGMA), ward (minimiza variância intra-cluster — mais compacto). O resultado é um dendrograma: árvore hierárquica de todas as fusões.',
    pros: ['Dendrograma permite visualizar hierarquia completa', 'Não precisa especificar k a priori', 'Ward linkage produz clusters compactos e balanceados', 'Clusters de formas não-esféricas (single linkage)'],
    cons: ['O(n² log n) — inviável para n>10k', 'Não pode revisar fusões passadas (greedy)', 'Sensível a outliers (single/complete linkage)', 'Alta memória para datasets grandes'],
    use_cases: ['Análise de genes (bioinformática)', 'Segmentação hierárquica de clientes', 'Análise de documentos', 'Quando hierarquia de clusters é informativa'],
    params: [
      { name: 'n_clusters', desc: 'Número de clusters. Pode visualizar dendrograma primeiro.' },
      { name: 'linkage', desc: 'ward (compacto), complete (diâmetro), average (UPGMA), single (corrente).' },
      { name: 'affinity/metric', desc: 'euclidean (ward), cosine, manhattan, precomputed.' },
      { name: 'distance_threshold', desc: 'Cortar dendrograma nesta distância em vez de n_clusters.' },
    ],
    complexity: 'Treino O(n²·log n) | Sem inferência (offline)',
    when_to_use: 'Quando hierarquia é interessante, n<10k, análise exploratória de clustering.',
    avoid_when: 'n>10k — use K-Means ou MiniBatchKMeans. Quando k não pode ser escolhido visualmente.',
    metrics: { Clustering: ['Silhouette', 'Dendrograma (visual)', 'Cophenetic correlation', 'Davies-Bouldin'] },
    implementation: `from sklearn.cluster import AgglomerativeClustering
from scipy.cluster.hierarchy import dendrogram, linkage
import matplotlib.pyplot as plt

# 1. Visualizar dendrograma para escolher k
Z = linkage(X_scaled, method='ward')
plt.figure(figsize=(12, 5))
dendrogram(Z, truncate_mode='lastp', p=20)
plt.axhline(y=10, color='r', linestyle='--')  # corte para n clusters
plt.title('Dendrograma'); plt.show()

# 2. Aplicar clustering
model = AgglomerativeClustering(n_clusters=4, linkage='ward')
labels = model.fit_predict(X_scaled)`,
    tuning: `# Principal: escolher k via dendrograma
# Ward linkage + euclidean: mais robusto para dados contínuos
# Average linkage + cosine: para dados de texto (similaridade)`,
    related: ['K-Means', 'DBSCAN', 'Spectral Clustering'],
    references: ['Ward, "Hierarchical Grouping to Optimize an Objective Function" (JASA 1963)'],
  },

  {
    id: 'gmm', name: 'Gaussian Mixture Models (GMM)', category: 'Clustering', family: 'Probabilístico',
    description: 'Modelo probabilístico que assume os dados como mistura de K distribuições Gaussianas. Soft clustering: cada ponto tem probabilidade de pertencer a cada cluster.',
    theory: 'p(x) = Σₖ πₖ N(x|μₖ, Σₖ). Aprendido via EM: E-step calcula responsabilidades rᵢₖ = P(z=k|xᵢ); M-step atualiza πₖ, μₖ, Σₖ. Convergência garantida localmente. BIC/AIC para seleção de K. Variedades de covariância: full, tied, diagonal, spherical.',
    pros: ['Soft clustering — probabilidades de pertencimento', 'Modela clusters elípticos (não apenas esféricos)', 'BIC/AIC para seleção automática de K', 'Densidades bem calibradas'],
    cons: ['Convergência para mínimo local (múltiplas inicializações)', 'Assume forma Gaussiana dos clusters', 'Sensível à inicialização sem K-Means++', 'Singular covariance em dados de alta dimensão'],
    use_cases: ['Segmentação de imagens (pixels por cor)', 'Modelagem de densidades', 'Detecção de anomalias (baixa densidade)', 'Soft clustering para análise de transição'],
    params: [
      { name: 'n_components', desc: 'Número de Gaussianas. Selecionar via BIC/AIC.' },
      { name: 'covariance_type', desc: 'full (mais flexível), tied, diag (mais rápido), spherical.' },
      { name: 'max_iter', desc: 'Iterações EM. Default=100.' },
      { name: 'n_init', desc: 'Inicializações. Default=1. Aumentar para estabilidade.' },
    ],
    complexity: 'Treino O(n·k·p²·iter) | Inferência O(k·p²)',
    when_to_use: 'Clusters elípticos, soft membership, estimativa de densidade, seleção automática de K via BIC.',
    avoid_when: 'Clusters não-Gaussianos — use DBSCAN. Alta dimensão (p>50) sem PCA prévia.',
    metrics: { Clustering: ['BIC (lower better)', 'AIC (lower better)', 'Silhouette', 'Log-Likelihood'] },
    implementation: `from sklearn.mixture import GaussianMixture
import numpy as np
import matplotlib.pyplot as plt

# Selecionar K via BIC
bic_scores = []
for k in range(1, 15):
    gm = GaussianMixture(n_components=k, covariance_type='full', n_init=5, random_state=42)
    gm.fit(X_scaled)
    bic_scores.append(gm.bic(X_scaled))

k_opt = np.argmin(bic_scores) + 1
print(f"K ótimo via BIC: {k_opt}")

# Modelo final
model = GaussianMixture(n_components=k_opt, covariance_type='full', n_init=10, random_state=42)
labels = model.fit_predict(X_scaled)
probs = model.predict_proba(X_scaled)  # soft membership`,
    tuning: `# BIC: melhor para seleção de modelo (penaliza complexidade mais forte)
# AIC: preferir mais componentes
# covariance_type: começar com 'full', simplificar se overfitting`,
    related: ['K-Means', 'DBSCAN', 'Variational Autoencoder', 'BayesianGaussianMixture'],
    references: ['Dempster et al., "Maximum Likelihood from Incomplete Data via EM" (1977)'],
  },

  // ─── ANOMALY DETECTION ADICIONAL ─────────────────────────────────────
  {
    id: 'lof', name: 'Local Outlier Factor (LOF)', category: 'Anomaly Detection', family: 'Instance-based',
    description: 'Detecta anomalias comparando a densidade local de cada ponto com seus K vizinhos. Eficaz para anomalias em regiões de densidades variáveis.',
    theory: 'LOF(k, o) = (Σ o\'∈N_k(o) lrd_k(o\')/lrd_k(o)) / |N_k(o)|. lrd_k(o) = 1 / (Σ reach_dist_k(o, o\')/|N_k(o)|). reach_dist_k(o, o\') = max(k-dist(o\'), dist(o, o\')). LOF ≈ 1: normal; LOF >> 1: outlier. Detecta outliers locais onde densidade é baixa relativa aos vizinhos.',
    pros: ['Detecta anomalias locais (não apenas globais)', 'Funciona com clusters de densidades diferentes', 'Não assume forma dos clusters'],
    cons: ['O(n²) sem índices | Sensível ao parâmetro k', 'Não escalável para n>100k', 'Score não é probabilidade', 'Dimensionalidade alta prejudica distâncias'],
    use_cases: ['Fraude em subpopulações específicas', 'Anomalias geoespaciais locais', 'Controle de qualidade com múltiplas densidades'],
    params: [
      { name: 'n_neighbors (k)', desc: 'Vizinhos para estimativa de densidade. 10-50 típico.' },
      { name: 'contamination', desc: 'Fração esperada de anomalias para threshold.' },
      { name: 'metric', desc: 'euclidean, manhattan, cosine.' },
      { name: 'novelty', desc: 'True para predição em novos pontos (fit separado).' },
    ],
    complexity: 'Treino O(n²) ou O(n·log n) com índice | Inferência O(k·n)',
    when_to_use: 'Anomalias em contexto local, clusters com densidades variáveis, n<50k.',
    avoid_when: 'n>100k — use Isolation Forest. Anomalias globais simples — Isolation Forest é mais eficiente.',
    metrics: { Anomaly: ['AUC-ROC (se labels)', 'Average Precision', 'LOF Score distribuição'] },
    implementation: `from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import StandardScaler

X_scaled = StandardScaler().fit_transform(X)

# Detecção (offline — fit_predict)
lof = LocalOutlierFactor(n_neighbors=20, contamination=0.05, metric='euclidean', n_jobs=-1)
labels = lof.fit_predict(X_scaled)   # -1=outlier, 1=normal
scores = -lof.negative_outlier_factor_  # maior = mais outlier

n_outliers = (labels == -1).sum()
print(f"Outliers detectados: {n_outliers} ({n_outliers/len(labels):.1%})")

# Novelty detection (novos pontos)
lof_nov = LocalOutlierFactor(novelty=True, n_neighbors=20)
lof_nov.fit(X_scaled)
# lof_nov.predict(X_new)`,
    tuning: `# k muito pequeno: instável; k muito grande: perde localidade
# Regra geral: k = max(10, sqrt(n))
# contamination: calibrar com a taxa real de anomalias no domínio`,
    related: ['Isolation Forest', 'One-Class SVM', 'HBOS', 'DBSCAN'],
    references: ['Breunig et al., "LOF: Identifying Density-Based Local Outliers" (SIGMOD 2000)'],
  },

  {
    id: 'one_class_svm', name: 'One-Class SVM', category: 'Anomaly Detection', family: 'Kernel Methods',
    description: 'SVM treinado apenas em dados normais. Aprende a fronteira de decisão que encapsula os inliers. Pontos fora = anomalias. Variante SVDD usa hiperesfera.',
    theory: 'Minimiza ½||w||² + (1/νn)Σξᵢ - ρ s.a. wᵀΦ(xᵢ) ≥ ρ - ξᵢ. ν controla fração de outliers (upper bound) e support vectors (lower bound). Com kernel RBF: aprende fronteira não-linear no espaço de features. Score = wᵀΦ(x) - ρ.',
    pros: ['Funciona bem em alta dimensionalidade', 'Kernel trick para fronteiras não-lineares', 'ν controla trade-off outlier/SV'],
    cons: ['O(n²) — lento para n>10k', 'Sensível ao scaling', 'Muitos hiperparâmetros (C, gamma, nu)', 'Menos robusto que Isolation Forest em geral'],
    use_cases: ['Detecção de novidades (novelty detection)', 'Alta dimensão com poucas amostras normais', 'Quando fronteira precisa ser non-linear'],
    params: [
      { name: 'nu', desc: 'Upper bound na fração de outliers. 0-1. Default=0.5.' },
      { name: 'kernel', desc: 'rbf (padrão), linear, poly, sigmoid.' },
      { name: 'gamma', desc: 'Para RBF. scale (padrão), auto, float.' },
    ],
    complexity: 'Treino O(n²) | Inferência O(n_sv)',
    when_to_use: 'Novelty detection em alta dimensão, quando Isolation Forest é insuficiente.',
    avoid_when: 'n>10k — use Isolation Forest. Baixa dimensão com muitos outliers — LOF.',
    metrics: { Anomaly: ['AUC-ROC', 'F1 (classe anomalia)', 'Precision@k'] },
    implementation: `from sklearn.svm import OneClassSVM
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

pipe = Pipeline([
    ('scaler', StandardScaler()),
    ('svm', OneClassSVM(nu=0.05, kernel='rbf', gamma='scale'))
])
pipe.fit(X_normal)  # Treinar APENAS em dados normais

# Detecção
labels = pipe.predict(X_test)   # -1=anomalia, 1=normal
scores = pipe.decision_function(X_test)  # score contínuo`,
    tuning: `from sklearn.model_selection import GridSearchCV
param_grid = {'svm__nu': [0.01, 0.05, 0.1, 0.2], 'svm__gamma': ['scale', 'auto', 0.001, 0.01]}`,
    related: ['Isolation Forest', 'LOF', 'SVDD', 'Autoencoder'],
    references: ['Schölkopf et al., "Estimating the support of a high-dimensional distribution" (2001)'],
  },

  // ─── REDUÇÃO DE DIMENSIONALIDADE EXTRA ────────────────────────────────
  {
    id: 'umap', name: 'UMAP', category: 'Redução de Dimensionalidade', family: 'Não-Linear',
    description: 'Uniform Manifold Approximation and Projection. Redução não-linear baseada em teoria de variedades topológicas. Mais rápido que t-SNE e preserva estrutura global melhor.',
    theory: 'Constrói grafo k-NN com pesos fuzzy: wᵢⱼ = exp(-(d(xᵢ,xⱼ) - ρᵢ)/σᵢ). Minimiza cross-entropy entre grafos de alta e baixa dimensão: C = Σwᵢⱼlog(wᵢⱼ/vᵢⱼ) + (1-wᵢⱼ)log((1-wᵢⱼ)/(1-vᵢⱼ)) via SGD. vᵢⱼ = 1/(1+a||yᵢ-yⱼ||^(2b)). Fundamentação: homologia simpliclal + Riemannian geometry.',
    pros: ['3-10x mais rápido que t-SNE', 'Preserva estrutura global além da local', 'Transforma novos pontos (transform())', 'Suporta n_components > 3', 'Métricas customizadas'],
    cons: ['Resultados podem variar com random_state', 'Parâmetros afetam muito o resultado', 'Menos estável que t-SNE em alguns casos', 'Requer instalação separada'],
    use_cases: ['Visualização de embeddings (NLP, CV)', 'Redução para ML supervisionado', 'scRNA-seq bioinformática', 'Feature engineering não-linear'],
    params: [
      { name: 'n_neighbors', desc: 'Vizinhos para manifold local. 2-200. Baixo=local, alto=global. Default=15.' },
      { name: 'min_dist', desc: 'Distância mínima entre pontos no embedding. 0-1. Default=0.1.' },
      { name: 'n_components', desc: 'Dimensões do embedding. 2 (visual) ou mais para ML.' },
      { name: 'metric', desc: 'euclidean, cosine, manhattan, hamming, etc.' },
      { name: 'spread', desc: 'Spread do embedding. Padrão=1.0.' },
    ],
    complexity: 'O(n·log n·k) treino — muito mais rápido que t-SNE | Inferência: O(k·n_train)',
    when_to_use: 'Visualização (alternativa ao t-SNE), feature extraction não-linear, datasets grandes (n>10k).',
    avoid_when: 'Quando reprodutibilidade exata é crítica (resultados variam). Use PCA para pipeline determinístico.',
    metrics: { Reducao: ['Trustworthiness', 'Continuity', 'LCMC', 'Qualidade visual'] },
    implementation: `# pip install umap-learn
import umap
from sklearn.preprocessing import StandardScaler
import matplotlib.pyplot as plt

# Pré-escalar os dados
X_scaled = StandardScaler().fit_transform(X)

# Visualização 2D
reducer = umap.UMAP(
    n_neighbors=15,
    min_dist=0.1,
    n_components=2,
    metric='euclidean',
    random_state=42
)
X_2d = reducer.fit_transform(X_scaled)

# Pode transformar novos pontos
X_new_2d = reducer.transform(X_new_scaled)

# Para feature extraction (mais dimensões)
reducer_ml = umap.UMAP(n_components=20, n_neighbors=30, min_dist=0.0, random_state=42)
X_features = reducer_ml.fit_transform(X_scaled)`,
    tuning: `# n_neighbors: baixo = detalhes locais; alto = estrutura global
# min_dist: baixo = clusters compactos; alto = preserva estrutura contínua
# Combinar com downstream classifier: usar n_components > 2`,
    related: ['t-SNE', 'PCA', 'Trimap', 'PaCMAP'],
    references: ['McInnes et al., "UMAP: Uniform Manifold Approximation and Projection" (2018)'],
  },

  {
    id: 'lda_dim', name: 'LDA — Linear Discriminant Analysis', category: 'Redução de Dimensionalidade', family: 'Linear',
    description: 'Redução linear supervisionada que maximiza a separabilidade entre classes. Projeta dados em k-1 dimensões (k=nº classes) maximizando a razão entre variância inter-classe e intra-classe.',
    theory: 'Maximiza J(W) = |WᵀS_bW| / |WᵀS_wW| onde S_b = Σₖnₖ(μₖ-μ)(μₖ-μ)ᵀ (scatter inter-classe) e S_w = Σₖ Σᵢ∈Cₖ (xᵢ-μₖ)(xᵢ-μₖ)ᵀ (scatter intra-classe). Solução: autovetores de S_w⁻¹S_b.',
    pros: ['Maximiza separabilidade entre classes', 'Dimensões resultantes no máximo k-1 (k=nº classes)', 'Pode ser usado como classificador também', 'Mais interpretável que PCA para classificação'],
    cons: ['Assume distribuição Gaussiana e homocedasticidade', 'Limitado a k-1 componentes', 'Colapsa intra-classe (quadratic LDA para variâncias distintas)', 'Scaling obrigatório'],
    use_cases: ['Pré-processamento para classificação (especialmente com muitas classes)', 'Visualização de dados rotulados', 'Reconhecimento facial (Fisherfaces)'],
    params: [
      { name: 'n_components', desc: 'Min(n_classes-1, n_features). None = máximo disponível.' },
      { name: 'solver', desc: 'svd (padrão, não calcula S_w), lsqr, eigen.' },
      { name: 'shrinkage', desc: 'auto (Ledoit-Wolf) para estimativa de covariância em p>>n.' },
    ],
    complexity: 'Treino O(n·p²) | Inferência O(p·k)',
    when_to_use: 'Pré-processamento supervisionado para classificação, quando PCA ignora informação de classe.',
    avoid_when: 'Dados não-Gaussianos ou heterocedásticos — use QDA. Mais de 50 classes (k-1 componentes limitam).',
    metrics: { Reducao: ['Variância explicada (%)', 'Between/Within-class scatter ratio', 'Classificação acurácia pós-LDA'] },
    implementation: `from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

# Como redutor de dimensionalidade + classificador
lda = LinearDiscriminantAnalysis(n_components=None, solver='svd')
X_lda = lda.fit_transform(X_train, y_train)

# Variância explicada
print(f"Razão de variância: {lda.explained_variance_ratio_}")

# Em pipeline com classifier
from sklearn.ensemble import RandomForestClassifier
pipe = Pipeline([
    ('scaler', StandardScaler()),
    ('lda', LinearDiscriminantAnalysis(n_components=5)),  # para 6+ classes
    ('clf', RandomForestClassifier(n_estimators=200))
])`,
    tuning: `# n_components: geralmente usar o máximo (k-1) ou selecionar por variância acumulada
# shrinkage='auto': usar quando n_features > n_samples`,
    related: ['PCA', 'QDA', 'Kernel LDA', 'UMAP com supervisão'],
    references: ['Fisher, "The Use of Multiple Measurements in Taxonomic Problems" (1936)', 'Fukunaga, "Introduction to Statistical Pattern Recognition" (1990)'],
  },
];

export const CATEGORIES = ['Todos', 'Classificação', 'Regressão', 'Clustering', 'Anomaly Detection', 'Redução de Dimensionalidade'];
export const FAMILIES = [
  'Todas as Famílias', 'Linear', 'Linear Regularizado', 'Bayesian',
  'Ensemble — Bagging', 'Ensemble — Boosting', 'Ensemble — Stacking',
  'Tree-based', 'Kernel Methods', 'Probabilístico',
  'Deep Learning', 'Instance-based', 'Particionamento',
  'Hierárquico', 'Baseado em Densidade', 'Ensemble', 'Não-Linear',
];