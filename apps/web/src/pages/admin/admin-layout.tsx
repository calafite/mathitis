import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const navItems = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/approvals', label: 'Approvals' },
  { to: '/admin/config', label: 'Configuration' },
  { to: '/admin/audit-logs', label: 'Audit log' },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-60 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="text-lg font-semibold text-foreground"
              onClick={() => navigate('/')}
            >
              Mathitis Admin
            </button>
            <ThemeToggle />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {user?.socialName ?? user?.handle} · {user?.role}
          </p>
        </div>
        <nav className="flex-1 space-y-1 px-2 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-2 border-t border-slate-200 p-3">
          <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/')}>
            Back to app
          </Button>
          <Button variant="ghost" size="sm" className="w-full" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}