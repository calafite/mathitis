import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Loader2, Trash2 } from 'lucide-react';
import { devApi } from '@/lib/dev-api';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { usePageMeta } from '@/lib/use-page-meta';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        ok ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
      }`}
    >
      {ok ? 'ok' : 'erro'}
    </span>
  );
}

function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/\S+)/g);
  return (
    <>
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="break-all text-primary underline"
          >
            {part}
          </a>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

function AdminManagementSection() {
  const queryClient = useQueryClient();
  const [identifier, setIdentifier] = useState('');
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const adminsQuery = useQuery({
    queryKey: ['dev', 'admins'],
    queryFn: () => devApi.listAdmins(),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['dev', 'admins'] });
    void queryClient.invalidateQueries({ queryKey: ['dev', 'health'] });
  };

  const promoteMutation = useMutation({
    mutationFn: (id: string) => devApi.promoteAdmin(id),
    onSuccess: () => {
      setIdentifier('');
      invalidate();
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => devApi.revokeAdmin(id),
    onSuccess: () => {
      setConfirmRevokeId(null);
      invalidate();
    },
  });

  const promoteError =
    promoteMutation.isError && promoteMutation.error instanceof ApiError
      ? promoteMutation.error.message
      : promoteMutation.isError
        ? 'Falha ao promover usuário'
        : null;
  const revokeError =
    revokeMutation.isError && revokeMutation.error instanceof ApiError
      ? revokeMutation.error.message
      : revokeMutation.isError
        ? 'Falha ao revogar privilégios'
        : null;

  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-4" data-testid="admin-management">
      <h2 className="font-semibold">Corpo Administrativo (Administradores)</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Promova ou revogue privilégios administrativos. Cada transição gera um registro de auditoria
        e encerra as sessões ativas do usuário.
      </p>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!identifier.trim() || promoteMutation.isPending) return;
          promoteMutation.mutate(identifier.trim());
        }}
      >
        <input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Nome de usuário ou e-mail acadêmico"
          aria-label="Identificador do novo administrador"
          className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        />
        <Button type="submit" disabled={!identifier.trim() || promoteMutation.isPending}>
          {promoteMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          Promover novo administrador
        </Button>
      </form>
      {promoteError ? (
        <p role="alert" className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
          {promoteError}
        </p>
      ) : null}
      {promoteMutation.isSuccess ? (
        <p role="status" className="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          Administrador promovido ✓
        </p>
      ) : null}

      <div className="mt-4 space-y-2">
        {adminsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          adminsQuery.data?.admins.map((admin) => (
            <div
              key={admin.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {admin.socialName ?? admin.handle}{' '}
                  <span className="font-mono text-xs text-muted-foreground">@{admin.handle}</span>
                  {admin.role === 'developer' ? (
                    <span className="ml-2 border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                      developer
                    </span>
                  ) : null}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {admin.email} · período {String(admin.semester).padStart(2, '0')} · desde{' '}
                  {new Date(admin.createdAt).toLocaleDateString()}
                </p>
              </div>
              {admin.role === 'administrator' ? (
                confirmRevokeId === admin.id ? (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] uppercase text-muted-foreground">
                      Confirmar?
                    </span>
                    <button
                      type="button"
                      disabled={revokeMutation.isPending}
                      onClick={() => revokeMutation.mutate(admin.id)}
                      className="border-2 border-red-600 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest text-red-600 hover:bg-red-600 hover:text-white disabled:opacity-50"
                    >
                      Revogar acesso
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRevokeId(null)}
                      className="border border-border px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmRevokeId(admin.id)}
                    aria-label={`Revogar administrador ${admin.handle}`}
                    className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-foreground hover:border-red-600 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Revogar acesso
                  </button>
                )
              ) : null}
            </div>
          ))
        )}
      </div>
      {revokeError ? (
        <p role="alert" className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
          {revokeError}
        </p>
      ) : null}
    </section>
  );
}

export function DevDiagnosticsPage() {
  usePageMeta('Diagnósticos', 'Telemetria do sistema: saúde dos serviços, filas e exposição de rede.');
  const { logout } = useAuth();
  const navigate = useNavigate();

  const healthQuery = useQuery({
    queryKey: ['dev', 'health'],
    queryFn: () => devApi.health(),
    refetchInterval: 15_000,
  });

  const metricsQuery = useQuery({
    queryKey: ['dev', 'metrics'],
    queryFn: () => devApi.metrics(),
    refetchInterval: 15_000,
  });

  const mailboxQuery = useQuery({
    queryKey: ['dev', 'mailbox'],
    queryFn: () => devApi.mailbox({ limit: 10 }),
    refetchInterval: 5_000,
  });

  const health = healthQuery.data;
  const metrics = metricsQuery.data?.metrics;

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Diagnósticos de desenvolvedor</h1>
          <p className="text-sm text-muted-foreground">
            Telemetria em tempo de execução. Nenhum dado pessoal é exposto aqui.
          </p>
        </div>
        <div className="flex gap-2">
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            className="border-border text-foreground"
            onClick={() => navigate('/')}
          >
            Voltar ao app
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => void logout()}
          >
            Sair
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Saúde do serviço</h2>
            <StatusBadge ok={health?.status === 'ok'} />
          </div>
          {health ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Banco de dados</dt>
                <dd>
                  <StatusBadge ok={health.checks.database === 'ok'} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Redis</dt>
                <dd>
                  <StatusBadge ok={health.checks.redis === 'ok'} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Fila</dt>
                <dd>
                  <StatusBadge ok={health.checks.queue === 'ok'} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tempo ativo</dt>
                <dd>{health.uptimeSeconds}s</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Verificado às</dt>
                <dd>{new Date(health.timestamp).toLocaleTimeString()}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {healthQuery.isLoading ? 'Carregando…' : 'Indisponível'}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold">Processo</h2>
          {metrics ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">PID</dt>
                <dd>{metrics.process.pid}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Node</dt>
                <dd>{metrics.process.nodeVersion}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">RSS</dt>
                <dd>{formatBytes(metrics.process.memory.rss)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Heap usado</dt>
                <dd>{formatBytes(metrics.process.memory.heapUsed)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">External</dt>
                <dd>{formatBytes(metrics.process.memory.external)}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold">Pool do banco de dados</h2>
          {metrics ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Conexões ativas</dt>
                <dd>{metrics.database.activeConnections}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Conexões ociosas</dt>
                <dd>{metrics.database.idleConnections}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total de conexões</dt>
                <dd>{metrics.database.totalConnections}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold">Fila de e-mails</h2>
          {metrics ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Aguardando</dt>
                <dd>{metrics.queue.waiting}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Ativos</dt>
                <dd>{metrics.queue.active}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Concluídos</dt>
                <dd>{metrics.queue.completed}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Falhados</dt>
                <dd>{metrics.queue.failed}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Atrasados</dt>
                <dd>{metrics.queue.delayed}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <dt className="text-muted-foreground">Vazão (concluídos / falhados)</dt>
                <dd>
                  {metrics.queue.throughput.completed} / {metrics.queue.throughput.failed}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold">Exposição de rede</h2>
        {metrics ? (
          <div className="mt-3 space-y-2 text-sm">
            <p className="text-muted-foreground">
              Portas em escuta:{' '}
              {metrics.network.listeningPorts.length > 0
                ? metrics.network.listeningPorts.join(', ')
                : 'nenhuma'}
            </p>
            {metrics.network.exposedPorts.length > 0 && (
              <p className="text-amber-300">
                Exposto além de 80/443: {metrics.network.exposedPorts.join(', ')}
              </p>
            )}
            {metrics.network.warnings.map((warning) => (
              <p key={warning} className="text-amber-300">
                {warning}
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold">Caixa de correio local (sem SMTP)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Os e-mails que o remetente de desenvolvimento despacharia são capturados aqui, para que
          você possa abrir os links de verificação e de redefinição de senha sem executar um
          servidor de e-mail.
        </p>
        {mailboxQuery.isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
        ) : mailboxQuery.data?.emails.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum e-mail capturado ainda. Registre uma nova conta para ver o link de verificação
            dela.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {mailboxQuery.data?.emails.map((email) => (
              <li
                key={email.id}
                className="rounded-lg border border-border bg-background p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{email.to}</span>
                  <span className="text-xs text-muted-foreground">
                    {email.subject} · {new Date(email.sentAt).toLocaleTimeString()}
                  </span>
                </div>
                <pre className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-foreground/80">
                  <LinkifiedText text={email.text} />
                </pre>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AdminManagementSection />
    </div>
  );
}
