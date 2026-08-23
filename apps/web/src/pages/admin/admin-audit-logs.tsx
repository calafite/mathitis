import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AuditLog } from '@mathitis/schemas';
import { adminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { usePageMeta } from '@/lib/use-page-meta';

const PAGE_SIZE = 25;

const actionFilters = [
  '',
  'config.update',
  'user.status.update',
  'user.anonymize',
  'profile.moderate.clear_banner',
  'profile.moderate.clear_biography',
  'profile.moderate.clear_contact',
  'profile.moderate.clear_rich_cards',
  'approval.approve',
  'approval.deny',
] as const;

const entityFilters = ['', 'user', 'profile', 'system_config', 'mentorship_request'] as const;

const roleLabels: Record<string, string> = {
  freshman: 'Calouro',
  senior: 'Veterano',
  administrator: 'Administrador',
  developer: 'Desenvolvedor',
};

function formatDate(value: string | Date) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function AdminAuditLogsPage() {
  usePageMeta('Registro de Auditoria', 'Histórico imutável das ações administrativas da plataforma.');
  const [filters, setFilters] = useState({
    action: '',
    entity: '',
    from: '',
    to: '',
  });
  const [applied, setApplied] = useState(filters);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const queryKey = useMemo(
    () => ['admin', 'audit-logs', applied, offset],
    [applied, offset],
  );

  const logsQuery = useQuery({
    queryKey,
    queryFn: () =>
      adminApi.listAuditLogs({
        action: applied.action || undefined,
        targetEntity: applied.entity || undefined,
        from: applied.from ? new Date(`${applied.from}T00:00:00`) : undefined,
        to: applied.to ? new Date(`${applied.to}T23:59:59`) : undefined,
        limit: PAGE_SIZE,
        offset,
      }),
  });

  const logs = logsQuery.data?.auditLogs ?? [];
  const total = logsQuery.data?.total ?? 0;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function applyFilters() {
    setApplied(filters);
    setOffset(0);
  }

  function resetFilters() {
    const empty = { action: '', entity: '', from: '', to: '' };
    setFilters(empty);
    setApplied(empty);
    setOffset(0);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Registro de auditoria</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registro cronológico de alterações administrativas e de estado sensível, com autor, alvo
          e conteúdos de antes/depois.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="audit-action">
            Ação
          </label>
          <select
            id="audit-action"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
          >
            {actionFilters.map((action) => (
              <option key={action} value={action}>
                {action === '' ? 'Todas as ações' : action}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="audit-entity">
            Entidade
          </label>
          <select
            id="audit-entity"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filters.entity}
            onChange={(e) => setFilters({ ...filters, entity: e.target.value })}
          >
            {entityFilters.map((entity) => (
              <option key={entity} value={entity}>
                {entity === '' ? 'Todas as entidades' : entity}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="audit-from">
            De
          </label>
          <input
            id="audit-from"
            type="date"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="audit-to">
            Até
          </label>
          <input
            id="audit-to"
            type="date"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={applyFilters}>
            Aplicar
          </Button>
          <Button size="sm" variant="outline" onClick={resetFilters}>
            Limpar
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="max-h-[65vh] overflow-y-auto">
          {logs.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {logsQuery.isLoading ? 'Carregando…' : 'Nenhuma entrada de auditoria corresponde aos filtros.'}
            </p>
          ) : (
            <ol className="divide-y divide-border">
              {logs.map((log) => (
                <li key={log.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="w-40 shrink-0 text-xs text-muted-foreground">
                    {formatDate(log.createdAt)}
                  </div>
                  <div className="w-44 shrink-0">
                    <p className="text-sm font-medium text-foreground">
                      {log.actor ? `@${log.actor.handle}` : 'Sistema'}
                    </p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {log.actor ? (roleLabels[log.actor.role] ?? log.actor.role) : 'automático'}
                    </p>
                  </div>
                  <div className="w-64 shrink-0 truncate font-mono text-xs text-primary">
                    {log.action}
                  </div>
                  <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    <span className="text-muted-foreground">{log.targetEntity}</span>
                    {log.targetId ? (
                      <>
                        {' '}
                        <span className="font-mono">· {log.targetId}</span>
                      </>
                    ) : null}
                  </div>
                  <div className="hidden w-32 shrink-0 truncate text-xs text-muted-foreground md:block">
                    {log.ipAddress ?? '—'}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelected(log)}
                    disabled={!log.details}
                  >
                    Conteúdo
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {total} entradas · página {page} de {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={offset === 0}
            onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
          >
            Anterior
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset((value) => value + PAGE_SIZE)}
          >
            Próxima
          </Button>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-popover text-popover-foreground p-5 shadow-lg">
            <h2 className="text-lg font-bold text-foreground">Conteúdo da auditoria</h2>
            <p className="mt-1 font-mono text-xs text-primary">{selected.action}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDate(selected.createdAt)} · @{selected.actor?.handle ?? 'sistema'} ·{' '}
              {selected.targetEntity}
              {selected.targetId ? ` · ${selected.targetId}` : ''}
            </p>
            <pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-muted p-4 text-xs leading-relaxed text-foreground">
              {JSON.stringify(selected.details, null, 2)}
            </pre>
            <div className="mt-5 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}