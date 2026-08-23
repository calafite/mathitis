import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MentorshipRequest } from '@mathitis/schemas';
import { useAuth } from '@/contexts/auth-context';
import { requestsApi, buildIdempotencyKey, type RequestInbox } from '@/lib/requests-api';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  pending_admin_approval: 'Aguardando aprovação do administrador',
  accepted: 'Aceito',
  rejected: 'Recusado',
  cancelled: 'Cancelado',
  cancelled_capacity_filled: 'Cancelado (vagas preenchidas)',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  pending_admin_approval: 'bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300',
  accepted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  cancelled: 'bg-muted text-muted-foreground',
  cancelled_capacity_filled: 'bg-muted text-muted-foreground',
};

function partyName(party: MentorshipRequest['freshman'] | MentorshipRequest['senior']) {
  return party?.socialName ?? party?.handle ?? 'Desconhecido';
}

function RequestRow({
  request,
  role,
  onInspect,
  onAccept,
  onReject,
  onApprove,
  onDeny,
  busy,
}: {
  request: MentorshipRequest;
  role?: string;
  onInspect: (request: MentorshipRequest) => void;
  onAccept: (request: MentorshipRequest) => void;
  onReject: (request: MentorshipRequest) => void;
  onApprove: (request: MentorshipRequest) => void;
  onDeny: (request: MentorshipRequest) => void;
  busy: boolean;
}) {
  const isStaff = role === 'administrator' || role === 'developer';
  const isSenior = role === 'senior';
  const isFreshman = role === 'freshman';
  const active = request.status === 'pending' || request.status === 'pending_admin_approval';

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[request.status] ?? 'bg-muted text-muted-foreground'}`}>
            {STATUS_LABELS[request.status] ?? request.status}
          </span>
          <button
            type="button"
            className="text-sm font-semibold text-foreground hover:underline"
            onClick={() => onInspect(request)}
          >
            {isSenior || isStaff
              ? partyName(request.freshman)
              : partyName(request.senior)}
          </button>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-foreground/80">{request.message}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {new Date(request.createdAt).toLocaleString('pt-BR')}
        </p>
        {request.rejectionReason && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">Motivo: {request.rejectionReason}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-2">
        <Button variant="outline" size="sm" onClick={() => onInspect(request)}>
          Inspecionar perfil
        </Button>
        {active && (
          <>
            {isSenior && (
              <Button size="sm" disabled={busy} onClick={() => onAccept(request)}>
                Aceitar
              </Button>
            )}
            {(isSenior || isFreshman || isStaff) && (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => onReject(request)}>
                {isFreshman ? 'Cancelar' : 'Recusar'}
              </Button>
            )}
            {isStaff && request.status === 'pending_admin_approval' && (
              <>
                <Button size="sm" disabled={busy} onClick={() => onApprove(request)}>
                  Aprovar
                </Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => onDeny(request)}>
                  Recusar
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function RequestsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isFreshman = user?.role === 'freshman';
  const [inbox, setInbox] = useState<RequestInbox>(isFreshman ? 'sent' : 'incoming');
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [inspecting, setInspecting] = useState<MentorshipRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestsQuery = useQuery({
    queryKey: ['requests', inbox, status],
    queryFn: () => requestsApi.list({ inbox, status }).then((r) => r.requests),
  });

  const mutationOptions = {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'Falha na solicitação');
    },
  };

  const acceptMutation = useMutation({
    mutationFn: (request: MentorshipRequest) =>
      requestsApi.accept(request.id, buildIdempotencyKey()),
    ...mutationOptions,
  });

  const rejectMutation = useMutation({
    mutationFn: (request: MentorshipRequest) => requestsApi.reject(request.id),
    ...mutationOptions,
  });

  const cancelMutation = useMutation({
    mutationFn: (request: MentorshipRequest) => requestsApi.cancel(request.id),
    ...mutationOptions,
  });

  const approveMutation = useMutation({
    mutationFn: (request: MentorshipRequest) => requestsApi.approveAdmin(request.id),
    ...mutationOptions,
  });

  const denyMutation = useMutation({
    mutationFn: (request: MentorshipRequest) => requestsApi.denyAdmin(request.id),
    ...mutationOptions,
  });

  const busy = [acceptMutation, rejectMutation, cancelMutation, approveMutation, denyMutation].some(
    (m) => m.isPending,
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Pedidos de apadrinhamento</h1>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!isFreshman && (
          <div className="inline-flex rounded-md border border-input p-0.5">
            <button
              type="button"
              onClick={() => setInbox('incoming')}
              className={`rounded px-3 py-1.5 text-sm ${inbox === 'incoming' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >
              Recebidos
            </button>
            <button
              type="button"
              onClick={() => setInbox('sent')}
              className={`rounded px-3 py-1.5 text-sm ${inbox === 'sent' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >
              Enviados
            </button>
          </div>
        )}
        <select
          className="h-10 rounded-md border border-input bg-card px-3 text-sm"
          value={status ?? ''}
          onChange={(e) => setStatus(e.target.value || undefined)}
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-6 flex flex-col gap-3">
        {requestsQuery.isLoading && <p className="text-muted-foreground">Carregando…</p>}
        {requestsQuery.data?.length === 0 && (
          <p className="text-muted-foreground">Nenhum pedido ainda.</p>
        )}
        {requestsQuery.data?.map((request) => (
          <RequestRow
            key={request.id}
            request={request}
            role={user?.role}
            onInspect={setInspecting}
            onAccept={(r) => void acceptMutation.mutateAsync(r)}
            onReject={(r) =>
              void (isFreshman ? cancelMutation : rejectMutation).mutateAsync(r)
            }
            onApprove={(r) => void approveMutation.mutateAsync(r)}
            onDeny={(r) => void denyMutation.mutateAsync(r)}
            busy={busy}
          />
        ))}
      </div>

      {inspecting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setInspecting(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-popover text-popover-foreground p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Perfil do candidato</h2>
              <Button variant="outline" size="sm" onClick={() => setInspecting(null)}>
                Fechar
              </Button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">@{inspecting.freshman?.handle}</p>
            <p className="mt-2 text-sm text-foreground/80">
              <strong>Mensagem:</strong> {inspecting.message}
            </p>

            {inspecting.freshmanProfile ? (
              <div className="mt-4 rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  {inspecting.freshmanProfile.avatarUrl ? (
                    <img
                      src={inspecting.freshmanProfile.avatarUrl}
                      alt=""
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-lg font-bold text-primary">
                      {(inspecting.freshmanProfile.socialName ?? inspecting.freshman?.handle ?? '?').charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-foreground">
                      {inspecting.freshmanProfile.socialName ?? inspecting.freshman?.handle}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Período {inspecting.freshman?.semester ?? inspecting.freshmanProfile.semester}
                    </p>
                  </div>
                </div>
                {inspecting.freshmanProfile.tagline && (
                  <p className="mt-3 text-sm text-foreground/80">{inspecting.freshmanProfile.tagline}</p>
                )}
                {inspecting.freshmanProfile.biographyMarkdown && (
                  <p className="mt-3 line-clamp-4 text-sm text-foreground/80">
                    {inspecting.freshmanProfile.biographyMarkdown}
                  </p>
                )}
                {inspecting.freshmanProfile.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {inspecting.freshmanProfile.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="rounded-full px-2 py-0.5 text-xs"
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Nenhum perfil detalhado disponível.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}