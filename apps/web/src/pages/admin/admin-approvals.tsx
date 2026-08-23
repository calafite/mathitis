import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { usePageMeta } from '@/lib/use-page-meta';

export function AdminApprovalsPage() {
  usePageMeta('Fila de Aprovação', 'Revise pedidos de apadrinhamento aguardando aprovação administrativa.');
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const approvalsQuery = useQuery({
    queryKey: ['admin', 'approvals', 'pending'],
    queryFn: () => adminApi.listApprovals('pending_admin_approval'),
  });

  const decideMutation = useMutation({
    mutationFn: ({
      id,
      decision,
      reason,
    }: {
      id: string;
      decision: 'approve' | 'deny';
      reason?: string;
    }) => adminApi.decideApproval(id, { decision, reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'approvals'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'dashboard'] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setError(`${err.message} (${err.code})`);
      } else if (err instanceof Error) {
        setError(err.message);
      }
    },
  });

  const approvals = approvalsQuery.data?.approvals ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Fila de aprovação</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aceites de veteranos que exigem validação de um administrador. Aprovar cria a mentoria;
          recusar rejeita o pedido.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="space-y-3">
        {approvalsQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!approvalsQuery.isLoading && approvals.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum pedido aguardando aprovação.</p>
        )}
        {approvals.map((approval) => (
          <div
            key={approval.id}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-foreground">
                  {approval.freshman?.socialName ?? approval.freshman?.handle ?? 'Calouro desconhecido'}
                  <span className="mx-2 text-muted-foreground">→</span>
                  {approval.senior?.socialName ?? approval.senior?.handle ?? 'Veterano desconhecido'}
                </p>
                <p className="text-xs text-muted-foreground">
                  @{approval.freshman?.handle} (semestre {approval.freshman?.semester}) pediu{' '}
                  @{approval.senior?.handle} · {new Date(approval.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={decideMutation.isPending}
                  onClick={() => decideMutation.mutate({ id: approval.id, decision: 'approve' })}
                >
                  Aprovar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={decideMutation.isPending}
                  onClick={() => decideMutation.mutate({ id: approval.id, decision: 'deny' })}
                >
                  Recusar
                </Button>
              </div>
            </div>
            {approval.message && (
              <blockquote className="mt-3 border-l-2 border-primary/40 pl-3 text-sm italic text-foreground/80">
                {approval.message}
              </blockquote>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}