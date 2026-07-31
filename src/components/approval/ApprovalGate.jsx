import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Clock, XCircle, CheckCircle2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ApprovalRequestModal from './ApprovalRequestModal';

/**
 * ApprovalGate — wrap any action that needs manager approval.
 * Props:
 *   type: ApprovalRequest type enum value
 *   title: short title
 *   description: what is being changed
 *   projectId / projectName
 *   resourceId / resourceName
 *   diffSummary: technical summary of changes
 *   onApproved: callback when an approved request exists (receives approvalId)
 *   children: the button/UI to show when already approved
 */
export default function ApprovalGate({
  type, title, description, projectId, projectName,
  resourceId, resourceName, diffSummary, onApproved, children
}) {
  const [showModal, setShowModal] = useState(false);

  const { data: requests = [], refetch } = useQuery({
    queryKey: ['approval_requests', resourceId, type],
    queryFn: () => base44.entities.ApprovalRequest.filter({ resource_id: resourceId, type, status: 'approved' }, '-approved_at', 5),
    enabled: !!resourceId,
  });

  const { data: pending = [] } = useQuery({
    queryKey: ['approval_pending', resourceId, type],
    queryFn: () => base44.entities.ApprovalRequest.filter({ resource_id: resourceId, type, status: 'pending' }, '-created_date', 3),
    enabled: !!resourceId,
  });

  const latestApproval = requests[0];
  const hasPending = pending.length > 0;

  // Check if approval is still valid (within 24h)
  const isApprovalValid = latestApproval && (() => {
    const approvedAt = new Date(latestApproval.approved_at);
    const now = new Date();
    return (now - approvedAt) < 24 * 60 * 60 * 1000;
  })();

  if (isApprovalValid) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-400/10 border border-emerald-400/30 text-xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span className="text-emerald-400 font-medium">Aprovado por {latestApproval.approved_by_name || latestApproval.approved_by}</span>
          <span className="text-muted-foreground">— {latestApproval.approval_reason}</span>
        </div>
        {children}
      </div>
    );
  }

  return (
    <>
      {hasPending && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-400/10 border border-amber-400/30 text-xs mb-2">
          <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span className="text-amber-400 font-medium">Aguardando aprovação do gestor</span>
          <span className="text-muted-foreground">· {pending.length} solicitação(ões) pendente(s)</span>
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        className="border-amber-400/40 text-amber-400 hover:bg-amber-400/10"
        onClick={() => setShowModal(true)}
      >
        <Lock className="w-3.5 h-3.5 mr-1.5" />
        Solicitar Aprovação
      </Button>

      {showModal && (
        <ApprovalRequestModal
          type={type}
          title={title}
          description={description}
          projectId={projectId}
          projectName={projectName}
          resourceId={resourceId}
          resourceName={resourceName}
          diffSummary={diffSummary}
          onClose={() => setShowModal(false)}
          onCreated={() => { refetch(); setShowModal(false); toast.success('Solicitação enviada para aprovação!'); }}
        />
      )}
    </>
  );
}