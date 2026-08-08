// Canonical list of protectable pages / resources (frontend copy).
// Keep in sync with api/_lib/pages.js
export const PAGES = [
  { key: 'dashboard', label: 'Painel', path: '/' },
  { key: 'analytics', label: 'Analytics Dashboard', path: '/analytics' },
  { key: 'projects', label: 'Projetos', path: '/projects' },
  { key: 'explorer', label: 'Explorador de Dados', path: '/explorer' },
  { key: 'data-profiling', label: 'Perfilamento de Dados', path: '/data-profiling' },
  { key: 'dataset-export', label: 'Exportar Dataset', path: '/dataset-export' },
  { key: 'ml-studio', label: 'ML Studio', path: '/ml-studio' },
  { key: 'model-lab', label: 'Laboratório do Modelo', path: '/model-lab' },
  { key: 'advanced-ml', label: 'Testes ML Avançados', path: '/advanced-ml' },
  { key: 'automl', label: 'AutoML Pipeline', path: '/automl' },
  { key: 'model-comparison', label: 'Comparação de Modelos', path: '/model-comparison' },
  { key: 'hyperparam-tuning', label: 'Hyperparameter Tuning', path: '/hyperparam-tuning' },
  { key: 'association-rules', label: 'Regras de Associação', path: '/association-rules' },
  { key: 'time-series', label: 'Séries Temporais', path: '/time-series' },
  { key: 'inference', label: 'Inferência & Retreino', path: '/inference' },
  { key: 'batch-score', label: 'Scoring em Lote', path: '/batch-score' },
  { key: 'deploy', label: 'Deploy', path: '/deploy' },
  { key: 'monitoring', label: 'Monitoramento', path: '/monitoring' },
  { key: 'pipeline-history', label: 'Histórico de Runs', path: '/pipeline-history' },
  { key: 'champion-challenger', label: 'Champion vs Challenger', path: '/champion-challenger' },
  { key: 'ab-test', label: 'Testes A/B', path: '/ab-test' },
  { key: 'reports', label: 'Relatórios', path: '/reports' },
  { key: 'pdf-export', label: 'Exportar PDF', path: '/pdf-export' },
  { key: 'model-docs', label: 'Docs de Modelos', path: '/model-docs' },
  { key: 'visualization-3d', label: 'Visualização 3D', path: '/visualization-3d' },
];

export const PAGE_KEYS = PAGES.map((p) => p.key);

// Maps a route path to its permission key (for route guarding).
export const pathToKey = (path) => {
  const exact = PAGES.find((p) => p.path === path);
  return exact ? exact.key : null;
};
