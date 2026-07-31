import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldCheck, X, AlertTriangle } from 'lucide-react';

export default function ApprovalRequestModal({
  type, title, description, projectId, projectName,
  resourceId, resourceName, diffSummary, onClose, onCreated
}) {
  const { user } = useAuth();
  const [priority, setPriority] = useState('medium');
  const [impactAssessment, setImpactAssessment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    await base44.entities.ApprovalRequest.create({
      type,
      title,
      description,
      project_id: projectId,
      project_name: projectName,
      resource_id: resourceId,
      resource_name: resourceName,
      requested_by: user?.email || 'unknown',
      requested_by_name: user?.full_name || user?.email || 'Usuário',
      status: 'pending',
      priority,
      diff_summary: diffSummary,
      impact_assessment: impactAssessment,
      expires_at: expiresAt,
      audit_log: [{
        action: 'created',
        by: user?.email,
        by_name: user?.full_name || user?.email,
        at: new Date().toISOString(),
        note: `Solicitação criada. Impacto: ${impactAssessment}`,
      }],
    });
    setIsSubmitting(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold text-foreground">Solicitar Aprovação</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-secondary/30 border border-border/30 text-xs space-y-1">
            <p><span className="text-muted-foreground">Operação:</span> <span className="text-foreground font-semibold">{title}</span></p>
            {resourceName && <p><span className="text-muted-foreground">Recurso:</span> <span className="text-foreground">{resourceName}</span></p>}
            {projectName && <p><span className="text-muted-foreground">Projeto:</span> <span className="text-foreground">{projectName}</span></p>}
            {diffSummary && <p className="text-muted-foreground border-t border-border/20 pt-1 mt-1">{diffSummary}</p>}
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Prioridade</label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">🟢 Baixa</SelectItem>
                <SelectItem value="medium">🟡 Média</SelectItem>
                <SelectItem value="high">🟠 Alta</SelectItem>
                <SelectItem value="critical">🔴 Crítica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Avaliação de Impacto *</label>
            <textarea
              value={impactAssessment}
              onChange={e => setImpactAssessment(e.target.value)}
              placeholder="Descreva o impacto esperado desta mudança na produção..."
              className="mt-1 w-full h-24 px-3 py-2 text-xs rounded-md border border-input bg-secondary/50 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="flex items-start gap-2 text-[10px] text-amber-400 bg-amber-400/5 border border-amber-400/20 p-2.5 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <p>Esta operação requer aprovação explícita de um gestor de dados antes de ser executada. A solicitação expira em 72h.</p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
              onClick={handleSubmit}
              disabled={isSubmitting || !impactAssessment.trim()}
            >
              {isSubmitting ? 'Enviando...' : 'Enviar Solicitação'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}