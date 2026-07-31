import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/ui/PageHeader';
import GlowCard from '@/components/ui/GlowCard';
import EmptyState from '@/components/ui/EmptyState';
import { BookOpen, Loader2, Download, Brain, Cpu, ChevronDown, ChevronUp, Copy, Search, FileText, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import ModelLibrary from '@/components/docs/ModelLibrary';
import ProjectDocView from '@/components/docs/ProjectDocView';

export default function ModelDocumentation() {
  const [activeView, setActiveView] = useState('library');

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-updated_date', 50) });
  const { data: deployments = [] } = useQuery({ queryKey: ['deployments'], queryFn: () => base44.entities.ModelDeployment.list('-created_date', 50) });

  return (
    <div>
      <PageHeader title="Documentação de Modelos"
        subtitle="Biblioteca completa de algoritmos ML + documentação técnica exportável em PDF" />

      <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg w-fit mb-5">
        {[['library', '📚 Biblioteca de Modelos'], ['project', '📋 Documentar Projeto']].map(([v, l]) => (
          <button key={v} onClick={() => setActiveView(v)}
            className={cn('px-4 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap',
              activeView === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            {l}
          </button>
        ))}
      </div>

      {activeView === 'library' && <ModelLibrary />}
      {activeView === 'project' && <ProjectDocView projects={projects} deployments={deployments} />}
    </div>
  );
}