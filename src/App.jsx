import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';

// Shell + auth screens are eager (needed for first paint); the rest are
// lazy-loaded per route to keep the initial bundle small.
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Privacy from './pages/Privacy';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Projects = lazy(() => import('./pages/Projects'));
const NewProject = lazy(() => import('./pages/NewProject'));
const ProjectView = lazy(() => import('./pages/ProjectView'));
const DataExplorer = lazy(() => import('./pages/DataExplorer'));
const MLStudio = lazy(() => import('./pages/MLStudio'));
const SQLWorkbench = lazy(() => import('./pages/SQLWorkbench'));
const StatisticsLab = lazy(() => import('./pages/StatisticsLab'));
const FeatureLab = lazy(() => import('./pages/FeatureLab'));
const TextMining = lazy(() => import('./pages/TextMining'));
const SequenceMining = lazy(() => import('./pages/SequenceMining'));
const DataBlend = lazy(() => import('./pages/DataBlend'));
const GeoMining = lazy(() => import('./pages/GeoMining'));
const Visualization3D = lazy(() => import('./pages/Visualization3D'));
const Reports = lazy(() => import('./pages/Reports'));
const AssociationRules = lazy(() => import('./pages/AssociationRules'));
const ModelMonitoring = lazy(() => import('./pages/ModelMonitoring'));
const AutoML = lazy(() => import('./pages/AutoML'));
const Inference = lazy(() => import('./pages/Inference'));
const ChampionChallenger = lazy(() => import('./pages/ChampionChallenger'));
const TimeSeries = lazy(() => import('./pages/TimeSeries'));
const ModelDocumentation = lazy(() => import('./pages/ModelDocumentation'));
const ModelComparison = lazy(() => import('./pages/ModelComparison'));
const HyperparamTuning = lazy(() => import('./pages/HyperparamTuning'));
const ABTestPage = lazy(() => import('./pages/ABTestPage'));
const DatasetExport = lazy(() => import('./pages/DatasetExport'));
const PDFReportExporter = lazy(() => import('./pages/PDFReportExporter'));
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard'));
const AdvancedMLTests = lazy(() => import('./pages/AdvancedMLTests'));
const DataProfiling = lazy(() => import('./pages/DataProfiling'));
const PipelineExecutionHistory = lazy(() => import('./pages/PipelineExecutionHistory'));
const Deploy = lazy(() => import('./pages/Deploy'));
const ModelLab = lazy(() => import('./pages/ModelLab'));
const BatchScore = lazy(() => import('./pages/BatchScore'));
const Settings = lazy(() => import('./pages/Settings'));
const UserManagement = lazy(() => import('./pages/UserManagement'));

const RouteFallback = () => (
  <div className="flex items-center justify-center py-24">
    <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
);


const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated } = useAuth();

  // Public route — accessible without login (required for app store listing).
  if (typeof window !== 'undefined' && window.location.pathname === '/privacy') {
    return <Privacy />;
  }

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background bg-grid-pattern">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground animate-pulse">Carregando Neurix...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/new" element={<NewProject />} />
        <Route path="/projects/:id" element={<ProjectView />} />
        <Route path="/explorer" element={<DataExplorer />} />
        <Route path="/sql" element={<SQLWorkbench />} />
        <Route path="/statistics" element={<StatisticsLab />} />
        <Route path="/feature-lab" element={<FeatureLab />} />
        <Route path="/text-mining" element={<TextMining />} />
        <Route path="/sequences" element={<SequenceMining />} />
        <Route path="/blend" element={<DataBlend />} />
        <Route path="/geo" element={<GeoMining />} />
        <Route path="/ml-studio" element={<MLStudio />} />
        <Route path="/model-lab" element={<ModelLab />} />
        <Route path="/batch-score" element={<BatchScore />} />

        <Route path="/visualization-3d" element={<Visualization3D />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/association-rules" element={<AssociationRules />} />
        <Route path="/monitoring" element={<ModelMonitoring />} />
        <Route path="/automl" element={<AutoML />} />

        <Route path="/inference" element={<Inference />} />

        <Route path="/champion-challenger" element={<ChampionChallenger />} />
        <Route path="/time-series" element={<TimeSeries />} />


        <Route path="/model-docs" element={<ModelDocumentation />} />
        <Route path="/ab-test" element={<ABTestPage />} />
        <Route path="/dataset-export" element={<DatasetExport />} />
        <Route path="/pdf-export" element={<PDFReportExporter />} />
        <Route path="/model-comparison" element={<ModelComparison />} />
        <Route path="/hyperparam-tuning" element={<HyperparamTuning />} />
        <Route path="/analytics" element={<AnalyticsDashboard />} />
        <Route path="/advanced-ml" element={<AdvancedMLTests />} />
        <Route path="/data-profiling" element={<DataProfiling />} />
        <Route path="/pipeline-history" element={<PipelineExecutionHistory />} />
        <Route path="/deploy" element={<Deploy />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/privacy" element={<Privacy />} />

      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ErrorBoundary>
            <AuthenticatedApp />
          </ErrorBoundary>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App