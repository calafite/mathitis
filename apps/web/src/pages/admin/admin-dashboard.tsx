import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';

const roleLabels: Record<string, string> = {
  freshman: 'Calouro',
  senior: 'Veterano',
  administrator: 'Administrador',
  developer: 'Desenvolvedor',
};

const statusLabels: Record<string, string> = {
  active: 'Ativo',
  suspended: 'Suspenso',
  deactivated: 'Desativado',
  pending_verification: 'Verificação pendente',
};

export function AdminDashboardPage() {
  const configQuery = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: () => adminApi.getConfig(),
  });

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', 'dashboard'],
    queryFn: () => adminApi.listUsers({ limit: 5, offset: 0 }),
  });

  const approvalsQuery = useQuery({
    queryKey: ['admin', 'approvals', 'pending'],
    queryFn: () => adminApi.listApprovals('pending_admin_approval'),
  });

  const config = configQuery.data?.config;
  const pendingCount = approvalsQuery.data?.approvals.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Central de comando</h1>
        <p className="mt-1 text-sm text-slate-600">
          Visão geral da plataforma, dos seus membros e das decisões de moderação pendentes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Total de usuários</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{usersQuery.data?.total ?? '–'}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Aprovações pendentes</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Janela de descoberta</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">
            {config?.DISCOVERY_ACTIVE ? 'Aberta' : 'Fechada'}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Membros mais recentes</h2>
          <Link to="/admin/users">
            <Button variant="outline" size="sm">
              Gerenciar usuários
            </Button>
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-slate-100">
          {(usersQuery.data?.users ?? []).map((user) => (
            <li key={user.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {user.socialName ?? user.handle}
                </p>
                <p className="text-xs text-slate-500">
                  @{user.handle} · {roleLabels[user.role] ?? user.role} · Semestre{' '}
                  {user.semester}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  user.status === 'active'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {statusLabels[user.status] ?? user.status}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {pendingCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-900">
            {pendingCount} pedido{pendingCount === 1 ? '' : 's'} aguardando revisão
          </h2>
          <Link to="/admin/approvals">
            <Button variant="outline" size="sm" className="mt-2">
              Revisar aprovações
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}