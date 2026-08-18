import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AuditLog } from '@mathitis/schemas';
import { adminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';

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

function formatDate(value: string | Date) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function AdminAuditLogsPage() {
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
        <h1 className="text-2xl font-bold text-slate-900">Audit log</h1>
        <p className="mt-1 text-sm text-slate-600">
          Chronological record of administrative and sensitive state changes, with actor, target,
          and before/after payloads.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500" htmlFor="audit-action">
            Action
          </label>
          <select
            id="audit-action"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
          >
            {actionFilters.map((action) => (
              <option key={action} value={action}>
                {action === '' ? 'All actions' : action}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500" htmlFor="audit-entity">
            Entity
          </label>
          <select
            id="audit-entity"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filters.entity}
            onChange={(e) => setFilters({ ...filters, entity: e.target.value })}
          >
            {entityFilters.map((entity) => (
              <option key={entity} value={entity}>
                {entity === '' ? 'All entities' : entity}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500" htmlFor="audit-from">
            From
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
          <label className="text-xs font-medium text-slate-500" htmlFor="audit-to">
            To
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
            Apply
          </Button>
          <Button size="sm" variant="outline" onClick={resetFilters}>
            Reset
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[65vh] overflow-y-auto">
          {logs.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              {logsQuery.isLoading ? 'Loading…' : 'No audit entries match the filters.'}
            </p>
          ) : (
            <ol className="divide-y divide-slate-100">
              {logs.map((log) => (
                <li key={log.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="w-40 shrink-0 text-xs text-slate-500">
                    {formatDate(log.createdAt)}
                  </div>
                  <div className="w-44 shrink-0">
                    <p className="text-sm font-medium text-slate-900">
                      {log.actor ? `@${log.actor.handle}` : 'System'}
                    </p>
                    <p className="text-xs capitalize text-slate-500">
                      {log.actor ? log.actor.role : 'automated'}
                    </p>
                  </div>
                  <div className="w-64 shrink-0 truncate font-mono text-xs text-indigo-700">
                    {log.action}
                  </div>
                  <div className="min-w-0 flex-1 truncate text-xs text-slate-500">
                    <span className="text-slate-400">{log.targetEntity}</span>
                    {log.targetId ? (
                      <>
                        {' '}
                        <span className="font-mono">· {log.targetId}</span>
                      </>
                    ) : null}
                  </div>
                  <div className="hidden w-32 shrink-0 truncate text-xs text-slate-400 md:block">
                    {log.ipAddress ?? '—'}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelected(log)}
                    disabled={!log.details}
                  >
                    Payload
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {total} entries · page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={offset === 0}
            onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset((value) => value + PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-lg">
            <h2 className="text-lg font-bold text-slate-900">Audit payload</h2>
            <p className="mt-1 font-mono text-xs text-indigo-700">{selected.action}</p>
            <p className="mt-1 text-xs text-slate-500">
              {formatDate(selected.createdAt)} · @{selected.actor?.handle ?? 'system'} ·{' '}
              {selected.targetEntity}
              {selected.targetId ? ` · ${selected.targetId}` : ''}
            </p>
            <pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
              {JSON.stringify(selected.details, null, 2)}
            </pre>
            <div className="mt-5 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}