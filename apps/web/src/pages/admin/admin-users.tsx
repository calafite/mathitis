import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminUser } from '@mathitis/schemas';
import { adminApi } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePageMeta } from '@/lib/use-page-meta';

const roleFilters = ['', 'freshman', 'senior', 'administrator', 'developer'] as const;
const statusFilters = ['', 'pending_verification', 'active', 'suspended', 'deactivated'] as const;

const roleLabels: Record<string, string> = {
  freshman: 'Calouro',
  senior: 'Veterano',
  administrator: 'Administrador',
  developer: 'Desenvolvedor',
};

const statusLabels: Record<string, string> = {
  pending_verification: 'Verificação pendente',
  active: 'Ativo',
  suspended: 'Suspenso',
  deactivated: 'Desativado',
};

export function AdminUsersPage() {
  usePageMeta(
    'Gerenciamento de Usuários',
    'Modere contas, anonimize usuários e preserve a linhagem acadêmica.',
  );
  const queryClient = useQueryClient();
  const [query, setQuery] = useState({
    q: '',
    role: '' as (typeof roleFilters)[number],
    status: '' as (typeof statusFilters)[number],
  });
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
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : 'Falha na solicitação'),
  });

  const anonymizeMutation = useMutation({
    mutationFn: (id: string) => adminApi.anonymizeUser(id),
    onSuccess: () => {
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : 'Falha na solicitação'),
  });

  const moderationMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      adminApi.moderateProfile(id, {
        action: action as 'clear_banner' | 'clear_biography' | 'clear_contact' | 'clear_rich_cards',
      }),
    onSuccess: () => {
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : 'Falha na solicitação'),
  });

  function flagError(err: unknown) {
    if (err instanceof ApiError) {
      return `${err.message} (${err.code})`;
    }
    return err instanceof Error ? err.message : 'Falha na solicitação';
  }

  const users = usersQuery.data?.users ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gerenciamento de usuários</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pesquise, modere, suspenda ou anonimize contas. A anonimização preserva o grafo de
          linhagem de mentorias.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por handle, e-mail ou nome social"
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
              {role === '' ? 'Todos os papéis' : (roleLabels[role] ?? role)}
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
              {status === '' ? 'Todos os status' : (statusLabels[status] ?? status)}
            </option>
          ))}
        </select>
        {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Membro</th>
              <th className="px-4 py-3">Papel</th>
              <th className="px-4 py-3">Semestre</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{user.socialName ?? user.handle}</p>
                  <p className="text-xs text-muted-foreground">
                    @{user.handle} · {user.email}
                  </p>
                </td>
                <td className="px-4 py-3 capitalize">{roleLabels[user.role] ?? user.role}</td>
                <td className="px-4 py-3">{user.semester}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : user.status === 'suspended'
                          ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {statusLabels[user.status] ?? user.status}
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
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  {usersQuery.isLoading ? 'Carregando…' : 'Nenhum usuário corresponde aos filtros.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-popover text-popover-foreground p-5 shadow-lg">
            <h2 className="text-lg font-bold text-foreground">
              Gerenciar {selected.socialName ?? selected.handle}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              @{selected.handle} · {roleLabels[selected.role] ?? selected.role} ·{' '}
              {statusLabels[selected.status] ?? selected.status}
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/80">Status da conta</span>
                <div className="flex gap-2">
                  {(['active', 'suspended'] as const).map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={selected.status === status ? 'default' : 'outline'}
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ id: selected.id, status })}
                    >
                      {statusLabels[status] ?? status}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/80">Moderar conteúdo</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={moderationMutation.isPending}
                    onClick={() =>
                      moderationMutation.mutate({ id: selected.id, action: 'clear_biography' })
                    }
                  >
                    Limpar bio
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={moderationMutation.isPending}
                    onClick={() =>
                      moderationMutation.mutate({ id: selected.id, action: 'clear_rich_cards' })
                    }
                  >
                    Limpar cards
                  </Button>
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground">
                  A anonimização remove irreversivelmente os dados pessoais, mantendo o grafo de
                  linhagem.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="mt-2"
                  disabled={anonymizeMutation.isPending || selected.deletedAt !== null}
                  onClick={() => anonymizeMutation.mutate(selected.id)}
                >
                  {selected.deletedAt !== null ? 'Já anonimizado' : 'Anonimizar conta'}
                </Button>
              </div>
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{flagError(error)}</p>
            )}

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
