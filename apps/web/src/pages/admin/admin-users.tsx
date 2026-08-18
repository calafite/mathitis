import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminUser } from '@mathitis/schemas';
import { adminApi } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const roleFilters = ['', 'freshman', 'senior', 'administrator', 'developer'] as const;
const statusFilters = ['', 'pending_verification', 'active', 'suspended', 'deactivated'] as const;

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState({ q: '', role: '' as (typeof roleFilters)[number], status: '' as (typeof statusFilters)[number] });
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [error, setError] = useState('');

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', query],
    queryFn: () =>
      adminApi.listUsers({
        q: query.q || undefined,
        role: query.role || undefined,
        status: query.status || undefined,
        limit: 50,
        offset: 0,
      }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminApi.updateUserStatus(id, { status: status as AdminUser['status'] }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : 'Request failed'),
  });

  const anonymizeMutation = useMutation({
    mutationFn: (id: string) => adminApi.anonymizeUser(id),
    onSuccess: () => {
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : 'Request failed'),
  });

  const moderationMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      adminApi.moderateProfile(id, { action: action as 'clear_banner' | 'clear_biography' | 'clear_contact' | 'clear_rich_cards' }),
    onSuccess: () => {
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : 'Request failed'),
  });

  function flagError(err: unknown) {
    if (err instanceof ApiError) {
      return `${err.message} (${err.code})`;
    }
    return err instanceof Error ? err.message : 'Request failed';
  }

  const users = usersQuery.data?.users ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">User management</h1>
        <p className="mt-1 text-sm text-slate-600">
          Search, moderate, suspend, or anonymize accounts. Anonymization preserves the mentorship
          lineage graph.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by handle, email, or social name"
          value={query.q}
          onChange={(e) => setQuery({ ...query, q: e.target.value })}
          className="max-w-xs"
        />
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={query.role}
          onChange={(e) => setQuery({ ...query, role: e.target.value as typeof query.role })}
        >
          {roleFilters.map((role) => (
            <option key={role} value={role}>
              {role === '' ? 'All roles' : role}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={query.status}
          onChange={(e) => setQuery({ ...query, status: e.target.value as typeof query.status })}
        >
          {statusFilters.map((status) => (
            <option key={status} value={status}>
              {status === '' ? 'All statuses' : status}
            </option>
          ))}
        </select>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Semester</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{user.socialName ?? user.handle}</p>
                  <p className="text-xs text-slate-500">@{user.handle} · {user.email}</p>
                </td>
                <td className="px-4 py-3 capitalize">{user.role}</td>
                <td className="px-4 py-3">{user.semester}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700'
                        : user.status === 'suspended'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {user.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="outline" size="sm" onClick={() => setSelected(user)}>
                    Manage
                  </Button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  {usersQuery.isLoading ? 'Loading…' : 'No users match the filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
            <h2 className="text-lg font-bold text-slate-900">
              Manage {selected.socialName ?? selected.handle}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              @{selected.handle} · {selected.role} · {selected.status}
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Account status</span>
                <div className="flex gap-2">
                  {(['active', 'suspended'] as const).map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={selected.status === status ? 'default' : 'outline'}
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ id: selected.id, status })}
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Moderate content</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={moderationMutation.isPending}
                    onClick={() =>
                      moderationMutation.mutate({ id: selected.id, action: 'clear_biography' })
                    }
                  >
                    Clear bio
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={moderationMutation.isPending}
                    onClick={() =>
                      moderationMutation.mutate({ id: selected.id, action: 'clear_rich_cards' })
                    }
                  >
                    Clear cards
                  </Button>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs text-slate-500">
                  Anonymization irreversibly removes personal data while keeping the lineage graph.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="mt-2"
                  disabled={anonymizeMutation.isPending || selected.deletedAt !== null}
                  onClick={() => anonymizeMutation.mutate(selected.id)}
                >
                  {selected.deletedAt !== null ? 'Already anonymized' : 'Anonymize account'}
                </Button>
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{flagError(error)}</p>}

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