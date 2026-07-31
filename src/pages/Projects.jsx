import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, Database, TrendingUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GlowCard from '@/components/ui/GlowCard';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';

export default function Projects() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date', 50),
  });

  const handleDelete = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    await base44.entities.Project.delete(id);
    try { const { deleteDataset } = await import('@/lib/datasetStore'); await deleteDataset(id); } catch { /* ignore */ }
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  };

  if (isLoading) return <LoadingSpinner text="Carregando projetos..." />;

  return (
    <div>
      <PageHeader
        title="Projetos"
        subtitle="Gerencie seus projetos de análise de ML"
        actions={
          <Button onClick={() => navigate('/projects/new')} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" /> Novo Projeto
          </Button>
        }
      />
      {projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Nenhum projeto ainda"
          description="Crie um projeto e envie um dataset para começar a análise com IA"
          action={
            <Button onClick={() => navigate('/projects/new')} variant="outline">
              <Plus className="w-4 h-4 mr-2" /> Criar Projeto
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <motion.div key={project.id} whileHover={{ y: -2 }}>
              <Link to={`/projects/${project.id}`}>
                <GlowCard className="cursor-pointer group h-full relative">
                  <button
                    onClick={(e) => handleDelete(e, project.id)}
                    className="absolute top-3 right-3 p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-start justify-between mb-3 pr-8">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {project.name}
                    </h3>
                    <StatusBadge status={project.status} />
                  </div>
                  {project.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{project.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {project.dataset_columns && (
                      <span className="flex items-center gap-1">
                        <Database className="w-3 h-3" /> {project.dataset_columns} cols
                      </span>
                    )}
                    {project.dataset_size && (
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> {project.dataset_size.toLocaleString()} rows
                      </span>
                    )}
                    <span>{format(new Date(project.created_date), 'MMM d, yyyy')}</span>
                  </div>
                </GlowCard>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}