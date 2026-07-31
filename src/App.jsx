import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';

import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import NewProject from './pages/NewProject';
import ProjectView from './pages/ProjectView';
import DataExplorer from './pages/DataExplorer';
import MLStudio from './pages/MLStudio';

import Visualization3D from './pages/Visualization3D';
import Reports from './pages/Reports';
import AssociationRules from './pages/AssociationRules';
import ModelMonitoring from './pages/ModelMonitoring';
import AutoML from './pages/AutoML';

import Inference from './pages/Inference';

import ChampionChallenger from './pages/ChampionChallenger';
import TimeSeries from './pages/TimeSeries';


import ModelDocumentation from './pages/ModelDocumentation';
import ModelComparison from './pages/ModelComparison';
import HyperparamTuning from './pages/HyperparamTuning';
import ABTestPage from './pages/ABTestPage';
import DatasetExport from './pages/DatasetExport';
import PDFReportExporter from './pages/PDFReportExporter';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import AdvancedMLTests from './pages/AdvancedMLTests';
import DataProfiling from './pages/DataProfiling';
import PipelineExecutionHistory from './pages/PipelineExecutionHistory';
import Deploy from './pages/Deploy';
import Login from './pages/Login';
import Settings from './pages/Settings';
import UserManagement from './pages/UserManagement';
import Privacy from './pages/Privacy';


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
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/new" element={<NewProject />} />
        <Route path="/projects/:id" element={<ProjectView />} />
        <Route path="/explorer" element={<DataExplorer />} />
        <Route path="/ml-studio" element={<MLStudio />} />

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