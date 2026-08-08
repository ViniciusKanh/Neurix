import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, Database, TrendingUp, Trash2, Search, Star, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import GlowCard from '@/components/ui/GlowCard';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { listStored } from '@/lib/datasetStore';

const FAV_KEY = 'neurix_fav_projects';
const loadFavs = () => { try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); } catch { return new Set(); } };

export default function Projects() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [favs, setFavs] = useState(loadFavs);
  const [localIds, setLocalIds] = useState(new Set());

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date', 50),
  });

  // Which projects have their full dataset available locally (IndexedDB).
  useEffect(() => {
    let alive = true;
    listStored().then((ids) => { if (alive) setLocalIds(new Set((ids || []).map((x) => (typeof x === 'string' ? x : x.projectId)))); }).catch(() => {});
    return () => { alive = false; };
  }, [projects.length]);

  const toggleFav = (e, id) => {
    e.preventDefault(); e.stopPropagation();
    setFavs((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); localStorage.setItem(FAV_KEY, JSON.stringify([...n])); return n; });
  };

  const handleDelete = async (e, id) => {
    e.preventDefault(); e.stopPropagation();
    if (!window.confirm('Excluir este projeto e todos os seus dados, análises e modelos?')) return;
    await base44.entities.Project.delete(id);
    try { const { deleteDataset } = await import('@/lib/datasetStore'); await deleteDataset(id); } catch { /* ignore */ }
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  };

  const view = useMemo(() => {
    let list = projects.filter((p) => {
      if (!query.trim()) return true;
      const s = `${p.name} ${p.description || ''}`.toLowerCase();
      return query.toLowerCase().split(/\s+/).every((t) => s.includes(t));
    });
    const dir = (a, b) => {
      const fa = favs.has(a.id) ? 1 : 0, fb = favs.has(b.id) ? 1 : 0;
      if (fa !== fb) return fb - fa; // favorites first, always
      if (sort === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sort === 'rows') return (b.dataset_size || 0) - (a.dataset_size || 0);
      return new Date(b.updated_date || b.created_date || 0) - new Date(a.updated_date || a.created_date || 0);
    };
    return [...list].sort(dir);
  }, [projects, query, sort, favs]);

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
          description="Crie um projeto e envie um dataset para começar a análise"
          action={<Button onClick={() => navigate('/projects/new')} variant="outline"><Plus className="w-4 h-4 mr-2" /> Criar Projeto</Button>}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar projeto…" className="pl-8 bg-secondary/50 h-9" />
            </div>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="bg-secondary/50 w-44 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Mais recentes</SelectItem>
                <SelectItem value="name">Nome (A–Z)</SelectItem>
                <SelectItem value="rows">Mais linhas</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">{view.length} de {projects.length}</span>
          </div>

          {view.length === 0 ? (
            <EmptyState icon={Search} title="Nenhum resultado" description="Ajuste a busca para encontrar seus projetos." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {view.map((project) => {
                const fav = favs.has(project.id);
                const hasLocal = localIds.has(project.id);
                return (
                  <motion.div key={project.id} whileHover={{ y: -2 }}>
                    <Link to={`/projects/${project.id}`}>
                      <GlowCard className="cursor-pointer group h-full relative">
                        <div className="absolute top-3 right-3 flex gap-1">
                          <button onClick={(e) => toggleFav(e, project.id)} title={fav ? 'Desafixar' : 'Fixar'}
                            className={`p-1.5 rounded-md transition-all ${fav ? 'text-amber-400' : 'text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-amber-400'}`}>
                            <Star className="w-3.5 h-3.5" fill={fav ? 'currentColor' : 'none'} />
                          </button>
                          <button onClick={(e) => handleDelete(e, project.id)} title="Excluir"
                            className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-start justify-between mb-3 pr-16">
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">{project.name}</h3>
                          <StatusBadge status={project.status} />
                        </div>
                        {project.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{project.description}</p>}
                        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {project.dataset_columns && <span className="flex items-center gap-1"><Database className="w-3 h-3" /> {project.dataset_columns} cols</span>}
                          {project.dataset_size && <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {project.dataset_size.toLocaleString('pt-BR')} linhas</span>}
                          <span>{project.created_date ? format(new Date(project.created_date), 'dd/MM/yyyy') : ''}</span>
                          {hasLocal
                            ? <span className="flex items-center gap-1 text-emerald-400" title="Dataset completo disponível neste dispositivo"><HardDrive className="w-3 h-3" /> local</span>
                            : project.dataset_file_url && <span className="flex items-center gap-1 text-amber-400" title="Dataset não está neste dispositivo"><HardDrive className="w-3 h-3" /> reenviar</span>}
                        </div>
                      </GlowCard>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
