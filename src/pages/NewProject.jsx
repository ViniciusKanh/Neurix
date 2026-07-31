import React, { useState, useCallback } from 'react';
import { parseAnyFile } from '@/lib/parseDataset';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Upload, FileSpreadsheet, ArrowRight, Loader2, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import GlowCard from '@/components/ui/GlowCard';
import PageHeader from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function NewProject() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState('info'); // info | upload | processing

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  const handleFileSelect = (e) => {
    const f = e.target.files[0];
    if (f) setFile(f);
  };

  const handleCreate = async () => {
    if (!name.trim()) return toast.error('Por favor, insira um nome para o projeto');
    setIsCreating(true);
    setStep('processing');

    let projectData = { name, description, status: 'draft' };

    if (file) {
      toast.info('Lendo estrutura do dataset...');
      let parsed = null;
      try {
        // Parses CSV/TSV/TXT and Excel (XLSX/XLS) in the browser — no garbage.
        parsed = await parseAnyFile(file);
      } catch (err) {
        setIsCreating(false);
        setStep('info');
        return toast.error(`Não foi possível ler o arquivo: ${err.message}`);
      }

      if (!parsed || parsed.row_count === 0) {
        setIsCreating(false);
        setStep('info');
        return toast.error('O arquivo não contém dados legíveis. Verifique se é um CSV ou Excel válido.');
      }

      toast.info('Enviando arquivo...');
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      projectData.dataset_file_url = file_url;
      projectData.dataset_filename = file.name;

      if (parsed && parsed.row_count > 0) {
        projectData.column_info = parsed.columns || [];
        projectData.dataset_size = parsed.row_count;
        projectData.dataset_columns = (parsed.columns || []).length;
        projectData.data_sample = (parsed.data_sample || []).slice(0, 300);
        projectData.status = 'exploring';

        // Local diagnosis — no external API
        const { diagnosisProject } = await import('@/lib/localML');
        const diagnosis = diagnosisProject({ ...projectData, column_info: parsed.columns, dataset_size: parsed.row_count });
        projectData.ai_diagnosis = diagnosis.diagnosis;
        projectData.ai_suggestions = diagnosis.suggestions;
      } else {
        toast.warning('Não foi possível extrair dados do arquivo. Projeto criado sem metadados.');
      }
    }

    const project = await base44.entities.Project.create(projectData);
    toast.success('Projeto criado com sucesso!');
    setIsCreating(false);
    navigate(`/projects/${project.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="Novo Projeto" subtitle="Crie um novo projeto de análise de ML" />

      <GlowCard className="mb-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Nome do Projeto</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Análise de Churn de Clientes"
              className="mt-1.5 bg-secondary/50"
            />
          </div>
          <div>
            <Label htmlFor="desc">Descrição (opcional)</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição dos seus objetivos de análise..."
              className="mt-1.5 bg-secondary/50 h-20"
            />
          </div>
        </div>
      </GlowCard>

      <GlowCard className="mb-6">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" /> Envio de Dataset
        </h3>
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer",
            isDragging ? "border-primary bg-primary/5 glow-primary" : "border-border/50 hover:border-primary/50",
            file && "border-primary/30 bg-primary/5"
          )}
          onClick={() => document.getElementById('fileInput').click()}
        >
          <input id="fileInput" type="file" className="hidden" accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.xlsb" onChange={handleFileSelect} />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileSpreadsheet className="w-8 h-8 text-primary" />
              <div className="text-left">
                <p className="font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          ) : (
            <>
              <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">Arraste seu dataset aqui ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground mt-1">Suporta CSV, XLSX, XLSM, JSON, TSV</p>
            </>
          )}
        </div>
      </GlowCard>

      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
        <Button
          onClick={handleCreate}
          disabled={isCreating || !name.trim()}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 text-base glow-primary"
        >
          {isCreating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {step === 'processing' ? 'Analisando dataset...' : 'Criando...'}
            </>
          ) : (
            <>
              Criar Projeto <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </motion.div>
    </div>
  );
}