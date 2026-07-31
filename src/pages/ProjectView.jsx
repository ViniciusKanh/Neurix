import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Database, Brain, Rocket, FileText, BarChart3, FlaskConical, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import DataQualityPanel from '@/components/project/DataQualityPanel';
import DataPreviewTable from '@/components/project/DataPreviewTable';
import GlowCard from '@/components/ui/GlowCard';
import DataPrepModule from '@/components/project/DataPrepModule';
import ProjectReport from '@/components/project/ProjectReport';
import ModelingPipeline from '@/components/project/ModelingPipeline';
import FeatureEngineering from '../components/ml/FeatureEngineering';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'overview', label: 'Visão Geral', icon: Database },
  { id: 'prep', label: 'Preparação', icon: FlaskConical },
  { id: 'features', label: 'Features', icon: Brain },
  { id: 'modeling', label: 'Modelagem', icon: Cpu },
  { id: 'report', label: 'Relatório', icon: FileText },
];

export default function ProjectView() {
  const urlParams = new URLSearchParams(window.location.search);
  const pathId = window.location.pathname.split('/projects/')[1];
  const projectId = pathId || urlParams.get('id');
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  const queryClient = useQueryClient();
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => base44.entities.Project.list().then(ps => ps.find(p => p.id === projectId)),
    enabled: !!projectId,
  });

  const { data: analyses = [] } = useQuery({
    queryKey: ['analyses', projectId],
    queryFn: () => base44.entities.Analysis.filter({ project_id: projectId }, '-created_date', 20),
    enabled: !!projectId,
  });

  if (isLoading) return <LoadingSpinner text="Carregando projeto..." />;
  if (!project) return <div className="text-center py-20 text-muted-foreground">Projeto não encontrado</div>;

  const quickLinks = [
    { icon: BarChart3, label: 'Explorador de Dados', path: `/explorer?project=${projectId}` },
    { icon: Brain, label: 'ML Studio', path: `/ml-studio?project=${projectId}` },
    { icon: Rocket, label: 'Deploy', path: `/deploy?project=${projectId}` },
    { icon: FileText, label: 'Relatórios', path: `/reports?project=${projectId}` },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>
          {project.description && <p className="text-sm text-muted-foreground mt-1">{project.description}</p>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-secondary/30 p-1 rounded-lg w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200',
              activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          {/* Quick Links */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {quickLinks.map((link, i) => (
              <Link key={i} to={link.path}>
                <GlowCard className="cursor-pointer group text-center py-4">
                  <link.icon className="w-5 h-5 text-primary mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-medium text-foreground">{link.label}</p>
                </GlowCard>
              </Link>
            ))}
          </div>

          {project.dataset_filename && (
            <GlowCard className="mb-6">
              <div className="flex items-center gap-3 text-sm">
                <Database className="w-4 h-4 text-primary" />
                <span className="font-medium text-foreground">{project.dataset_filename}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">{project.dataset_size?.toLocaleString()} linhas</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">{project.dataset_columns} colunas</span>
              </div>
            </GlowCard>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DataQualityPanel columns={project.column_info} />
            <div className="lg:col-span-2">
              <DataPreviewTable data={project.data_sample} columns={project.column_info} />
            </div>
          </div>
        </div>
      )}

      {/* Preparation Tab */}
      {activeTab === 'prep' && (
        <div>
          {project.dataset_file_url ? (
            <DataPrepModule
              project={project}
              onProjectUpdate={() => queryClient.invalidateQueries({ queryKey: ['project', projectId] })}
            />
          ) : (
            <GlowCard className="text-center py-16">
              <FlaskConical className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm font-medium text-foreground">Nenhum dataset associado</p>
              <p className="text-xs text-muted-foreground mt-1">Faça upload de um dataset para usar a preparação de dados</p>
            </GlowCard>
          )}
        </div>
      )}

      {/* Features Tab */}
      {activeTab === 'features' && (
        project.dataset_file_url ? (
          <FeatureEngineering
            project={project}
            onProjectUpdate={() => queryClient.invalidateQueries({ queryKey: ['project', projectId] })}
          />
        ) : (
          <GlowCard className="text-center py-16">
            <FlaskConical className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-sm font-medium text-foreground">Nenhum dataset associado</p>
          </GlowCard>
        )
      )}

      {/* Modeling Tab */}
      {activeTab === 'modeling' && (
        <ModelingPipeline project={project} analyses={analyses} />
      )}

      {/* Report Tab */}
      {activeTab === 'report' && (
        <ProjectReport project={project} analyses={analyses} />
      )}
    </div>
  );
}