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
      {ok ? 'ok' : 'error'}
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
          <h1 className="text-2xl font-bold text-foreground">Developer diagnostics</h1>
          <p className="text-sm text-muted-foreground">
            Runtime telemetry. No personal data is exposed here.
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
            Back to app
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => void logout()}
          >
            Sign out
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Service health</h2>
            <StatusBadge ok={health?.status === 'ok'} />
          </div>
          {health ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-400">Database</dt>
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
                <dt className="text-slate-400">Queue</dt>
                <dd>
                  <StatusBadge ok={health.checks.queue === 'ok'} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Uptime</dt>
                <dd>{health.uptimeSeconds}s</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Checked at</dt>
                <dd>{new Date(health.timestamp).toLocaleTimeString()}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-400">
              {healthQuery.isLoading ? 'Loading…' : 'Unavailable'}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="font-semibold">Process</h2>
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
                <dt className="text-slate-400">Heap used</dt>
                <dd>{formatBytes(metrics.process.memory.heapUsed)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">External</dt>
                <dd>{formatBytes(metrics.process.memory.external)}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-400">Loading…</p>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="font-semibold">Database pool</h2>
          {metrics ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-400">Active connections</dt>
                <dd>{metrics.database.activeConnections}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Idle connections</dt>
                <dd>{metrics.database.idleConnections}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Total connections</dt>
                <dd>{metrics.database.totalConnections}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-400">Loading…</p>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="font-semibold">Email queue</h2>
          {metrics ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-400">Waiting</dt>
                <dd>{metrics.queue.waiting}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Active</dt>
                <dd>{metrics.queue.active}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Completed</dt>
                <dd>{metrics.queue.completed}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Failed</dt>
                <dd>{metrics.queue.failed}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Delayed</dt>
                <dd>{metrics.queue.delayed}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2">
                <dt className="text-slate-400">Throughput (completed / failed)</dt>
                <dd>
                  {metrics.queue.throughput.completed} / {metrics.queue.throughput.failed}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-400">Loading…</p>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="font-semibold">Network exposure</h2>
        {metrics ? (
          <div className="mt-3 space-y-2 text-sm">
            <p className="text-slate-400">
              Listening ports:{' '}
              {metrics.network.listeningPorts.length > 0
                ? metrics.network.listeningPorts.join(', ')
                : 'none'}
            </p>
            {metrics.network.exposedPorts.length > 0 && (
              <p className="text-amber-300">
                Exposed beyond 80/443: {metrics.network.exposedPorts.join(', ')}
              </p>
            )}
            {metrics.network.warnings.map((warning) => (
              <p key={warning} className="text-amber-300">
                {warning}
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">Loading…</p>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="font-semibold">Local mail (no SMTP)</h2>
        <p className="mt-1 text-sm text-slate-400">
          Emails the dev sender would dispatch are captured here, so you can open verification and
          password-reset links without running a mail server.
        </p>
        {mailboxQuery.isLoading ? (
          <p className="mt-3 text-sm text-slate-400">Loading…</p>
        ) : mailboxQuery.data?.emails.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            No emails captured yet. Register a new account to see its verification link.
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
