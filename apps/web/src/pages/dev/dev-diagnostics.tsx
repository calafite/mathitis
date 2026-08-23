import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { devApi } from '@/lib/dev-api';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
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
            className="break-all text-indigo-400 underline"
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

export function DevDiagnosticsPage() {
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
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
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
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Saúde do serviço</h2>
            <StatusBadge ok={health?.status === 'ok'} />
          </div>
          {health ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-400">Banco de dados</dt>
                <dd>
                  <StatusBadge ok={health.checks.database === 'ok'} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Redis</dt>
                <dd>
                  <StatusBadge ok={health.checks.redis === 'ok'} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Fila</dt>
                <dd>
                  <StatusBadge ok={health.checks.queue === 'ok'} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Tempo ativo</dt>
                <dd>{health.uptimeSeconds}s</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Verificado às</dt>
                <dd>{new Date(health.timestamp).toLocaleTimeString()}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-400">
              {healthQuery.isLoading ? 'Carregando…' : 'Indisponível'}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="font-semibold">Processo</h2>
          {metrics ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-400">PID</dt>
                <dd>{metrics.process.pid}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Node</dt>
                <dd>{metrics.process.nodeVersion}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">RSS</dt>
                <dd>{formatBytes(metrics.process.memory.rss)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Heap usado</dt>
                <dd>{formatBytes(metrics.process.memory.heapUsed)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">External</dt>
                <dd>{formatBytes(metrics.process.memory.external)}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-400">Carregando…</p>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="font-semibold">Pool do banco de dados</h2>
          {metrics ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-400">Conexões ativas</dt>
                <dd>{metrics.database.activeConnections}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Conexões ociosas</dt>
                <dd>{metrics.database.idleConnections}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Total de conexões</dt>
                <dd>{metrics.database.totalConnections}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-400">Carregando…</p>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="font-semibold">Fila de e-mails</h2>
          {metrics ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-400">Aguardando</dt>
                <dd>{metrics.queue.waiting}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Ativos</dt>
                <dd>{metrics.queue.active}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Concluídos</dt>
                <dd>{metrics.queue.completed}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Falhados</dt>
                <dd>{metrics.queue.failed}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Atrasados</dt>
                <dd>{metrics.queue.delayed}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2">
                <dt className="text-slate-400">Vazão (concluídos / falhados)</dt>
                <dd>
                  {metrics.queue.throughput.completed} / {metrics.queue.throughput.failed}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-400">Carregando…</p>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="font-semibold">Exposição de rede</h2>
        {metrics ? (
          <div className="mt-3 space-y-2 text-sm">
            <p className="text-slate-400">
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
          <p className="mt-3 text-sm text-slate-400">Carregando…</p>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="font-semibold">Caixa de correio local (sem SMTP)</h2>
        <p className="mt-1 text-sm text-slate-400">
          Os e-mails que o remetente de desenvolvimento despacharia são capturados aqui, para que
          você possa abrir os links de verificação e de redefinição de senha sem executar um
          servidor de e-mail.
        </p>
        {mailboxQuery.isLoading ? (
          <p className="mt-3 text-sm text-slate-400">Carregando…</p>
        ) : mailboxQuery.data?.emails.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            Nenhum e-mail capturado ainda. Registre uma nova conta para ver o link de verificação
            dela.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {mailboxQuery.data?.emails.map((email) => (
              <li
                key={email.id}
                className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-100">{email.to}</span>
                  <span className="text-xs text-slate-500">
                    {email.subject} · {new Date(email.sentAt).toLocaleTimeString()}
                  </span>
                </div>
                <pre className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-300">
                  <LinkifiedText text={email.text} />
                </pre>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
