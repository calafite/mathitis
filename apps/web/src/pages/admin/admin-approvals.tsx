import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';

export function AdminApprovalsPage() {
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
        <h1 className="text-2xl font-bold text-slate-900">Approval queue</h1>
        <p className="mt-1 text-sm text-slate-600">
          Senior accepts that require an administrator sign-off. Approving creates the mentorship;
          denying rejects the request.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-3">
        {approvalsQuery.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {!approvalsQuery.isLoading && approvals.length === 0 && (
          <p className="text-sm text-slate-500">No requests awaiting approval.</p>
        )}
        {approvals.map((approval) => (
          <div
            key={approval.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-slate-900">
                  {approval.freshman?.socialName ?? approval.freshman?.handle ?? 'Unknown freshman'}
                  <span className="mx-2 text-slate-400">→</span>
                  {approval.senior?.socialName ?? approval.senior?.handle ?? 'Unknown senior'}
                </p>
                <p className="text-xs text-slate-500">
                  @{approval.freshman?.handle} (semester {approval.freshman?.semester}) asked{' '}
                  @{approval.senior?.handle} · {new Date(approval.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={decideMutation.isPending}
                  onClick={() => decideMutation.mutate({ id: approval.id, decision: 'approve' })}
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={decideMutation.isPending}
                  onClick={() => decideMutation.mutate({ id: approval.id, decision: 'deny' })}
                >
                  Deny
                </Button>
              </div>
            </div>
            {approval.message && (
              <blockquote className="mt-3 border-l-2 border-indigo-200 pl-3 text-sm italic text-slate-600">
                {approval.message}
              </blockquote>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}