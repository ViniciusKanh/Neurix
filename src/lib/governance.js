/**
 * Model governance helpers — build a Model Card and export a portable
 * model bundle (metadata + scaler + metrics) as JSON. No AI.
 */

// Composes a structured Model Card from a project + a completed analysis.
export function buildModelCard(project, analysis, extra = {}) {
  const res = analysis?.results || {};
  const cfg = analysis?.config || {};
  const type = analysis?.type;
  const metrics = res.metrics || {};
  const isClass = type === 'classification';
  const perf = isClass
    ? [
        ['Acurácia', pct(metrics.accuracy)],
        ['Precisão', pct(metrics.precision)],
        ['Recall', pct(metrics.recall)],
        ['F1-Score', pct(metrics.f1_score)],
      ]
    : [
        ['R²', pct(metrics.r2_score)],
        ['RMSE', fmt(metrics.rmse)],
        ['MAE', fmt(metrics.mae)],
        ['MAPE', metrics.mape != null ? `${fmt(metrics.mape)}%` : '—'],
      ];

  const limitations = [];
  if ((res.trained_on || 0) < 200) limitations.push('Base pequena (< 200 linhas): métricas podem variar bastante.');
  if (isClass && res.class_labels && res.class_labels.length > 6) limitations.push('Muitas classes: avalie desempenho por classe individualmente.');
  if (extra.balance?.imbalanced) limitations.push(`Classes desbalanceadas (razão ${extra.balance.imbalance_ratio}×): prefira F1/recall a acurácia.`);
  if (isClass && metrics.accuracy != null && metrics.accuracy < 0.7) limitations.push('Acurácia moderada: o modelo pode não estar pronto para produção.');
  if (!isClass && metrics.r2_score != null && metrics.r2_score < 0.5) limitations.push('R² baixo: capacidade preditiva limitada.');
  if (!limitations.length) limitations.push('Sem limitações críticas detectadas — ainda assim, monitore drift em produção.');

  return {
    model_name: res.best_model || cfg.model || 'Modelo',
    project: project?.name || '—',
    task: isClass ? 'Classificação' : type === 'regression' ? 'Regressão' : type,
    target: cfg.target_column || '—',
    features: cfg.feature_columns || project?.column_info?.map((c) => c.name).filter((n) => n !== cfg.target_column) || [],
    classes: res.class_labels || null,
    trained_on: res.trained_on || null,
    test_size: res.test_size || null,
    validation: extra.cv && !extra.cv.error
      ? { method: `${extra.cv.k}-fold CV`, metric: extra.cv.metric, mean: extra.cv.mean, std: extra.cv.std }
      : { method: 'Holdout', note: 'Split treino/teste único.' },
    performance: perf,
    feature_importance: (extra.importance?.importances || res.feature_importance || []).slice(0, 10),
    balance: extra.balance && !extra.balance.error ? extra.balance : null,
    limitations,
    generated_at: new Date().toISOString(),
    created_by: analysis?.created_by || project?.created_by || null,
  };
}

// Portable model bundle for reuse/documentation (JSON download).
export function buildModelBundle(project, analysis, card) {
  const cfg = analysis?.config || {};
  return {
    format: 'neurix-model-bundle',
    version: 1,
    exported_at: new Date().toISOString(),
    project: { id: project?.id, name: project?.name, rows: project?.row_count || null },
    model: {
      name: analysis?.results?.best_model || cfg.model,
      task: analysis?.type,
      target: cfg.target_column,
      classes: analysis?.results?.class_labels || null,
      feature_columns: cfg.feature_columns || null,
      hyperparameters: cfg.hyperparameters || null,
    },
    metrics: analysis?.results?.metrics || null,
    model_card: card || null,
    note: 'Bundle de documentação/scoring. Reimporte o dataset no ML Studio para re-treinar de forma idêntica (motor determinístico com seed fixa).',
  };
}

// Maps a Neurix model name to the equivalent scikit-learn estimator.
const SKLEARN = {
  classification: {
    'Regressão Logística': ['LogisticRegression', 'from sklearn.linear_model import LogisticRegression', 'LogisticRegression(max_iter=1000)'],
    'Árvore de Decisão': ['DecisionTreeClassifier', 'from sklearn.tree import DecisionTreeClassifier', 'DecisionTreeClassifier(max_depth=10)'],
    'Random Forest': ['RandomForestClassifier', 'from sklearn.ensemble import RandomForestClassifier', 'RandomForestClassifier(n_estimators=200)'],
    'Gradient Boosting': ['GradientBoostingClassifier', 'from sklearn.ensemble import GradientBoostingClassifier', 'GradientBoostingClassifier()'],
    'SVM': ['SVC', 'from sklearn.svm import SVC', 'SVC(kernel="linear", probability=True)'],
    'KNN': ['KNeighborsClassifier', 'from sklearn.neighbors import KNeighborsClassifier', 'KNeighborsClassifier(n_neighbors=5)'],
    'Naive Bayes': ['GaussianNB', 'from sklearn.naive_bayes import GaussianNB', 'GaussianNB()'],
  },
  regression: {
    'Regressão Linear': ['LinearRegression', 'from sklearn.linear_model import LinearRegression', 'LinearRegression()'],
    'Ridge': ['Ridge', 'from sklearn.linear_model import Ridge', 'Ridge(alpha=1.0)'],
    'Lasso': ['Lasso', 'from sklearn.linear_model import Lasso', 'Lasso(alpha=0.1)'],
    'Árvore de Decisão': ['DecisionTreeRegressor', 'from sklearn.tree import DecisionTreeRegressor', 'DecisionTreeRegressor(max_depth=10)'],
    'Random Forest': ['RandomForestRegressor', 'from sklearn.ensemble import RandomForestRegressor', 'RandomForestRegressor(n_estimators=200)'],
    'Gradient Boosting': ['GradientBoostingRegressor', 'from sklearn.ensemble import GradientBoostingRegressor', 'GradientBoostingRegressor()'],
    'KNN': ['KNeighborsRegressor', 'from sklearn.neighbors import KNeighborsRegressor', 'KNeighborsRegressor(n_neighbors=5)'],
  },
};

// Generates a runnable Python (pandas + scikit-learn) script reproducing the pipeline.
export function exportSklearn(project, analysis) {
  const cfg = analysis?.config || {};
  const task = analysis?.type === 'regression' ? 'regression' : 'classification';
  const target = cfg.target_column || 'target';
  const modelName = analysis?.results?.best_model || cfg.model || (task === 'regression' ? 'Random Forest' : 'Regressão Logística');
  const table = SKLEARN[task];
  const [cls, imp, ctor] = table[modelName] || table[Object.keys(table)[0]];
  const isClass = task === 'classification';
  const metricsImp = isClass
    ? 'from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix'
    : 'from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error';
  const fileName = (project?.dataset_filename || 'dataset.csv');

  return `# ============================================================
# Neurix — pipeline exportado para Python (pandas + scikit-learn)
# Projeto: ${project?.name || '-'} | Tarefa: ${isClass ? 'Classificação' : 'Regressão'}
# Modelo: ${modelName}  ->  sklearn.${cls}
# Gerado em ${new Date().toISOString()}
# ============================================================
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
${imp}
${metricsImp}

# 1) Carregue seu dataset (mesmo arquivo enviado ao Neurix)
df = pd.read_csv("${fileName}")

TARGET = "${target}"
X = df.drop(columns=[TARGET])
y = df[TARGET]

# 2) Pré-processamento: padroniza numéricas + one-hot nas categóricas
num_cols = X.select_dtypes(include=[np.number]).columns.tolist()
cat_cols = [c for c in X.columns if c not in num_cols]
pre = ColumnTransformer([
    ("num", StandardScaler(), num_cols),
    ("cat", OneHotEncoder(handle_unknown="ignore"), cat_cols),
])

# 3) Modelo equivalente ao escolhido no Neurix
model = ${ctor}
pipe = Pipeline([("pre", pre), ("model", model)])

# 4) Split treino/teste (80/20) e treino
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42${isClass ? ', stratify=y' : ''})
pipe.fit(X_train, y_train)
pred = pipe.predict(X_test)

# 5) Métricas
${isClass
      ? `print("Acurácia :", round(accuracy_score(y_test, pred), 4))
print("Precisão :", round(precision_score(y_test, pred, average="macro", zero_division=0), 4))
print("Recall   :", round(recall_score(y_test, pred, average="macro", zero_division=0), 4))
print("F1-Score :", round(f1_score(y_test, pred, average="macro", zero_division=0), 4))
print("Matriz de confusão:\\n", confusion_matrix(y_test, pred))`
      : `print("R²   :", round(r2_score(y_test, pred), 4))
print("RMSE :", round(mean_squared_error(y_test, pred, squared=False), 4))
print("MAE  :", round(mean_absolute_error(y_test, pred), 4))`}

# 6) Validação cruzada 5-fold
scores = cross_val_score(pipe, X, y, cv=5, scoring="${isClass ? 'f1_macro' : 'r2'}")
print("CV ${isClass ? 'F1' : 'R²'} (5-fold): %.4f +/- %.4f" % (scores.mean(), scores.std()))
`;
}

export function downloadText(text, filename, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);
const fmt = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-BR'));
